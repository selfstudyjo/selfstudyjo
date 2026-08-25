<template>
  <div class="tm-page">
    <h1>{{ $t('📊 My Toastmasters Results') }}</h1>
    <div class="tm-filters">
      <input v-model="filters.topic" :placeholder="$t('🔍 Filter by topic…')">
      <select v-model="filters.type">
        <option value="">{{ $t('All Types') }}</option>
        <option>{{ $t('Prepared Speech') }}</option><option>{{ $t('Table Topics (Impromptu)') }}</option>
        <option>{{ $t('Ice Breaker') }}</option><option>{{ $t('Evaluation Speech') }}</option>
        <option>{{ $t('Inspirational Speech') }}</option><option>{{ $t('Persuasive Speech') }}</option>
      </select>
      <select v-model="filters.role">
        <option value="">{{ $t('All Roles') }}</option>
        <option value="Speaker">{{ $t('Speaker') }}</option>
        <option value="Toastmaster">{{ $t('Toastmaster') }}</option>
        <option value="Timer">{{ $t('Timer') }}</option>
        <option value="Ah-Counter">{{ $t('Ah-Counter') }}</option>
        <option value="Grammarian">{{ $t('Grammarian') }}</option>
        <option value="Speech Evaluator">{{ $t('Speech Evaluator') }}</option>
        <option value="General Evaluator">{{ $t('General Evaluator') }}</option>
      </select>
      <select v-model="filters.sort">
        <option value="newest">{{ $t('Newest first') }}</option>
        <option value="oldest">{{ $t('Oldest first') }}</option>
        <option value="score">{{ $t('Highest score') }}</option>
      </select>
    </div>

    <div class="tm-table-wrap">
      <table class="tm-table">
        <thead><tr><th>{{ $t('Date') }}</th><th>{{ $t('Role') }}</th><th>{{ $t('Topic') }}</th><th>{{ $t('Type') }}</th><th>{{ $t('Duration') }}</th><th>{{ $t('Fillers') }}</th><th>{{ $t('Score') }}</th><th></th></tr></thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id">
            <td>{{ formatDate(s.created_at) }}</td>
            <td><span :style="roleBadgeStyle(s.user_role || 'Speaker')">{{ s.user_role || 'Speaker' }}</span></td>
            <td>{{ s.topic }}</td>
            <td>{{ s.speech_type || '—' }}</td>
            <td>{{ Math.floor(s.duration_seconds/60) }}m {{ s.duration_seconds%60 }}s</td>
            <td>{{ s.total_fillers }}</td>
            <td><span :class="['tm-score-pill', scoreClass(s.overall_score)]">{{ s.overall_score }}</span></td>
            <td><button @click="viewReport(s)" class="tm-btn-sm tm-btn-primary">{{ $t('📄 View') }}</button></td>
          </tr>
          <tr v-if="filtered.length === 0"><td colspan="8" style="text-align:center;padding:2rem;color:#64748b">{{ loading ? 'Loading...' : 'No sessions yet.' }}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- REPORT MODAL -->
    <div v-if="modalSession" class="tm-modal" @click.self="modalSession = null">
      <div class="tm-modal-content">
        <div class="tm-report-header">
          <h2>{{ $t('Report: {v0}', { v0: modalSession.topic }) }}</h2>
          <button @click="modalSession = null" class="tm-modal-close">✕</button>
        </div>
        <div class="tm-report-user-banner">
          <div class="tm-report-user-avatar">{{ (modalSession.user_full_name || modalSession.username || 'U')[0]?.toUpperCase() }}</div>
          <div>
            <div style="font-weight:700;font-size:1.1rem">{{ modalSession.user_full_name || modalSession.username }}</div>
            <div style="color:#64748b">@{{ modalSession.username }} • 📅 {{ formatDate(modalSession.created_at) }}</div>
          </div>
        </div>
        <div class="tm-report-grid">
          <div><strong>{{ $t('Role:') }}</strong> <span :style="roleBadgeStyle(modalSession.user_role || 'Speaker')">{{ modalSession.user_role || 'Speaker' }}</span></div>
          <div><strong>{{ $t('Type:') }}</strong> {{ modalSession.speech_type || '—' }}</div>
          <div><strong>{{ $t('Target:') }}</strong> {{ $t('{v0}–{v1} min', { v0: modalSession.min_time, v1: modalSession.max_time }) }}</div>
          <div><strong>{{ $t('Duration:') }}</strong> {{ Math.floor(modalSession.duration_seconds/60) }}m {{ modalSession.duration_seconds%60 }}s</div>
          <div><strong>{{ $t('Fillers:') }}</strong> {{ modalSession.total_fillers }}</div>
          <div><strong>{{ $t('Score:') }}</strong> {{ modalSession.overall_score }}/100</div>
        </div>
        <div class="tm-report-section"><h3>{{ $t('📝 Topic') }}</h3><p>{{ modalSession.topic }}</p></div>
        <div class="tm-report-section"><h3>{{ $t('📚 Word of the Day') }}</h3><p>{{ modalSession.word_of_the_day || '—' }}</p></div>

        <!-- ROLE EVALUATION (for non-Speaker roles) -->
        <div class="tm-report-section" v-if="modalSession.role_evaluation_report && (modalSession.user_role || 'Speaker') !== 'Speaker'">
          <h3>{{ $t('🎭 {v0} Role Evaluation', { v0: modalSession.user_role }) }}</h3>
          <p>{{ modalSession.role_evaluation_report }}</p>
        </div>

        <div class="tm-report-section"><h3>{{ $t('⏱️ Timer Report') }}</h3><p>{{ modalSession.timer_report || '—' }}</p></div>

        <div class="tm-report-section">
          <h3>{{ $t('🗣️ Ah-Counter Report') }}</h3>
          <p>{{ modalSession.ah_counter_report || '—' }}</p>
          <div v-if="modalFillerEntries.length > 0" class="tm-filler-section">
            <div class="tm-filler-section-title">{{ $t('📊 Filler Word Breakdown ({v0} total):', { v0: modalSession.total_fillers }) }}</div>
            <div class="tm-filler-chips">
              <span v-for="[word, count] in modalFillerEntries" :key="word" class="tm-filler-chip">
                <span class="tm-filler-word">"{{ word }}"</span>
                <span class="tm-filler-count">×{{ count }}</span>
              </span>
            </div>
          </div>
          <div v-else class="tm-filler-empty">
            {{ $t('✨ Zero filler words — outstanding clarity!') }}
          </div>
        </div>

        <div class="tm-report-section"><h3>{{ $t('✍️ Grammarian Report') }}</h3><p>{{ modalSession.grammarian_report || '—' }}</p></div>
        <div class="tm-report-section"><h3>{{ $t('📋 Speech Evaluator Report') }}</h3><p>{{ modalSession.speech_evaluator_report || '—' }}</p></div>
        <div class="tm-report-section"><h3>{{ $t('🎯 General Evaluator Report') }}</h3><p>{{ modalSession.general_evaluator_report || '—' }}</p></div>
        <div class="tm-report-section">
          <h3>{{ $t('📹 Body Language Analysis') }}</h3>
          <div class="tm-bl-grid">
            <div><strong>{{ $t('Engagement:') }}</strong> {{ modalSession.body_language_data?.engagement_score || 0 }}/100</div>
            <div><strong>{{ $t('Face Visible:') }}</strong> {{ modalSession.body_language_data?.face_visibility_percent || 0 }}%</div>
            <div><strong>{{ $t('Looking Forward:') }}</strong> {{ modalSession.body_language_data?.looking_forward_percent || 0 }}%</div>
            <div><strong>{{ $t('Centered:') }}</strong> {{ modalSession.body_language_data?.centered_percent || 0 }}%</div>
          </div>
          <p style="margin-top:.75rem">{{ modalSession.body_language_advice || '—' }}</p>
        </div>
        <div class="tm-report-section" v-if="modalSession.sample_speech_text">
          <h3>{{ $t('🎤 Sample Speech') }}</h3>
          <div class="tm-transcript-block">{{ modalSession.sample_speech_text }}</div>
        </div>
        <div class="tm-report-section">
          <h3>{{ $t('📜 Your Full Transcript') }}</h3>
          <div class="tm-transcript-block">{{ modalSession.transcript || '(no transcript)' }}</div>
        </div>
        <div style="padding:1.25rem 2rem;display:flex;gap:1rem;justify-content:flex-end">
          <button @click="modalSession = null" class="tm-btn-secondary">{{ $t('Close') }}</button>
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
const filters = ref({ topic: '', type: '', role: '', sort: 'newest' });

const ROLE_COLORS: Record<string, string> = {
  'Speaker': '#4f46e5',
  'Toastmaster': '#7c3aed',
  'Timer': '#10b981',
  'Ah-Counter': '#f59e0b',
  'Grammarian': '#ec4899',
  'Speech Evaluator': '#14b8a6',
  'General Evaluator': '#64748b'
};

function roleBadgeStyle(role: string) {
  const color = ROLE_COLORS[role] || '#6b7280';
  return {
    background: color,
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
    display: 'inline-block'
  };
}

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
    if (filters.value.role && (s.user_role || 'Speaker') !== filters.value.role) return false;
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