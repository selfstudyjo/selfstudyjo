<template>
  <FxPanel :title="item.name" width="760px" @close="$emit('close')">
    <div class="is-sub fx-muted"><FxIcon :name="item.type" :size="16" />{{ typeLabel(item.type) }} · {{ item.workspace }}</div>
    <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
    <div class="fx-settings">
      <div class="fx-settings__nav" role="tablist">
        <button v-for="t in tabs" :key="t.id" type="button" :class="{ 'is-active': current === t.id }"
                @click="current = t.id; error = ''">{{ t.label }}</button>
      </div>
      <div class="fx-settings__body">
        <template v-if="current === 'about'">
          <h3 class="fx-h3 is-first">About</h3>
          <div class="fx-field">
            <label for="is-name">Name</label>
            <input id="is-name" v-model="name" class="fx-input" />
          </div>
          <div class="fx-field">
            <label for="is-desc">Description</label>
            <textarea id="is-desc" v-model="description" class="fx-textarea" maxlength="256" />
            <span class="fx-field__help">{{ description.length }}/256</span>
          </div>
          <dl class="fx-kv">
            <dt>Owner</dt><dd>{{ item.owner }}</dd>
            <dt>Location</dt><dd>{{ item.workspace }}{{ item.folder ? ' / ' + item.folder : '' }}</dd>
            <dt>Created</dt><dd>{{ item.created }}</dd>
            <dt>Item ID</dt><dd class="fx-mono">{{ item.id }}</dd>
          </dl>
          <div class="is-actions">
            <button type="button" class="fx-btn fx-btn--primary" :disabled="!aboutDirty" @click="saveAbout">Save</button>
          </div>
        </template>

        <template v-else-if="current === 'label'">
          <h3 class="fx-h3 is-first">Sensitivity label</h3>
          <p class="is-p">Classify this item so people know how to handle its data. Labels flow to downstream items.</p>
          <div class="fx-field">
            <span class="fx-field__label">Sensitivity label</span>
            <select v-model="label" class="fx-select" aria-label="Sensitivity label">
              <option value="">(None)</option>
              <option v-for="l in labels" :key="l" :value="l">{{ l }}</option>
            </select>
          </div>
          <div v-if="needsJustification" class="fx-field">
            <label for="is-just">Justification<span class="fx-field__req">*</span></label>
            <input id="is-just" v-model="justification" class="fx-input" placeholder="Why is this label being lowered or removed?" />
            <span class="fx-field__help">Lowering or removing a label requires a justification.</span>
          </div>
          <p v-if="item.label_inherited" class="fx-msgbar fx-msgbar--info"><FxIcon name="info" />The current label was inherited from an upstream item.</p>
          <button type="button" class="fx-btn fx-btn--primary" :disabled="label === (item.label || '') || (needsJustification && !justification.trim())" @click="saveLabel">Apply</button>
        </template>

        <template v-else-if="current === 'endorsement'">
          <h3 class="fx-h3 is-first">Endorsement</h3>
          <p class="is-p">Help coworkers find your quality content by endorsing it.</p>
          <label class="fx-check"><input v-model="endorsement" type="radio" value="None" />None</label>
          <label class="fx-check"><input v-model="endorsement" type="radio" value="Promoted" />Promoted
            <span class="fx-muted">- ready for others to use</span></label>
          <label class="fx-check"><input v-model="endorsement" type="radio" value="Certified" />Certified
            <span class="fx-muted">- meets the organization's quality bar</span></label>
          <button type="button" class="fx-btn fx-btn--primary" :disabled="endorsement === (item.endorsement || 'None')" @click="saveEndorsement">Apply</button>
        </template>

        <template v-else-if="current === 'share'">
          <h3 class="fx-h3 is-first">Manage permissions</h3>
          <div class="fx-tablewrap">
            <table class="fx-table">
              <thead><tr><th>People and groups</th><th>Permissions</th><th /></tr></thead>
              <tbody>
                <tr v-for="s in item.shared_with || []" :key="s.principal">
                  <td>{{ s.principal }} <span class="fx-muted">({{ s.kind }})</span></td>
                  <td>{{ (s.permissions || []).join(', ') }}</td>
                  <td><button type="button" class="fx-btn fx-btn--sm" @click="unshare(s.principal)">Remove access</button></td>
                </tr>
                <tr v-if="!(item.shared_with || []).length"><td colspan="3" class="fx-muted">Only people with a workspace role can access this item.</td></tr>
              </tbody>
            </table>
          </div>
          <h3 class="fx-h3">Grant people access</h3>
          <div class="fx-field">
            <label for="is-who">Enter a name or email address</label>
            <input id="is-who" v-model="shareWho" class="fx-input" list="is-people" autocomplete="off" />
            <datalist id="is-people"><option v-for="p in principals" :key="p.name" :value="p.name">{{ p.display }}</option></datalist>
          </div>
          <div class="fx-field">
            <span class="fx-field__label">Additional permissions</span>
            <label v-for="perm in perms" :key="perm" class="fx-check">
              <input v-model="sharePerms" type="checkbox" :value="perm" :disabled="perm === 'Read'" />{{ permHelp[perm] || perm }}
            </label>
          </div>
          <button type="button" class="fx-btn fx-btn--primary" :disabled="!shareWho.trim()" @click="share">Grant</button>
        </template>

        <template v-else-if="current === 'schedule'">
          <h3 class="fx-h3 is-first">{{ item.type === 'SemanticModel' ? 'Refresh' : 'Schedule' }}</h3>
          <p v-if="schedule" class="fx-msgbar" :class="schedule.enabled ? 'fx-msgbar--success' : 'fx-msgbar--warning'">
            <FxIcon :name="schedule.enabled ? 'success' : 'warning'" />
            {{ schedule.enabled ? 'Scheduled run is on' : 'Scheduled run is off' }}:
            {{ schedule.type === 'cron' ? 'every ' + schedule.interval + ' minutes' : 'daily at ' + (schedule.times || []).join(', ') }}
          </p>
          <div class="fx-field">
            <span class="fx-field__label">Repeat</span>
            <select v-model="repeat" class="fx-select" aria-label="Repeat">
              <option value="cron">By the minute</option><option value="daily">Daily</option>
            </select>
          </div>
          <div v-if="repeat === 'cron'" class="fx-field">
            <label for="is-every">Every (minutes)</label>
            <input id="is-every" v-model.number="interval" class="fx-input" type="number" min="1" />
          </div>
          <div v-else class="fx-field">
            <label for="is-times">Time</label>
            <input id="is-times" v-model="times" class="fx-input" placeholder="02:00, 14:00" />
            <span class="fx-field__help">One or more times, HH:MM, separated by commas.</span>
          </div>
          <div class="is-actions">
            <button type="button" class="fx-btn fx-btn--primary" @click="applySchedule">Apply</button>
            <button v-if="schedule" type="button" class="fx-btn" @click="toggleSchedule">{{ schedule.enabled ? 'Turn off' : 'Turn on' }}</button>
            <button v-if="schedule" type="button" class="fx-btn" @click="removeSchedule">Remove schedule</button>
          </div>
        </template>
      </div>
    </div>
  </FxPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import FxPanel from './FxPanel.vue';
