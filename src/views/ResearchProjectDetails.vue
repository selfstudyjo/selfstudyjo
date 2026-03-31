<template>
  <div class="research-project-details-page">
    <div class="rf-page-header">
      <button class="rf-back-btn" @click="$router.back()"><RfIconBack /> Back</button>
      <h1 class="rf-page-title"><RfIconFile /> Project Details</h1>
      <span v-if="userRole" :class="['rf-role-badge', `rf-role-${userRole}`]">
        <template v-if="userRole === 'owner'"><RfIconCrown /> Owner</template>
        <template v-else-if="userRole === 'collaborator'"><RfIconEdit /> Editor</template>
        <template v-else><RfIconEye /> Viewer</template>
      </span>
    </div>

    <div v-if="loading" class="rf-loading">
      <div class="rf-spinner"></div>
      <p>Loading project...</p>
    </div>

    <div v-else-if="!project" class="rf-empty">
      <p>Project not found or you don't have access.</p>
      <button class="rf-btn rf-btn-primary" @click="$router.push('/research')">Back to Research Flow</button>
    </div>

    <div v-else class="rf-detail-layout">
      <!-- Project Info -->
      <div class="rf-section rf-detail-info">
        <div class="rf-detail-header">
          <h2>{{ project.title }}</h2>
          <div class="rf-detail-badges">
            <span :class="['rf-badge', `rf-badge-${project.status}`]">{{ formatStatus(project.status) }}</span>
            <span :class="['rf-access-badge', `rf-access-${project.access_level}`]">{{ project.access_level }}</span>
          </div>
        </div>
        <p class="rf-detail-desc">{{ project.description }}</p>
        <div class="rf-detail-meta-grid">
          <div class="rf-meta-item" v-if="project.publication_year"><strong>Year:</strong> {{ project.publication_year }}</div>
          <div class="rf-meta-item" v-if="project.venue"><strong>Venue:</strong> {{ project.venue }}</div>
          <div class="rf-meta-item" v-if="project.doi"><strong>DOI:</strong> {{ project.doi }}</div>
          <div class="rf-meta-item"><strong>Views:</strong> {{ project.views }}</div>
          <div class="rf-meta-item"><strong>Downloads:</strong> {{ project.downloads }}</div>
          <div class="rf-meta-item"><strong>Citations:</strong> {{ project.citation_count }}</div>
          <div class="rf-meta-item"><strong>Created:</strong> {{ formatDate(project.created_at) }}</div>
        </div>
        <div class="rf-keywords" v-if="project.keywords?.length">
          <span v-for="kw in project.keywords" :key="kw" class="rf-keyword-badge">{{ kw }}</span>
        </div>

        <div v-if="canEdit" class="rf-edit-section">
          <button v-if="!showEditForm" class="rf-btn rf-btn-primary" @click="openEditForm"><RfIconEdit /> Edit Project</button>
          <div v-if="showEditForm" class="rf-edit-form">
            <h3>Edit Project</h3>
            <div class="rf-form-group">
              <label class="rf-label">Title</label>
              <input v-model="editForm.title" class="rf-input" placeholder="Title" />
            </div>
            <div class="rf-form-group">
              <label class="rf-label">Description</label>
              <textarea v-model="editForm.description" class="rf-textarea" placeholder="Description" rows="4"></textarea>
            </div>
            <div class="rf-form-row">
              <div class="rf-form-group">
                <label class="rf-label">Publication Year</label>
                <input v-model.number="editForm.publication_year" class="rf-input" type="number" placeholder="Year" />
              </div>
              <div class="rf-form-group">
                <label class="rf-label">Venue</label>
                <input v-model="editForm.venue" class="rf-input" placeholder="Venue/Journal" />
              </div>
            </div>
            <div class="rf-form-group">
              <label class="rf-label">DOI</label>
              <input v-model="editForm.doi" class="rf-input" placeholder="DOI" />
            </div>
            <div class="rf-form-group">
              <label class="rf-label">Keywords (comma separated)</label>
              <input v-model="editForm.keywordsStr" class="rf-input" placeholder="Keywords" />
            </div>
            <div class="rf-form-row">
              <div class="rf-form-group">
                <label class="rf-label">Access Level</label>
                <select v-model="editForm.access_level" class="rf-select">
                  <option value="public">Public</option>
                  <option value="team">Team</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div class="rf-form-group">
                <label class="rf-label">Status</label>
                <select v-model="editForm.status" class="rf-select">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="under_review">Under Review</option>
                </select>
              </div>
            </div>
            <div class="rf-edit-actions">
              <button class="rf-btn rf-btn-primary" @click="saveEdit" :disabled="saving">{{ saving ? 'Saving...' : 'Save Changes' }}</button>
              <button class="rf-btn rf-btn-secondary" @click="showEditForm = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Files -->
      <div class="rf-section rf-detail-files">
        <h2 class="rf-section-title"><RfIconFile /> Research Files ({{ files.length }})</h2>

        <div v-if="canEdit" class="rf-upload-form">
          <h3><RfIconUpload /> Upload New File</h3>
          <input type="file" ref="fileInputRef" class="rf-input" @change="onFileSelect" />
          <input v-model="uploadDesc" class="rf-input" placeholder="File description" style="margin-top: 8px;" />
          <input v-model="uploadVersion" class="rf-input" placeholder="Version (e.g., v1.0)" style="margin-top: 8px;" />
          <button class="rf-btn rf-btn-primary" @click="doUpload" :disabled="!selectedFile || uploading" style="margin-top: 8px;">
            {{ uploading ? 'Uploading...' : 'Upload File' }}
          </button>
        </div>

        <div v-if="files.length === 0" class="rf-empty-sm"><p>No files uploaded yet.</p></div>
        <div v-else class="rf-files-list">
          <div v-for="file in files" :key="file.id" class="rf-file-card">
            <div class="rf-file-info">
              <span class="rf-file-name"><RfIconAttach /> {{ file.original_filename }}</span>
              <span class="rf-file-meta">{{ formatFileSize(file.file_size) }} | {{ file.file_type }} | {{ file.version }}</span>
              <span class="rf-file-desc" v-if="file.description">{{ file.description }}</span>
            </div>
            <div class="rf-file-actions" v-if="canViewFiles">
              <button class="rf-btn rf-btn-xs rf-btn-primary" @click="openFileInNewTab(file)"><RfIconLink /> Open</button>
              <button class="rf-btn rf-btn-xs rf-btn-secondary" @click="downloadFileToDevice(file)"><RfIconDownload /> Download</button>
              <button v-if="canEdit" class="rf-btn rf-btn-xs rf-btn-danger" @click="removeFile(file.id)"><RfIconDelete /></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Comments -->
      <div class="rf-section rf-detail-comments">
        <h2 class="rf-section-title"><RfIconComment /> Comments ({{ comments.length }})</h2>

        <div v-if="canComment" class="rf-comment-form">
          <textarea v-model="newComment" class="rf-textarea" placeholder="Add a comment..." rows="3"></textarea>
          <button class="rf-btn rf-btn-primary" @click="postComment" :disabled="!newComment.trim()" style="margin-top: 8px;">Post Comment</button>
        </div>

        <div v-if="comments.length === 0" class="rf-empty-sm"><p>No comments yet. Be the first to comment!</p></div>
        <div v-else class="rf-comments-list">
          <div v-for="comment in comments" :key="comment.id" class="rf-comment-card">
            <div class="rf-comment-header">
              <span class="rf-comment-author">{{ comment.author_id === userId ? 'You' : comment.author_id.substring(0, 8) + '...' }}</span>
              <span class="rf-comment-date">{{ formatDate(comment.created_at) }}</span>
            </div>
            <div v-if="editingCommentId === comment.id" class="rf-comment-edit">
              <textarea v-model="editCommentText" class="rf-textarea" rows="2"></textarea>
              <div class="rf-comment-edit-actions">
                <button class="rf-btn rf-btn-xs rf-btn-primary" @click="saveCommentEdit(comment.id)">Save</button>
                <button class="rf-btn rf-btn-xs rf-btn-secondary" @click="editingCommentId = ''">Cancel</button>
              </div>
            </div>
            <div v-else>
              <p class="rf-comment-text">{{ comment.content }}</p>
              <div v-if="comment.author_id === userId" class="rf-comment-actions">
                <button class="rf-btn rf-btn-xs rf-btn-outline" @click="startEditComment(comment)"><RfIconEdit /> Edit</button>
                <button class="rf-btn rf-btn-xs rf-btn-danger" @click="removeComment(comment.id)"><RfIconDelete /> Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Request Collaboration -->
      <div v-if="showCollabSection" class="rf-section rf-detail-collab">
        <h2 class="rf-section-title"><RfIconCollab /> Request Collaboration</h2>
        <p style="margin-bottom: 10px; color: var(--rf-text-muted);">Send a request to the project owner to join as a collaborator.</p>
        <textarea v-model="collabMessage" class="rf-textarea" placeholder="Enter your message to the project owner..." rows="3"></textarea>
        <button class="rf-btn rf-btn-primary" @click="requestCollab" :disabled="!collabMessage.trim() || requestingCollab" style="margin-top: 8px;">
          {{ requestingCollab ? 'Sending...' : 'Send Collaboration Request' }}
        </button>
      </div>

      <!-- Team -->
      <div class="rf-section rf-detail-team">
        <h2 class="rf-section-title"><RfIconPeople /> Team Members ({{ team.length }})</h2>
        <div v-if="team.length === 0" class="rf-empty-sm"><p>No team members.</p></div>
        <div v-else class="rf-team-list">
          <div v-for="member in team" :key="member.id" class="rf-team-card">
            <span class="rf-team-user">{{ member.user_id === userId ? 'You' : member.user_id.substring(0, 12) + '...' }}</span>
            <span :class="['rf-badge', `rf-badge-${member.role}`]">{{ member.role }}</span>
            <span v-if="member.can_edit" class="rf-badge rf-badge-edit">Can Edit</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useResearchStore } from '@/store/research';
