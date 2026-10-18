<template>
  <div class="jk-cr">
    <!-- ===== List: System › Global credentials (unrestricted) ===== -->
    <template v-if="r.page === 'credentials'">
      <div class="jk-app-bar">
        <h1 class="jk-h1">Global credentials (unrestricted)</h1>
        <button type="button" class="jk-btn jk-btn--primary" @click="ctx.go({ page: 'credentialNew' })"><JkIcon name="plus" />Add Credentials</button>
      </div>
      <p class="jk-muted jk-cr__lead">Credentials that should be available irrespective of domain specification to requirements matching.</p>
      <div v-if="!list.length" class="jk-empty">
        This credential domain is empty. How about <button type="button" class="jk-link" @click="ctx.go({ page: 'credentialNew' })">adding some credentials</button>?
      </div>
      <div v-else class="jk-table-wrap">
        <table class="jk-table">
          <thead><tr><th class="is-center">T</th><th>ID</th><th>Name</th><th>Kind</th><th>Description</th><th></th></tr></thead>
          <tbody>
            <tr v-for="cred in list" :key="cred.id">
              <td class="is-center"><JkIcon :name="cred.kind === 'username_password' ? 'user' : 'key'" /></td>
              <td><button type="button" class="jk-link jk-cr__id" @click="ctx.go({ page: 'credential', id: cred.id })">{{ cred.id }}</button></td>
              <td>{{ nameOf(cred) }}</td>
              <td>{{ KIND[cred.kind] || cred.kind }}</td>
              <td>{{ cred.description }}</td>
              <td class="is-center">
                <button type="button" class="jk-cr__icon-btn" :aria-label="'Update ' + cred.id" title="Update" @click="ctx.go({ page: 'credential', id: cred.id })"><JkIcon name="pencil" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ===== New / update ===== -->
    <form v-else class="jk-cr__form" @submit.prevent="submit">
      <h1 class="jk-h1">{{ isNew ? 'New credentials' : 'Update credentials' }}</h1>
      <div v-if="!isNew && !existing" class="jk-alert jk-alert--danger">No such credential ‘{{ r.id }}’.</div>
      <template v-else>
        <div class="jk-field">
          <label class="jk-label" for="jk-cr-kind">Kind</label>
          <select id="jk-cr-kind" v-model="kind" class="jk-select" :disabled="!isNew">
            <option value="username_password">Username with password</option>
            <option value="secret_text">Secret text</option>
          </select>
        </div>
        <div class="jk-field">
          <label class="jk-label">Scope</label>
          <select class="jk-select" disabled><option>Global (Jenkins, nodes, items, all child items, etc)</option></select>
        </div>
        <template v-if="kind === 'username_password'">
          <div class="jk-field">
            <label class="jk-label" for="jk-cr-user">Username</label>
            <input id="jk-cr-user" v-model="username" class="jk-input" type="text" autocomplete="off" />
            <p v-if="tried && !username.trim()" class="jk-error">Username cannot be empty</p>
          </div>
          <label class="jk-check is-off"><input type="checkbox" disabled /> Treat username as secret</label>
        </template>
        <div class="jk-field">
          <label class="jk-label" for="jk-cr-secret">{{ kind === 'username_password' ? 'Password' : 'Secret' }}</label>
          <input id="jk-cr-secret" v-model="secret" class="jk-input" type="password" autocomplete="new-password"
                 :placeholder="isNew ? '' : 'Concealed for Confidentiality'" />
          <p v-if="!isNew" class="jk-help">Leave blank to keep the current value.</p>
          <p v-if="tried && isNew && !secret" class="jk-error">{{ kind === 'username_password' ? 'Password' : 'Secret' }} cannot be empty</p>
        </div>
        <div class="jk-field">
          <label class="jk-label" for="jk-cr-id">ID</label>
          <input id="jk-cr-id" v-model="id" class="jk-input" type="text" :readonly="!isNew" autocomplete="off" />
          <p v-if="idProblem" class="jk-error">{{ idProblem }}</p>
          <p v-else-if="isNew" class="jk-help">An internal unique ID by which these credentials are identified from jobs and other configuration. Normally left blank, in which case an ID will be generated.</p>
        </div>
        <div class="jk-field">
          <label class="jk-label" for="jk-cr-desc">Description</label>
          <input id="jk-cr-desc" v-model="description" class="jk-input" type="text" />
        </div>
        <div class="jk-bottom-bar">
          <button type="submit" class="jk-btn jk-btn--primary" :disabled="busy">{{ isNew ? 'Create' : 'Save' }}</button>
          <button v-if="!isNew" type="button" class="jk-btn jk-btn--text-danger" :disabled="busy" @click="remove"><JkIcon name="trash" />Delete</button>
          <button type="button" class="jk-btn" @click="ctx.go({ page: 'credentials' })">Cancel</button>
        </div>
      </template>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import JkIcon from './JkIcon.vue';
