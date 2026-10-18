<template>
  <FxPanel title="Manage access" width="520px" @close="$emit('close')">
    <div v-if="error" class="fx-msgbar fx-msgbar--error"><FxIcon name="error" /><span>{{ error }}</span></div>
    <template v-if="!adding">
      <button type="button" class="fx-btn fx-btn--primary ma-add" @click="adding = true">
        <FxIcon name="plus" />Add people or groups</button>
      <div class="fx-input fx-input--search ma-search">
        <FxIcon name="search" :size="14" />
        <input v-model="filter" placeholder="Search by name or email" aria-label="Search people" />
      </div>
      <div class="ma-count fx-muted">People and groups with access ({{ list.length }})</div>
      <ul class="ma-list">
        <li v-for="r in shown" :key="r.principal + ':' + ver" class="ma-row">
          <span class="fx-avatar fx-avatar--lg" :style="{ background: avatarColor(r.principal) }">
            <FxIcon v-if="r.kind === 'Group'" name="people" :size="18" />
            <template v-else>{{ initials(r.principal) }}</template>
          </span>
          <div class="ma-who">
            <div class="fx-strong">{{ displayName(r.principal, principals) }}</div>
            <div class="fx-muted ma-mail">{{ r.principal }} · {{ r.kind }}</div>
          </div>
          <select class="fx-select ma-role" :value="r.role" :aria-label="'Role for ' + r.principal"
                  @change="changeRole(r.principal, ($event.target as HTMLSelectElement).value)">
            <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
            <option value="__remove">Remove</option>
          </select>
        </li>
      </ul>
    </template>
    <template v-else>
      <button type="button" class="fx-link ma-back" @click="adding = false">← Back</button>
      <h3 class="fx-h3">Add people or groups</h3>
      <div class="fx-field">
        <label for="ma-who">Enter name or email<span class="fx-field__req">*</span></label>
        <input id="ma-who" v-model="who" class="fx-input" list="ma-people" autocomplete="off"
               placeholder="e.g. sg-data-engineers" />
        <datalist id="ma-people">
          <option v-for="p in candidates" :key="p.name" :value="p.name">{{ p.display }}</option>
        </datalist>
        <span class="fx-field__help">Grant roles to security groups rather than to individuals.</span>
      </div>
      <div class="fx-field">
        <span class="fx-field__label">Role</span>
        <select v-model="role" class="fx-select" aria-label="Role">
          <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
        </select>
        <span class="fx-field__help">{{ roleHelp[role] }}</span>
      </div>
      <div class="ma-actions">
        <button type="button" class="fx-btn fx-btn--primary" :disabled="!who.trim()" @click="add">Add</button>
        <button type="button" class="fx-btn" @click="adding = false">Cancel</button>
      </div>
    </template>
  </FxPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FxPanel from './FxPanel.vue';
import FxIcon from './FxIcon.vue';
import { avatarColor, cli, displayName, errorText, initials, rows, useFabric, wsPath } from './fabric';

const props = defineProps<{ ws: string }>();
defineEmits<{ (event: 'close'): void }>();
const { portal, run } = useFabric();

const roles = ['Admin', 'Member', 'Contributor', 'Viewer'];
const roleHelp: Record<string, string> = {
  Admin: 'Full control, including managing access and deleting the workspace.',
  Member: 'Can add others with lower permissions, share and edit everything.',
  Contributor: 'Can create, edit and delete content, but can\'t manage access.',
  Viewer: 'Can view content and read data, but can\'t edit.',
};
const adding = ref(false);
const who = ref('');
const role = ref('Viewer');
const filter = ref('');
const error = ref('');
const ver = ref(0);
const principals = computed(() => rows(portal.value, 'principals'));
const list = computed(() => rows(portal.value, 'workspaces').find(w => w.name === props.ws)?.roles || []);
const shown = computed(() => list.value.filter((r: any) => !filter.value
  || String(r.principal).toLowerCase().includes(filter.value.toLowerCase())));
const candidates = computed(() => principals.value.filter(p => !list.value.some((r: any) => r.principal === p.name)));

async function exec(command: string, success: string) {
  error.value = '';
  const result = await run(command, success, { quiet: true });
  if (!result.ok) { error.value = errorText(result); ver.value += 1; }
  return result.ok;
}

async function add() {
  const principal = who.value.trim();
  if (await exec(cli(['fab', 'acl', 'set', wsPath(props.ws)], { '-I': principal, '-R': role.value }),
    `Added ${principal} as ${role.value}`)) {
    who.value = '';
    adding.value = false;
  }
}

async function changeRole(principal: string, value: string) {
  if (value === '__remove') {
    await exec(cli(['fab', 'acl', 'rm', wsPath(props.ws)], { '-I': principal }), `Removed ${principal}`);
    return;
  }
  await exec(cli(['fab', 'acl', 'set', wsPath(props.ws)], { '-I': principal, '-R': value }),
    `${principal} is now ${value}`);
}
</script>

<style scoped>
.ma-add { margin-bottom: 12px; }
.ma-search { margin-bottom: 8px; }
.ma-count { font-size: 12px; margin: 8px 0; }
.ma-list { list-style: none; margin: 0; padding: 0; }
.ma-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.ma-who { flex: 1; min-width: 0; }
.ma-mail { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ma-role { width: 130px; }
.ma-back { margin-bottom: 4px; }
.ma-actions { display: flex; gap: 8px; }
</style>
