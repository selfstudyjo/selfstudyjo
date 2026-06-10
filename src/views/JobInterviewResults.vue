<template>
  <div class="ji-page">
    <h1>📊 My Job Interview Results</h1>

    <div class="ji-filters">
      <input v-model="filters.topic" placeholder="🔍 Filter by topic / role…">
      <select v-model="filters.type">
        <option value="">All Types</option>
        <option>Technical</option>
        <option>HR</option>
      </select>
      <select v-model="filters.sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="score">Highest score</option>
      </select>
    </div>

    <div class="ji-table-wrap">
      <table class="ji-table">
        <thead>
          <tr><th>Date</th><th>Type</th><th>Topic / Role</th><th>Duration</th><th>Questions</th><th>Score</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id">
            <td>{{ formatDate(s.created_at) }}</td>
            <td>{{ s.interview_type }}</td>
            <td>{{ s.topic }}</td>
            <td>{{ Math.floor(s.duration_seconds/60) }}m {{ s.duration_seconds%60 }}s</td>
            <td>{{ (s.qa_pairs && s.qa_pairs.length) || 0 }}</td>
            <td><span :class="['ji-score-pill', scoreClass(s.score)]">{{ s.score }}</span></td>
            <td>
              <button @click="viewReport(s)" class="ji-btn-sm ji-btn-primary">📄 View</button>
              <button @click="remove(s)" class="ji-btn-sm ji-btn-danger">🗑️</button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="7" style="text-align:center;padding:2rem;color:var(--ji-text-mute)">
              {{ loading ? 'Loading…' : 'No interviews yet.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="modalSession" class="ji-modal" @click.self="modalSession = null">
      <div class="ji-modal-content">
        <div class="ji-report-header">
          <h2>{{ modalSession.interview_type }} Interview — {{ modalSession.topic }}</h2>
          <button @click="modalSession = null" class="ji-modal-close">✕</button>
        </div>

        <div class="ji-report-user-banner">
          <div class="ji-report-user-avatar">{{ (modalSession.user_full_name || modalSession.username)[0]?.toUpperCase() }}</div>
          <div>
            <div style="font-weight:700;font-size:1.05rem">{{ modalSession.user_full_name || modalSession.username }}</div>
            <div style="color:var(--ji-text-mute)">@{{ modalSession.username }} • 📅 {{ formatDate(modalSession.created_at) }}</div>
          </div>
        </div>

        <div class="ji-report-grid">
          <div><strong>Type:</strong> {{ modalSession.interview_type }}</div>
          <div><strong>Topic:</strong> {{ modalSession.topic }}</div>
          <div><strong>Planned:</strong> {{ modalSession.planned_minutes }} min</div>
          <div><strong>Duration:</strong> {{ Math.floor(modalSession.duration_seconds/60) }}m {{ modalSession.duration_seconds%60 }}s</div>
          <div><strong>Questions:</strong> {{ (modalSession.qa_pairs && modalSession.qa_pairs.length) || 0 }}</div>
          <div><strong>Score:</strong> {{ modalSession.score }}/100</div>
        </div>

        <div class="ji-report-section"><h3>🏁 Recommendation</h3><p>{{ modalSession.recommendation || '—' }}</p></div>
        <div class="ji-report-section"><h3>📝 Overall Summary</h3><p>{{ modalSession.summary || '—' }}</p></div>
        <div class="ji-report-section"><h3>✅ Strengths</h3><p>{{ modalSession.strengths || '—' }}</p></div>
        <div class="ji-report-section"><h3>📈 Areas to Improve</h3><p>{{ modalSession.improvements || '—' }}</p></div>
        <div class="ji-report-section"><h3>🧠 {{ modalSession.interview_type === 'HR' ? 'Competency Assessment' : 'Technical Assessment' }}</h3><p>{{ modalSession.technical_assessment || '—' }}</p></div>
        <div class="ji-report-section"><h3>🗣️ Communication</h3><p>{{ modalSession.communication || '—' }}</p></div>

        <div class="ji-report-section" v-if="modalSession.qualifications">
          <h3>📋 Qualifications Considered</h3>
          <div class="ji-transcript-block">{{ modalSession.qualifications }}</div>
        </div>

        <div class="ji-report-section">
          <h3>💬 Questions, Your Answers & Model Answers</h3>
          <div class="ji-qa-list">
            <div v-for="(qa, i) in (modalSession.qa_pairs || [])" :key="i" class="ji-qa-item">
              <div class="ji-qa-q">Q{{ i + 1 }}. {{ qa.question }}</div>
              <div class="ji-qa-a"><span class="ji-qa-a-label">🗣️ Your answer:</span> {{ qa.answer || '(no answer captured)' }}</div>
              <div class="ji-qa-model" v-if="qa.model_answer">
                <span class="ji-qa-model-label">⭐ Model answer (for training):</span>
                {{ qa.model_answer }}
              </div>
            </div>
            <div v-if="!modalSession.qa_pairs || modalSession.qa_pairs.length === 0" style="color:var(--ji-text-mute)">No questions recorded.</div>
          </div>
        </div>

        <div style="padding:1.25rem 1.75rem;display:flex;gap:1rem;justify-content:flex-end">
          <button @click="modalSession = null" class="ji-btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { jobInterviewService, type JobInterviewSession } from '@/services/jobinterview.service';

const authStore = useAuthStore();
const sessions = ref<JobInterviewSession[]>([]);
const loading = ref(true);
const modalSession = ref<JobInterviewSession | null>(null);
const filters = ref({ topic: '', type: '', sort: 'newest' });

const filtered = computed(() => {
  let arr = sessions.value.filter(s => {
    if (filters.value.topic && !(s.topic || '').toLowerCase().includes(filters.value.topic.toLowerCase())) return false;
    if (filters.value.type && s.interview_type !== filters.value.type) return false;
    return true;
  });
  if (filters.value.sort === 'newest') arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters.value.sort === 'oldest') arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (filters.value.sort === 'score') arr.sort((a, b) => (b.score || 0) - (a.score || 0));
  return arr;
});

function formatDate(d: string): string { return new Date(d).toLocaleString(); }
function scoreClass(score: number): string { return score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low'; }
function viewReport(s: JobInterviewSession) { modalSession.value = s; }

async function remove(s: JobInterviewSession) {
  if (!confirm('Delete this interview result?')) return;
  try {
    await jobInterviewService.deleteSession(s.id, authStore.user?.id || '');
    sessions.value = sessions.value.filter(x => x.id !== s.id);
  } catch (e) { console.error('Delete failed:', e); }
}

onMounted(async () => {
  try {
    if (authStore.user?.id) {
      sessions.value = await jobInterviewService.getUserSessions(authStore.user.id);
    }
  } catch (e) { console.error('Failed to load:', e); }
  loading.value = false;
});
</script>

<style src="@/assets/css/job-interview.css"></style>