import { researchService } from '@/services/research.service';
import type { ProjectComment } from '@/services/research.service';
import {
  RfIconBack, RfIconFile, RfIconCrown, RfIconEdit, RfIconEye,
  RfIconUpload, RfIconAttach, RfIconLink, RfIconDownload,
  RfIconDelete, RfIconComment, RfIconCollab, RfIconPeople
} from '@/utils/rf-icons';

const route = useRoute();
const authStore = useAuthStore();
const researchStore = useResearchStore();

const loading = ref(true);
const saving = ref(false);
const uploading = ref(false);
const requestingCollab = ref(false);
const showEditForm = ref(false);

const project = computed(() => researchStore.currentProject);
const files = computed(() => researchStore.currentProjectFiles);
const comments = computed(() => researchStore.currentProjectComments);
const team = computed(() => researchStore.currentProjectTeam);

const userId = computed(() => authStore.user?.id || '');
const projectId = computed(() => route.params.id as string);

const userRole = computed(() => {
  if (!project.value) return '';
  if (project.value.owner_id === userId.value) return 'owner';
  const member = team.value.find(t => t.user_id === userId.value);
  if (member) return member.can_edit ? 'collaborator' : 'viewer';
  return 'viewer';
});

const isTeamMember = computed(() => {
  if (!project.value) return false;
  if (project.value.owner_id === userId.value) return true;
  return team.value.some(t => t.user_id === userId.value);
});

