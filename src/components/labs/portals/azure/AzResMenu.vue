<template>
  <AzContextMenu v-if="!pane" :items="items" :x="x" :y="y" @pick="pick" @close="$emit('close')" />
  <AzTagsPane v-else-if="pane === 'tags'" :target-id="String(target.id)" :name="String(target.name)"
              :type="target.kind === 'group' ? 'Resource group' : meta(target.kind).singular"
              :tags="target.tags || {}" @close="$emit('close')" />
  <AzMovePane v-else-if="pane === 'move'" :items="[target]" :from="String(target.group)" @close="$emit('close')" />
</template>

<script setup lang="ts">
/**
 * The "..." / right-click menu for one row of a resource list (All resources,
 * a resource type's browse blade, a resource group's resources), or for a
 * resource group itself. Every action is the `az` line that does it - the same
 * ones the resource's own blade runs, so the two can never disagree.
 */
import { computed, ref } from 'vue';
import { cli } from '@/utils/portalKit';
import AzContextMenu, { type CtxItem } from './AzContextMenu.vue';
import AzTagsPane from './AzTagsPane.vue';
import { AzMovePane } from './AzMisc';
import { deleteCommand, meta, useAz } from './azure';

const props = defineProps<{ target: Record<string, any>; x: number; y: number }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const az = useAz();
const pane = ref<'' | 'tags' | 'move'>('');
const t = computed(() => props.target);
const p = computed(() => t.value.props || {});

const TYPE_NAME = ['storage', 'sql', 'keyvault', 'cosmos', 'acr', 'aks', 'sqldb'];

const items = computed<CtxItem[]>(() => {
  const kind = String(t.value.kind || '');
  if (kind === 'group') {
    return [
      { key: 'open', label: 'Open resource group', icon: 'group' },
      { key: 'create', label: 'Create a resource here', icon: 'plus' },
      { key: 'sep1', sep: true },
      { key: 'tags', label: 'Edit tags', icon: 'tag' },
      { key: 'copy', label: 'Copy resource ID', icon: 'copy' },
      { key: 'sep2', sep: true },
      { key: 'delete', label: 'Delete resource group', icon: 'trash', danger: true },
    ];
  }
  const list: CtxItem[] = [{ key: 'open', label: 'Open', icon: meta(kind).icon }];
  if (kind === 'vm') {
    const running = p.value.power === 'VM running';
    list.push({ key: 'connect', label: 'Connect', icon: 'connect' },
              { key: 'bastion', label: 'Connect via Bastion', icon: 'bastion' },
              { key: 'sepv', sep: true },
              { key: 'vm-start', label: 'Start', icon: 'play', disabled: running },
              { key: 'vm-restart', label: 'Restart', icon: 'restart', disabled: !running },
              { key: 'vm-stop', label: 'Stop', icon: 'stop', disabled: p.value.power === 'VM deallocated' });
  }
  if (kind === 'webapp') {
    const stopped = p.value.web_state === 'Stopped';
    list.push({ key: 'sepw', sep: true },
              { key: 'web-start', label: 'Start', icon: 'play', disabled: !stopped },
              { key: 'web-restart', label: 'Restart', icon: 'restart' },
              { key: 'web-stop', label: 'Stop', icon: 'stop', disabled: stopped });
  }
  if (kind === 'aks') {
    const stopped = p.value.power === 'Stopped';
    list.push({ key: 'seps', sep: true },
              { key: 'aks-start', label: 'Start', icon: 'play', disabled: !stopped },
              { key: 'aks-stop', label: 'Stop', icon: 'stop', disabled: stopped });
  }
  if (kind === 'storage') {
    list.push({ key: 'containers', label: 'Containers', icon: 'container' },
              { key: 'keys', label: 'Access keys', icon: 'key' });
  }
  list.push({ key: 'sep1', sep: true },
            { key: 'tags', label: 'Edit tags', icon: 'tag' });
  if (kind !== 'sqldb') list.push({ key: 'move', label: 'Move to another resource group', icon: 'move' });
  list.push({ key: 'copy', label: 'Copy resource ID', icon: 'copy' },
            { key: 'sep2', sep: true },
            { key: 'delete', label: 'Delete', icon: 'trash', danger: true });
  return list;
});

