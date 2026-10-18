/**
 * Small blades every resource and resource group shares: Locks, the JSON view
 * pane and the "Move resources" pane. Render functions rather than SFCs, so the
 * three stay one short file.
 */
import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { cli, errorText, rows } from '@/utils/portalKit';
import AzIcon from './AzIcon';
import AzPane from './AzPane.vue';
import { useAz } from './azure';

export const AzLocks = defineComponent({
  name: 'AzLocks',
  setup() {
    return () => h('div', [
      h('div', { class: 'az-cmdbar' }, [
        h('button', { type: 'button', class: 'az-cmd', disabled: true,
                      title: 'Management locks are not modelled in this lab' },
          [h(AzIcon, { name: 'plus' }), ' Add']),
        h('button', { type: 'button', class: 'az-cmd', disabled: true }, [h(AzIcon, { name: 'refresh' }), ' Refresh']),
      ]),
      h('table', { class: 'az-table' }, [
        h('thead', [h('tr', ['Lock name', 'Lock type', 'Scope', 'Notes'].map(t => h('th', t)))]),
        h('tbody', [h('tr', [h('td', { colspan: 4, class: 'az-muted', style: 'text-align:center;padding:24px' },
          'This resource has no locks. (Management locks are not modelled in this lab — a Delete lock would block the delete commands you run here.)')])]),
      ]),
    ]);
  },
});

export const AzJsonPane = defineComponent({
  name: 'AzJsonPane',
  props: { title: { type: String, required: true }, body: { type: Object as PropType<Record<string, any>>, required: true } },
  emits: ['close'],
  setup(props, { emit }) {
    const text = computed(() => JSON.stringify(props.body, null, 2));
    return () => h(AzPane, { title: 'Resource JSON', subtitle: props.title, onClose: () => emit('close') }, {
      default: () => [
        h('div', { class: 'az-field' }, [h('div', { class: 'az-field__label' }, 'Resource ID'),
          h('div', { class: 'az-field__ctl az-mono' }, String(props.body.id || ''))]),
        h('pre', { class: 'az-code', style: 'max-height:none' }, text.value)],
      foot: () => [
        h('button', { type: 'button', class: 'az-btn', onClick: () => navigator.clipboard?.writeText(text.value) },
          [h(AzIcon, { name: 'copy' }), ' Copy to clipboard']),
        h('button', { type: 'button', class: 'az-btn', onClick: () => emit('close') }, 'Close')],
    });
  },
});

export const AzMovePane = defineComponent({
  name: 'AzMovePane',
  props: {
    items: { type: Array as PropType<Record<string, any>[]>, required: true },
    from: { type: String, required: true },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const az = useAz();
    const target = ref('');
    const ack = ref(false);
    const error = ref('');
    const groups = computed(() => rows(az.p.value, 'groups').map(g => String(g.name)).filter(n => n !== props.from));
    async function move() {
      error.value = '';
      const result = await az.run(cli(['az', 'resource', 'move'], {
        '--destination-group': target.value, '--ids': props.items.map(r => String(r.id)) }),
        `Moving resources complete: ${props.items.length} resource(s) moved to ${target.value}`, { quiet: true });
      if (!result.ok) { error.value = errorText(result); return; }
      emit('close');
    }
    return () => h(AzPane, { title: 'Move resources', subtitle: `Source: ${props.from}`, error: error.value,
                              onClose: () => emit('close') }, {
      default: () => [
        h('p', { class: 'az-intro' }, 'Moving resources will change their resource IDs. Any tool or script that refers to the old IDs (role assignments, template outputs, pipelines) will need to be updated.'),
        h('div', { class: 'az-section-title' }, 'Resources to move'),
        h('ul', props.items.map(r => h('li', `${r.name}`))),
        h('div', { class: 'az-field' }, [
          h('div', { class: 'az-field__label' }, ['Target resource group ', h('span', { class: 'az-req' }, '*')]),
          h('div', { class: 'az-field__ctl' }, [h('select', {
            class: 'az-select', value: target.value,
            onChange: (e: Event) => { target.value = (e.target as HTMLSelectElement).value; },
          }, [h('option', { value: '' }, 'Select a resource group'), ...groups.value.map(g => h('option', { value: g }, g))])]),
        ]),
        h('label', { class: 'az-check' }, [h('input', { type: 'checkbox', checked: ack.value,
          onChange: () => { ack.value = !ack.value; } }),
          ' I understand that tools and scripts associated with moved resources will not work until I update them to use new resource IDs']),
      ],
      foot: () => [
        h('button', { type: 'button', class: 'az-btn az-btn--primary', disabled: !target.value || !ack.value, onClick: move }, 'Move'),
        h('button', { type: 'button', class: 'az-btn', onClick: () => emit('close') }, 'Cancel')],
    });
  },
});
