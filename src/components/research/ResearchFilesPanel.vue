<template>
  <div class="rf-section rf-detail-files rfp">
    <h2 class="rf-section-title">{{ $t('Research Files ({v0})', { v0: files.length }) }}</h2>
    <p class="rfp-note">{{ $t('Share any file - code, documents, data, images or archives. Files are stored safely in GitHub, and the AI can read them.') }}</p>

    <!-- Upload: owner, admins and editors -->
    <div v-if="canUpload" class="rfp-box">
      <h3>{{ $t('Upload a file') }}</h3>
      <input type="file" class="rf-input" :aria-label="$t('Choose a file')" @change="onPick" />
      <input v-model="desc" class="rf-input" :placeholder="$t('File description')" />
      <input v-model="version" class="rf-input" :placeholder="$t('Version (e.g., v1.0)')" />
      <label class="rfp-field">
        <span>{{ $t('Who can see it') }}</span>
        <select v-model="uploadMode" class="rf-input">
          <option value="project">{{ $t('Everyone in the project') }}</option>
          <option value="restricted">{{ $t('Only me, the project admins, and people I choose') }}</option>
        </select>
      </label>
      <button class="rf-btn rf-btn-primary" :disabled="!picked || busy" @click="upload">
        {{ busy ? $t('Uploading...') : $t('Upload') }}
      </button>
      <p v-if="error" class="rfp-error" role="alert">{{ error }}</p>
    </div>

    <div v-if="!files.length" class="rf-empty-sm"><p>{{ $t('No files uploaded yet.') }}</p></div>
    <ul v-else class="rfp-list">
      <li v-for="file in files" :key="file.id" class="rfp-file">
        <label class="rfp-pick" :title="$t('Include in the AI question')">
          <input type="checkbox" :checked="chosen.has(file.id)" @change="toggle(file.id)" />
        </label>
        <div class="rfp-info">
          <strong class="rfp-name">{{ file.original_filename }}</strong>
          <span class="rfp-meta">
            {{ size(file.file_size) }} · {{ file.file_type }} · {{ file.version }} ·
            {{ $t('owner') }}: {{ who(file.access?.owner_id || file.uploaded_by) }} ·
            <span :class="['rfp-mode', file.access?.mode === 'restricted' ? 'is-locked' : '']">
              {{ file.access?.mode === 'restricted' ? $t('Restricted') : $t('Project') }}
            </span>
          </span>
          <span v-if="file.description" class="rfp-desc">{{ file.description }}</span>
        </div>
        <div class="rfp-actions">
          <button class="rf-btn rf-btn-xs rf-btn-secondary" @click="download(file)">{{ $t('Download') }}</button>
          <button v-if="file.can_share" class="rf-btn rf-btn-xs rf-btn-outline" @click="openShare(file)">{{ $t('Share') }}</button>
          <button v-if="file.can_delete" class="rf-btn rf-btn-xs rf-btn-danger" @click="remove(file)">{{ $t('Delete') }}</button>
        </div>

        <!-- Per-file sharing -->
        <div v-if="sharing === file.id" class="rfp-share">
          <label class="rfp-field">
            <span>{{ $t('Who can see it') }}</span>
            <select v-model="shareMode" class="rf-input">
              <option value="project">{{ $t('Everyone in the project') }}</option>
              <option value="restricted">{{ $t('Only the people below (and the project admins)') }}</option>
            </select>
          </label>
          <table class="rfp-table">
            <tbody>
              <tr v-for="m in others(file)" :key="m.user_id">
                <td>{{ who(m.user_id) }} <small>({{ m.role }})</small></td>
                <td>
                  <select v-model="shareUsers[m.user_id]" class="rf-input" :aria-label="$t('Access for {v0}', { v0: who(m.user_id) })">
                    <option value="">{{ $t('No extra access') }}</option>
                    <option value="viewer">{{ $t('Can view') }}</option>
                    <option value="editor">{{ $t('Can edit') }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="rfp-actions">
            <button class="rf-btn rf-btn-xs rf-btn-primary" @click="saveShare(file)">{{ $t('Save') }}</button>
            <button class="rf-btn rf-btn-xs rf-btn-secondary" @click="sharing = ''">{{ $t('Cancel') }}</button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Ask the AI about the files -->
    <div v-if="files.length" class="rfp-box rfp-ask">
      <h3>{{ $t('Ask the AI about these files') }}</h3>
      <p class="rfp-note">{{ chosen.size ? $t('Using the {v0} ticked files.', { v0: chosen.size }) : $t('Using every file you can see. Tick files above to narrow it.') }}</p>
      <textarea v-model="question" class="rf-textarea" rows="3" :placeholder="$t('e.g. Is there a bug in calc.py? Summarise the methods section.')"></textarea>
      <button class="rf-btn rf-btn-primary" :disabled="asking || question.trim().length < 3" @click="ask">
        {{ asking ? $t('Thinking...') : $t('Ask') }}
      </button>
      <div v-if="answer" class="rfp-answer">
        <p v-for="(line, i) in answer.split('\n')" :key="i">{{ line }}</p>
        <small v-if="unread.length">{{ $t('Not readable by the AI: {v0}', { v0: unread.join(', ') }) }}</small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ResearchFlow project files (2026-11-21): any format, stored in GitHub by app 28,
 * shared per file (access JSON: owner, mode, users), and readable by the AI.
 * Rules live in app 28's utils/projectaccess.py; the server answers can_* per file.
 * Text only - nothing here reaches v-html (an AI answer and file names are untrusted).
 */
import { computed, reactive, ref, watch } from 'vue';
import { researchService, type ResearchFile, type TeamMember } from '@/services/research.service';

const props = defineProps<{ projectId: string; userId: string; files: ResearchFile[];
  team: TeamMember[]; myRole: string }>();
const emit = defineEmits<{ (e: 'changed'): void }>();

const canUpload = computed(() => ['owner', 'admin', 'editor', 'collaborator'].includes(props.myRole));
const picked = ref<File | null>(null);
const desc = ref('');
const version = ref('v1.0');
const uploadMode = ref<'project' | 'restricted'>('project');
const busy = ref(false);
const error = ref('');
const chosen = ref(new Set<string>());
const sharing = ref('');
const shareMode = ref<'project' | 'restricted'>('project');
const shareUsers = reactive<Record<string, string>>({});
const question = ref('');
const answer = ref('');
const unread = ref<string[]>([]);
const asking = ref(false);

watch(() => props.files, (list) => {
  const ids = new Set(list.map(f => f.id));
  chosen.value = new Set([...chosen.value].filter(id => ids.has(id)));
});

function who(id?: string) {
  if (!id) return '?';
  return id === props.userId ? 'you' : id.slice(0, 10) + (id.length > 10 ? '…' : '');
}
function size(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}
function onPick(e: Event) { picked.value = (e.target as HTMLInputElement).files?.[0] || null; }
function toggle(id: string) {
  const next = new Set(chosen.value);
  next.has(id) ? next.delete(id) : next.add(id);
  chosen.value = next;
}
function others(file: ResearchFile) {
  const owner = file.access?.owner_id || file.uploaded_by;
  return props.team.filter(m => m.user_id !== owner);
}

async function upload() {
  if (!picked.value) return;
  busy.value = true; error.value = '';
  try {
    await researchService.uploadFile(props.projectId, props.userId, picked.value, desc.value, version.value,
      { mode: uploadMode.value, users: {} });
    picked.value = null; desc.value = ''; version.value = 'v1.0';
    emit('changed');
  } catch (e: any) {
    error.value = e?.message || 'Upload failed';
  } finally { busy.value = false; }
}

async function download(file: ResearchFile) {
  try { await researchService.downloadFile(file.id, props.userId, file.original_filename); }
  catch (e: any) { alert(e?.message || 'Download failed'); }
}

function openShare(file: ResearchFile) {
  sharing.value = file.id;
  shareMode.value = file.access?.mode || 'project';
  for (const key of Object.keys(shareUsers)) delete shareUsers[key];
  for (const m of others(file)) shareUsers[m.user_id] = file.access?.users?.[m.user_id] || '';
}

async function saveShare(file: ResearchFile) {
  const users: Record<string, 'viewer' | 'editor'> = {};
  for (const [id, grant] of Object.entries(shareUsers)) if (grant === 'viewer' || grant === 'editor') users[id] = grant;
  try {
    await researchService.setFileAccess(file.id, props.userId, { mode: shareMode.value, users });
    sharing.value = '';
    emit('changed');
  } catch (e: any) { alert(e?.message || 'Could not save the sharing'); }
}

async function remove(file: ResearchFile) {
  if (!confirm(`Delete ${file.original_filename}?`)) return;
  try { await researchService.deleteFile(file.id, props.userId); emit('changed'); }
  catch (e: any) { alert(e?.message || 'Could not delete the file'); }
}

async function ask() {
  asking.value = true; answer.value = ''; unread.value = [];
  try {
    const res = await researchService.askAboutFiles(props.projectId, props.userId, question.value.trim(), [...chosen.value]);
    answer.value = res.answer || '';
    unread.value = (res.files || []).filter(f => !f.readable).map(f => f.name);
  } catch (e: any) {
    answer.value = e?.message || 'The AI could not answer right now.';
  } finally { asking.value = false; }
}
</script>

<style scoped>
.rfp-note { margin: 0 0 0.75rem; color: var(--rf-text-muted, var(--sfs-text-muted, #b8bdd8)); font-size: 0.9rem; }
.rfp-box { display: grid; gap: 0.5rem; padding: 0.9rem; margin-bottom: 1rem; border-radius: 0.75rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.16); }
.rfp-box h3 { margin: 0; font-size: 1rem; }
.rfp-field { display: grid; gap: 0.25rem; font-size: 0.85rem; }
.rfp-error { color: var(--sfs-danger-text, #f87171); margin: 0; }
.rfp-list { list-style: none; margin: 0 0 1rem; padding: 0; display: grid; gap: 0.6rem; }
.rfp-file { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 0.6rem; align-items: start;
  padding: 0.7rem; border-radius: 0.75rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05); }
.rfp-info { display: grid; gap: 0.15rem; min-width: 0; }
.rfp-name { overflow-wrap: anywhere; }
.rfp-meta, .rfp-desc { font-size: 0.82rem; color: var(--sfs-text-muted, #b8bdd8); overflow-wrap: anywhere; }
.rfp-mode.is-locked { font-weight: 600; }
.rfp-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.rfp-share { grid-column: 1 / -1; display: grid; gap: 0.5rem; padding-top: 0.5rem;
  border-top: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.12); }
.rfp-table { width: 100%; border-collapse: collapse; }
.rfp-table td { padding: 0.25rem 0.4rem; vertical-align: middle; overflow-wrap: anywhere; }
.rfp-answer { padding: 0.75rem; border-radius: 0.6rem; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  white-space: pre-wrap; overflow-wrap: anywhere; unicode-bidi: plaintext; }
.rfp-answer p { margin: 0 0 0.35rem; }
@media (max-width: 560px) {
  .rfp-file { grid-template-columns: auto minmax(0, 1fr); }
  .rfp-actions { grid-column: 1 / -1; }
}
</style>