const canEdit = computed(() => {
  if (!project.value) return false;
  if (project.value.owner_id === userId.value) return true;
  const member = team.value.find(t => t.user_id === userId.value);
  return member?.can_edit || false;
});

const canViewFiles = computed(() => {
  if (!project.value) return false;
  if (project.value.access_level === 'public') return true;
  return isTeamMember.value;
});

const canComment = computed(() => {
  if (!project.value) return false;
  if (canEdit.value) return true;
  if (project.value.access_level === 'public') return true;
  return isTeamMember.value;
});

const showCollabSection = computed(() => {
  if (!project.value) return false;
  if (isTeamMember.value) return false;
  if (project.value.access_level === 'private') return false;
  return true;
});

const editForm = ref({ title: '', description: '', publication_year: null as number | null, venue: '', doi: '', keywordsStr: '', access_level: 'private', status: 'draft' });
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const uploadDesc = ref('');
const uploadVersion = ref('v1.0');
const newComment = ref('');
const editingCommentId = ref('');
const editCommentText = ref('');
const collabMessage = ref('');

const formatStatus = (status: string) => ({ draft: 'Draft', published: 'Published', under_review: 'Under Review' }[status] || status);
const formatDate = (dateStr: string) => { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };
const formatFileSize = (bytes: number) => { if (!bytes) return '0 B'; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; };

