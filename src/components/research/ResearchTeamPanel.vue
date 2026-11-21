<template>
  <div class="rf-section rf-detail-team rtp">
    <h2 class="rf-section-title">{{ $t('Team Members ({v0})', { v0: team.length }) }}</h2>
    <p class="rtp-note">{{ $t('Owner: everything. Admin: manages members and all files. Editor: uploads and edits own files. Viewer: reads and downloads.') }}</p>

    <ul v-if="team.length" class="rtp-list">
      <li v-for="m in team" :key="m.id" class="rtp-row">
        <span class="rtp-user">{{ m.user_id === userId ? $t('You') : m.user_id }}</span>
        <select v-if="canManage && m.role !== 'owner' && !(myRole === 'admin' && m.role === 'admin')"
                class="rf-input rtp-role" :value="normRole(m.role)"
                :aria-label="$t('Role for {v0}', { v0: m.user_id })" @change="setRole(m.user_id, ($event.target as HTMLSelectElement).value)">
          <option v-if="myRole === 'owner'" value="admin">{{ $t('Admin') }}</option>
          <option value="editor">{{ $t('Editor') }}</option>
          <option value="viewer">{{ $t('Viewer') }}</option>
        </select>
        <span v-else class="rf-badge">{{ normRole(m.role) }}</span>
        <button v-if="canManage && m.role !== 'owner' && m.user_id !== userId" class="rf-btn rf-btn-xs rf-btn-danger"
                @click="remove(m.user_id)">{{ $t('Remove') }}</button>
      </li>
    </ul>
    <div v-else class="rf-empty-sm"><p>{{ $t('No team members.') }}</p></div>

    <div v-if="canManage" class="rtp-add">
      <input v-model="newMember" class="rf-input" :placeholder="$t('Username or user id')" />
      <select v-model="newRole" class="rf-input">
        <option v-if="myRole === 'owner'" value="admin">{{ $t('Admin') }}</option>
        <option value="editor">{{ $t('Editor') }}</option>
        <option value="viewer">{{ $t('Viewer') }}</option>
      </select>
      <button class="rf-btn rf-btn-primary" :disabled="!newMember.trim() || busy" @click="add">{{ $t('Add member') }}</button>
    </div>
    <p v-if="error" class="rtp-error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
/** Project members and roles (app 28 /projects/<id>/team/; rules in utils/projectaccess.py). */
import { computed, ref } from 'vue';
import { researchService, type TeamMember } from '@/services/research.service';
import { useAuthStore } from '@/store/auth';

const props = defineProps<{ projectId: string; userId: string; team: TeamMember[]; myRole: string }>();
const emit = defineEmits<{ (e: 'changed'): void }>();
const auth = useAuthStore();

const canManage = computed(() => props.myRole === 'owner' || props.myRole === 'admin');
const newMember = ref('');
const newRole = ref('editor');
const busy = ref(false);
const error = ref('');

function normRole(role: string) { return role === 'collaborator' ? 'editor' : role; }

async function resolve(input: string): Promise<string> {
  const text = input.trim();
  if (/^[0-9a-f-]{20,}$/i.test(text)) return text;
  const profile: any = await auth.getUserProfileByUsername(text.replace(/^@/, ''));
  const id = profile?.user_id || profile?.id;
  if (!id) throw new Error('No user with that username.');
  return String(id);
}

async function add() {
  busy.value = true; error.value = '';
  try {
    const id = await resolve(newMember.value);
    await researchService.addTeamMember(props.projectId, props.userId, id, newRole.value);
    newMember.value = '';
    emit('changed');
  } catch (e: any) { error.value = e?.message || 'Could not add the member'; }
  finally { busy.value = false; }
}

async function setRole(memberId: string, role: string) {
  error.value = '';
  try { await researchService.addTeamMember(props.projectId, props.userId, memberId, role); emit('changed'); }
  catch (e: any) { error.value = e?.message || 'Could not change the role'; }
}

async function remove(memberId: string) {
  if (!confirm('Remove this member from the project?')) return;
  try { await researchService.removeTeamMember(props.projectId, props.userId, memberId); emit('changed'); }
  catch (e: any) { error.value = e?.message || 'Could not remove the member'; }
}
</script>

<style scoped>
.rtp-note { margin: 0 0 0.75rem; font-size: 0.88rem; color: var(--sfs-text-muted, #b8bdd8); }
.rtp-list { list-style: none; padding: 0; margin: 0 0 0.75rem; display: grid; gap: 0.4rem; }
.rtp-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.rtp-user { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; font-family: var(--font-mono, monospace); font-size: 0.85rem; }
.rtp-role { width: auto; min-width: 8rem; }
.rtp-add { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.rtp-add .rf-input { flex: 1 1 12rem; }
.rtp-error { color: var(--sfs-danger-text, #f87171); }
</style>