import { useJk } from './jkContext';
import { jcli, uuid, type Credential } from './jenkinsKit';

const ctx = useJk();
const r = computed(() => ctx.route.value as any);
const list = computed(() => ctx.credentials.value);
const isNew = computed(() => r.value.page === 'credentialNew');
const existing = computed(() => list.value.find(c => c.id === r.value.id));
const KIND: Record<string, string> = { username_password: 'Username with password', secret_text: 'Secret text' };

const kind = ref(existing.value?.kind || 'username_password');
const username = ref(existing.value?.username || '');
const secret = ref('');
const id = ref(existing.value?.id || '');
const description = ref(existing.value?.description || '');
const tried = ref(false);
const busy = ref(false);

function nameOf(cred: Credential): string {
  const desc = cred.description ? ` (${cred.description})` : '';
  return cred.kind === 'username_password' ? `${cred.username || '?'}/******${desc}` : `${cred.description || cred.id}`;
}

const idProblem = computed(() => {
  if (!isNew.value) return '';
  const text = id.value.trim();
  if (!text) return '';
  if (!/^[A-Za-z0-9_.-]+$/.test(text)) return 'Unacceptable characters';
  if (list.value.some(c => c.id === text)) return 'This ID is already in use';
  return '';
});

async function submit() {
  tried.value = true;
  if (kind.value === 'username_password' && !username.value.trim()) return;
  if (isNew.value && (!secret.value || idProblem.value)) return;
  if (secret.value.startsWith('-')) {
    ctx.notify('error', 'The secret cannot start with “-” in the lab CLI', 'It would be read as an option.');
    return;
  }
  busy.value = true;
  try {
    if (isNew.value) {
      const cid = id.value.trim() || uuid();
      const flags: Record<string, string> = {};
      if (kind.value === 'username_password') flags['--username'] = username.value.trim();
      if (description.value.trim()) flags['--description'] = description.value.trim();
      const result = await ctx.run(jcli(['create-credential', cid, secret.value], flags), { success: `Created credential ‘${cid}’` });
      if (result.ok) ctx.go({ page: 'credentials' });
    } else {
      const flags: Record<string, string> = {};
      if (kind.value === 'username_password' && username.value.trim() !== existing.value?.username) flags['--username'] = username.value.trim();
      if (description.value !== (existing.value?.description || '')) flags['--description'] = description.value;
      const words = ['update-credential', r.value.id];
      if (secret.value) words.push(secret.value);
      // An emptied description has to be sent explicitly; cli() would drop ''.
      const command = description.value === '' && existing.value?.description
        ? jcli([...words, '--description', ''], flags['--username'] ? { '--username': flags['--username'] } : {})
        : jcli(words, flags);
      const result = await ctx.run(command, { success: 'Saved' });
      if (result.ok) ctx.go({ page: 'credentials' });
    }
  } finally {
    busy.value = false;
  }
}

// Opening the store is what `jenkins-cli list-credentials` does, and the lab's
// "list the store" task looks for that command.
onMounted(() => {
  if (r.value.page === 'credentials') void ctx.run(jcli(['list-credentials']), { quiet: true, unlogged: true });
});

async function remove() {
  const ok = await ctx.confirm({
    title: `Delete credentials ‘${r.value.id}’?`,
    message: 'Any job that binds these credentials will fail with "Could not find credentials entry".',
    yes: 'Yes', destructive: true,
  });
  if (!ok) return;
  const result = await ctx.run(jcli(['delete-credentials', 'system::system::jenkins', '_', r.value.id]),
                               { success: `Deleted credential ‘${r.value.id}’` });
  if (result.ok) ctx.go({ page: 'credentials' });
}
</script>

<style scoped>
.jk-cr { max-width: 1120px; }
.jk-cr__lead { margin: -8px 0 16px; }
.jk-cr__id { font-weight: 600; }
.jk-cr__form { max-width: 704px; }
.jk-cr__icon-btn { display: inline-flex; padding: 4.8px; border: 0; border-radius: 8px; background: none; color: var(--jk-text); cursor: pointer; }
.jk-cr__icon-btn:hover { background: var(--jk-btn-hover); }
.jk-cr__icon-btn .jk-icon { width: 16px; height: 16px; }
.jk-check.is-off { color: var(--jk-secondary); cursor: not-allowed; }
</style>