const onFileSelect = (event: Event) => { const target = event.target as HTMLInputElement; selectedFile.value = target.files?.[0] || null; };

const doUpload = async () => {
  if (!selectedFile.value || !userId.value) return;
  uploading.value = true;
  try {
    await researchStore.uploadFile(projectId.value, userId.value, selectedFile.value, uploadDesc.value, uploadVersion.value);
    selectedFile.value = null; uploadDesc.value = ''; uploadVersion.value = 'v1.0';
    if (fileInputRef.value) fileInputRef.value.value = '';
    alert('File uploaded successfully!');
  } catch (err: any) { alert(err.message || 'Upload failed'); } finally { uploading.value = false; }
};

const fetchFileAsBlob = async (fileId: string): Promise<Blob | null> => {
  try {
    const { url } = await researchService.getFileDownloadInfo(fileId, userId.value);
    const token = import.meta.env.VITE_AUTH_TOKEN;
    const response = await fetch(url, { headers: { 'Authorization': `Token ${token}`, 'X-User-ID': userId.value } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (err) { console.error('Failed to fetch file:', err); return null; }
};

const openFileInNewTab = async (file: any) => {
  const blob = await fetchFileAsBlob(file.id);
  if (blob) { const blobUrl = window.URL.createObjectURL(blob); window.open(blobUrl, '_blank'); setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000); }
  else { alert('Failed to open file'); }
};

const downloadFileToDevice = async (file: any) => {
  const blob = await fetchFileAsBlob(file.id);
  if (blob) { const blobUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = blobUrl; a.download = file.original_filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(blobUrl); }
  else { alert('Failed to download file'); }
};

const removeFile = async (fileId: string) => { if (!confirm('Delete this file?')) return; try { await researchStore.deleteFile(fileId, userId.value); } catch { alert('Failed to delete file'); } };
const postComment = async () => { if (!newComment.value.trim()) return; try { await researchStore.addComment(projectId.value, userId.value, newComment.value); newComment.value = ''; } catch { alert('Failed to post comment'); } };
const startEditComment = (comment: ProjectComment) => { editingCommentId.value = comment.id; editCommentText.value = comment.content; };
const saveCommentEdit = async (commentId: string) => { if (!editCommentText.value.trim()) return; try { await researchStore.updateComment(commentId, userId.value, editCommentText.value); editingCommentId.value = ''; } catch { alert('Failed to update comment'); } };
const removeComment = async (commentId: string) => { if (!confirm('Delete this comment?')) return; try { await researchStore.deleteComment(commentId, userId.value); } catch { alert('Failed to delete comment'); } };

const requestCollab = async () => {
  if (!collabMessage.value.trim()) return;
  requestingCollab.value = true;
  try { await researchStore.sendCollaborationRequest(userId.value, projectId.value, collabMessage.value); collabMessage.value = ''; alert('Collaboration request sent successfully!'); }
  catch (err: any) { alert(err.message || 'Failed to send request'); }
  finally { requestingCollab.value = false; }
};

const openEditForm = () => { populateEditForm(); showEditForm.value = true; };

const saveEdit = async () => {
  saving.value = true;
  try {
    const keywords = editForm.value.keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
    await researchStore.updateProject(projectId.value, userId.value, { title: editForm.value.title, description: editForm.value.description, publication_year: editForm.value.publication_year || undefined, venue: editForm.value.venue, doi: editForm.value.doi, keywords, access_level: editForm.value.access_level as any, status: editForm.value.status as any });
    showEditForm.value = false; alert('Project updated!');
  } catch (err: any) { alert(err.message || 'Update failed'); } finally { saving.value = false; }
};

const populateEditForm = () => {
  if (project.value) {
    editForm.value = { title: project.value.title || '', description: project.value.description || '', publication_year: project.value.publication_year || null, venue: project.value.venue || '', doi: project.value.doi || '', keywordsStr: (project.value.keywords || []).join(', '), access_level: project.value.access_level || 'private', status: project.value.status || 'draft' };
  }
};

onMounted(async () => {
  loading.value = true;
  try { if (userId.value && projectId.value) { await researchStore.loadProject(projectId.value, userId.value); populateEditForm(); } }
  catch (err) { console.error('Failed to load project:', err); }
  finally { loading.value = false; }
});
</script>

<style src="@/assets/css/research-flow.css"></style>