function close() { emit('close'); }

async function pick(key: string) {
  const r = t.value;
  const flags = { '-g': r.group, '-n': r.name };
  if (key === 'tags' || key === 'move') { pane.value = key; return; }
  close();
  switch (key) {
    case 'open':
      az.go(r.kind === 'group' ? { page: 'group', name: r.name } : { page: 'resource', id: r.id });
      return;
    case 'create': az.go({ page: 'create', kind: 'marketplace', group: r.name }); return;
    case 'connect': az.go({ page: 'resource', id: r.id, tab: 'connect' }); return;
    case 'bastion': az.go({ page: 'resource', id: r.id, tab: 'bastion' }); return;
    case 'containers': az.go({ page: 'resource', id: r.id, tab: 'containers' }); return;
    case 'keys': az.go({ page: 'resource', id: r.id, tab: 'keys' }); return;
    case 'copy':
      void navigator.clipboard?.writeText(String(r.id));
      az.note('info', 'Resource ID copied', String(r.id));
      return;
    case 'vm-start':
      await az.run(cli(['az', 'vm', 'start'], flags), `Successfully started virtual machine '${r.name}'`);
      return;
    case 'vm-restart':
      if (!(await az.confirm({ title: 'Restart this virtual machine', message: `Do you want to restart '${r.name}'?`, confirmLabel: 'Yes' }))) return;
      await az.run(cli(['az', 'vm', 'restart'], flags), `Successfully restarted virtual machine '${r.name}'`);
      return;
    case 'vm-stop':
      if (!(await az.confirm({ title: 'Stop this virtual machine',
        message: `Do you want to stop '${r.name}'? It will be deallocated and compute charges stop.`, confirmLabel: 'Yes' }))) return;
      await az.run(cli(['az', 'vm', 'deallocate'], flags), `Successfully stopped virtual machine '${r.name}'`);
      return;
    case 'web-start': case 'web-stop': case 'web-restart': {
      const verb = key.slice(4);
      await az.run(cli(['az', 'webapp', verb], flags), `Successfully ${verb === 'stop' ? 'stopped' : verb + 'ed'} web app '${r.name}'`);
      return;
    }
    case 'aks-start': case 'aks-stop': {
      const verb = key.slice(4);
      await az.run(cli(['az', 'aks', verb], flags), `${verb === 'start' ? 'Started' : 'Stopped'} Kubernetes service '${r.name}'`);
      return;
    }
    case 'delete': await remove(); return;
    default: return;
  }
}

async function remove() {
  const r = t.value;
  if (r.kind === 'group') {
    const inside = (az.p.value.resources || []).filter((x: any) => x.group === r.name);
    const ok = await az.confirm({ title: 'Delete a resource group',
      message: 'The following resource group and all its dependent resources will be permanently deleted.',
      items: [`Resource group to be deleted: ${r.name}`, ...inside.map((x: any) => `${x.name} — ${meta(x.kind).singular}`)],
      typeToConfirm: r.name, typeLabel: 'Enter resource group name to confirm deletion', danger: true });
    if (!ok) return;
    az.note('progress', `Deleting resource group ${r.name}`);
    await az.run(cli(['az', 'group', 'delete'], { '--name': r.name, '--yes': true }), `Deleted resource group ${r.name}`);
    return;
  }
  const typed = TYPE_NAME.includes(r.kind);
  const singular = meta(r.kind).singular.toLowerCase();
  const ok = await az.confirm({ title: `Delete ${singular}`,
    message: `Are you sure you want to delete '${r.name}'? This action cannot be undone.`,
    typeToConfirm: typed ? r.name : undefined, typeLabel: typed ? `Type the ${singular} name` : undefined,
    confirmLabel: typed ? 'Delete' : 'Yes', danger: true });
  if (!ok) return;
  az.note('progress', `Deleting ${r.name}...`);
  await az.run(deleteCommand(r), `Successfully deleted '${r.name}'`);
}
</script>
