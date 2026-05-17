<template>
  <div class="tm-page">
    <h1>📊 My Toastmasters Results</h1>
    <div class="tm-filters">
      <input v-model="filters.topic" placeholder="🔍 Filter by topic…">
      <select v-model="filters.type">
        <option value="">All Types</option>
        <option>Prepared Speech</option><option>Table Topics (Impromptu)</option>
        <option>Ice Breaker</option><option>Evaluation Speech</option>
        <option>Inspirational Speech</option><option>Persuasive Speech</option>
      </select>
      <select v-model="filters.sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="score">Highest score</option>
      </select>
    </div>

    <div class="tm-table-wrap">
      <table class="tm-table">
        <thead><tr><th>Date</th><th>Topic</th><th>Type</th><th>Duration</th><th>Fillers</th><th>Score</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id">
            <td>{{ formatDate(s.created_at) }}</td>
            <td>{{ s.topic }}</td>
            <td>{{ s.speech_type }}</td>
            <td>{{ Math.floor(s.duration_seconds/60) }}m {{ s.duration_seconds%60 }}s</td>
            <td>{{ s.total_fillers }}</td>
            <td><span :class="['tm-score-pill', scoreClass(s.overall_score)]">{{ s.overall_score }}</span></td>
            <td><button @click="viewReport(s)" class="tm-btn-sm tm-btn-primary">📄 View</button></td>
          </tr>
          <tr v-if="filtered.length === 0"><td colspan="7" style="text-align:center;padding:2rem;color:#64748b">{{ loading ? 'Loading...' : 'No sessions yet.' }}</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="modalSession" class="tm-modal" @click.self="modalSession = null">
      <div class="tm-modal-content">
        <div class="tm-report-header">
          <h2>Report: {{ modalSession.topic }}</h2>
          <button @click="modalSession = null" class="tm-modal-close">✕</button>
        </div>
        <div class="tm-report-user-banner">
          <div class="tm-report-user-avatar">{{ (modalSession.user_full_name || modalSession.username)[0]?.toUpperCase() }}</div>
          <div>
            <div style="font-weight:700;font-size:1.1rem">{{ modalSession.user_full_name || modalSession.username }}</div>
            <div style="color:#64748b">@{{ modalSession.username }} • 📅 {{ formatDate(modalSession.created_at) }}</div>
          </div>
        </div>
        <div class="tm-report-grid">
          <div><strong>Type:</strong> {{ modalSession.speech_type }}</div>
          <div><strong>Target:</strong> {{ modalSession.min_time }}–{{ modalSession.max_time }} min</div>
          <div><strong>Duration:</strong> {{ Math.floor(modalSession.duration_seconds/60) }}m {{ modalSession.duration_seconds%60 }}s</div>
          <div><strong>Fillers:</strong> {{ modalSession.total_fillers }}</div>
          <div><strong>Score:</strong> {{ modalSession.overall_score }}/100</div>
        </div>
        <div class="tm-report-section"><h3>📝 Topic</h3><p>{{ modalSession.topic }}</p></div>
        <div class="tm-report-section"><h3>📚 Word of the Day</h3><p>{{ modalSession.word_of_the_day || '—' }}</p></div>
        <div class="tm-report-section"><h3>⏱️ Timer Report</h3><p>{{ modalSession.timer_report }}</p></div>

        <!-- ✨ ENHANCED AH-COUNTER WITH BREAKDOWN CHIPS -->
        <div class="tm-report-section">
          <h3>🗣️ Ah-Counter Report</h3>
          <p>{{ modalSession.ah_counter_report }}</p>
          <div v-if="modalFillerEntries.length > 0" class="tm-filler-section">
            <div class="tm-filler-section-title">📊 Filler Word Breakdown ({{ modalSession.total_fillers }} total):</div>
            <div class="tm-filler-chips">
              <span v-for="[word, count] in modalFillerEntries" :key="word" class="tm-filler-chip">
                <span class="tm-filler-word">"{{ word }}"</span>
                <span class="tm-filler-count">×{{ count }}</span>
              </span>
            </div>
          </div>
          <div v-else class="tm-filler-empty">
            ✨ Zero filler words — outstanding clarity!
          </div>
        </div>

        <div class="tm-report-section"><h3>✍️ Grammarian Report</h3><p>{{ modalSession.grammarian_report }}</p></div>
        <div class="tm-report-section"><h3>📋 Speech Evaluator Report</h3><p>{{ modalSession.speech_evaluator_report }}</p></div>
        <div class="tm-report-section"><h3>🎯 General Evaluator Report</h3><p>{{ modalSession.general_evaluator_report }}</p></div>
        <div class="tm-report-section">
          <h3>📹 Body Language Analysis</h3>
          <div class="tm-bl-grid">
            <div><strong>Engagement:</strong> {{ modalSession.body_language_data?.engagement_score || 0 }}/100</div>
            <div><strong>Face Visible:</strong> {{ modalSession.body_language_data?.face_visibility_percent || 0 }}%</div>
            <div><strong>Looking Forward:</strong> {{ modalSession.body_language_data?.looking_forward_percent || 0 }}%</div>
            <div><strong>Centered:</strong> {{ modalSession.body_language_data?.centered_percent || 0 }}%</div>
          </div>
          <p style="margin-top:.75rem">{{ modalSession.body_language_advice }}</p>
        </div>
        <div class="tm-report-section" v-if="modalSession.sample_speech_text">
          <h3>🎤 Sample Speech You Evaluated</h3>
          <div class="tm-transcript-block">{{ modalSession.sample_speech_text }}</div>
        </div>
        <div class="tm-report-section">
          <h3>📜 Your Full Transcript</h3>
          <div class="tm-transcript-block">{{ modalSession.transcript || '(no transcript)' }}</div>
        </div>
        <div style="padding:1.25rem 2rem;display:flex;gap:1rem;justify-content:flex-end">
          <button @click="modalSession = null" class="tm-btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import { toastmastersService, type ToastmastersSession } from '@/services/toastmasters.service';

const authStore = useAuthStore();
const sessions = ref<ToastmastersSession[]>([]);
const loading = ref(true);
const modalSession = ref<ToastmastersSession | null>(null);
const filters = ref({ topic: '', type: '', sort: 'newest' });

// ✨ Sorted filler entries for the open modal (descending by count)
const modalFillerEntries = computed(() => {
  if (!modalSession.value?.filler_counts) return [];
  return Object.entries(modalSession.value.filler_counts)
    .filter(([_, c]) => (c as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number));
});

const filtered = computed(() => {
  let arr = sessions.value.filter(s => {
    if (filters.value.topic && !s.topic.toLowerCase().includes(filters.value.topic.toLowerCase())) return false;
    if (filters.value.type && s.speech_type !== filters.value.type) return false;
    return true;
  });
  if (filters.value.sort === 'newest') arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (filters.value.sort === 'oldest') arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (filters.value.sort === 'score') arr.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  return arr;
});

function formatDate(d: string): string { return new Date(d).toLocaleString(); }
function scoreClass(score: number): string { return score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low'; }
function viewReport(s: ToastmastersSession) { modalSession.value = s; }

onMounted(async () => {
  try {
    if (authStore.user?.id) {
      sessions.value = await toastmastersService.getUserSessions(authStore.user.id);
    }
  } catch (e) { console.error('Failed to load:', e); }
  loading.value = false;
});
</script>

<style src="@/assets/css/toastmasters.css"></style>