import FxIcon from './FxIcon.vue';
import { cli, errorText, itemPath, rows, typeLabel, useFabric } from './fabric';

const props = defineProps<{ item: Record<string, any>; tab?: string }>();
const emit = defineEmits<{ (event: 'close'): void }>();
const { portal, run, route, go } = useFabric();

const live = computed(() => rows(portal.value, 'items').find(i => i.id === props.item.id) || props.item);
const item = live;
const runnable = computed(() => ['DataPipeline', 'Notebook', 'SemanticModel'].includes(item.value.type));
const tabs = computed(() => [
  { id: 'about', label: 'About' }, { id: 'label', label: 'Sensitivity label' },
  { id: 'endorsement', label: 'Endorsement' }, { id: 'share', label: 'Manage permissions' },
  ...(runnable.value ? [{ id: 'schedule', label: item.value.type === 'SemanticModel' ? 'Refresh' : 'Schedule' }] : []),
]);
const current = ref(props.tab || 'about');
const error = ref('');
const labels = computed(() => (portal.value.labels as string[]) || []);
const perms = computed(() => (portal.value.item_permissions as string[]) || ['Read']);
const principals = computed(() => rows(portal.value, 'principals'));
const permHelp: Record<string, string> = {
  Read: 'Read (always granted)', ReadData: 'Read all data using SQL (ReadData)',
  ReadAll: 'Read all OneLake data (ReadAll)', Build: 'Build reports on the default semantic model (Build)',
  Write: 'Write', Reshare: 'Allow recipients to share this item (Reshare)',
};

const name = ref('');
const description = ref('');
const label = ref('');
const justification = ref('');
const endorsement = ref('None');
const shareWho = ref('');
const sharePerms = ref<string[]>(['Read']);
const repeat = ref('cron');
const interval = ref(60);
const times = ref('02:00');

const path = computed(() => itemPath(item.value.workspace, item.value.name, item.value.type));
const schedule = computed(() => rows(portal.value, 'schedules').find(s => s.item === item.value.name
  && s.workspace === item.value.workspace));

watch(item, value => {
  name.value = value.name;
  description.value = value.description || '';
  label.value = value.label || '';
  endorsement.value = value.endorsement || 'None';
  if (schedule.value) {
    repeat.value = schedule.value.type;
    interval.value = Number(schedule.value.interval || 60);
    times.value = (schedule.value.times || ['02:00']).join(', ');
  }
}, { immediate: true });

const aboutDirty = computed(() => name.value.trim() !== item.value.name || description.value !== (item.value.description || ''));
const LEVELS = ['Public', 'General', 'Confidential', 'Highly Confidential'];
const needsJustification = computed(() => Boolean(item.value.label) && (label.value === ''
  || LEVELS.indexOf(label.value) < LEVELS.indexOf(item.value.label)));

async function exec(command: string, success: string) {
  error.value = '';
  const result = await run(command, success, { quiet: true });
  if (!result.ok) error.value = errorText(result);
  return result.ok;
}

async function saveAbout() {
  if (description.value !== (item.value.description || '')) {
    if (!await exec(cli(['fab', 'set', path.value, '-q', 'description', '-i', description.value]), 'Description saved')) return;
  }
  const newName = name.value.trim();
  if (newName && newName !== item.value.name) {
    const wasOpen = route.value.page === 'item' && route.value.item === item.value.name;
    if (!await exec(cli(['fab', 'set', path.value], { '-q': 'displayName', '-i': newName }), `Renamed to ${newName}`)) return;
    if (wasOpen) go({ ...route.value, item: newName });
  }
}

async function saveLabel() {
  if (!label.value) {
    await exec(cli(['fab', 'label', 'rm', path.value], { '--justification': justification.value.trim() }), 'Sensitivity label removed');
  } else {
    await exec(cli(['fab', 'label', 'set', path.value], { '-n': label.value,
      '--justification': needsJustification.value ? justification.value.trim() : '' }), `Label ${label.value} applied`);
  }
  justification.value = '';
}

async function saveEndorsement() {
  await exec(cli(['fab', 'set', path.value], { '-q': 'endorsement', '-i': endorsement.value }),
    endorsement.value === 'None' ? 'Endorsement removed' : `${item.value.name} is now ${endorsement.value}`);
}

async function share() {
  if (await exec(cli(['fab', 'acl', 'set', path.value], { '-I': shareWho.value.trim(), '-R': sharePerms.value.join(',') }),
    `Shared ${item.value.name} with ${shareWho.value.trim()}`)) {
    shareWho.value = '';
    sharePerms.value = ['Read'];
  }
}

async function unshare(principal: string) {
  await exec(cli(['fab', 'acl', 'rm', path.value], { '-I': principal }), `Removed access for ${principal}`);
}

async function applySchedule() {
  const flags: Record<string, string> = { '--type': repeat.value };
  if (repeat.value === 'cron') flags['--interval'] = String(interval.value);
  else flags['--times'] = times.value.split(',').map(t => t.trim()).filter(Boolean).join(',');
  await exec(cli(['fab', 'job', 'run-sch', path.value], flags), 'Schedule saved');
}

async function toggleSchedule() {
  const on = schedule.value?.enabled;
  await exec(cli(['fab', 'job', 'run-update', path.value], on ? { '--disable': true } : { '--enable': true }),
    on ? 'Schedule turned off' : 'Schedule turned on');
}

async function removeSchedule() {
  await exec(cli(['fab', 'job', 'run-rm', path.value]), 'Schedule removed');
}

void emit;
</script>

<style scoped>
.is-sub { display: flex; align-items: center; gap: 6px; margin: -6px 0 12px; font-size: 13px; }
.is-first { margin-top: 0; }
.is-p { margin: 0 0 12px; color: #424242; }
.is-actions { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
</style>
