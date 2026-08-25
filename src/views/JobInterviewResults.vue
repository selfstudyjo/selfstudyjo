<template>
  <div class="ji-page">
    <h1>{{ $t('📊 My Job Interview Results') }}</h1>

    <div class="ji-filters">
      <input v-model="filters.topic" :placeholder="$t('🔍 Filter by topic / role…')">
      <select v-model="filters.type">
        <option value="">{{ $t('All Types') }}</option>
        <option>{{ $t('Technical') }}</option>
        <option>HR</option>
      </select>
      <select v-model="filters.sort">
        <option value="newest">{{ $t('Newest first') }}</option>
        <option value="oldest">{{ $t('Oldest first') }}</option>
        <option value="score">{{ $t('Highest score') }}</option>
      </select>
    </div>

    <div class="ji-table-wrap">
      <table class="ji-table">
        <thead>
          <tr><th>{{ $t('Date') }}</th><th>{{ $t('Type') }}</th><th>{{ $t('Topic / Role') }}</th><th>CV</th><th>{{ $t('Duration') }}</th><th>{{ $t('Questions') }}</th><th>{{ $t('Score') }}</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id">
            <td>
              {{ formatDate(s.created_at) }}
              <span class="ji-attempt-pill" v-if="(s.attempt || 1) > 1">{{ $t('try {v0}', { v0: s.attempt }) }}</span>
              <!--
                The session is written from the FIRST question now and updated
                after every answer, so an abandoned interview is in this list
                with real coaching in it. Without this pill it is
                indistinguishable from a finished one that scored nothing.
              -->
              <span class="ji-progress-pill" v-if="s.status === 'in_progress'"
                    :title="$t('This interview was not finished — the answers you did give are still coached')">{{ $t('unfinished') }}</span>
            </td>
            <td>{{ s.interview_type }}</td>
            <td>{{ s.topic }}</td>
            <td>
              <span v-if="s.cv_title" :title="s.cv_title">📄</span>
              <span v-else style="color:var(--ji-text-dim)">—</span>
            </td>
            <td>{{ Math.floor(s.duration_seconds/60) }}m {{ s.duration_seconds%60 }}s</td>
            <td>{{ (s.qa_pairs && s.qa_pairs.length) || 0 }}</td>
            <td><span :class="['ji-score-pill', scoreClass(s.score)]">{{ s.score }}</span></td>
            <td>
              <button @click="viewReport(s)" class="ji-btn-sm ji-btn-primary">{{ $t('📄 View') }}</button>
              <!--
                The whole point of the feature: the same role, the same
                requirements and the same CV, without typing any of it again.
              -->
              <button @click="redo(s)" class="ji-btn-sm ji-btn-success" :title="$t('Same role and requirements, new questions')">{{ $t('🔁 Redo') }}</button>
              <button @click="editAndRedo(s)" class="ji-btn-sm ji-btn-secondary" :title="$t('Change the details first')">✏️</button>
              <button @click="remove(s)" class="ji-btn-sm ji-btn-danger">🗑️</button>
            </td>
          </tr>
          <tr v-if="filtered.length === 0">
            <td colspan="8" style="text-align:center;padding:2rem;color:var(--ji-text-mute)">
              {{ loading ? 'Loading…' : 'No interviews yet.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="modalSession" class="ji-modal" @click.self="modalSession = null">
      <div class="ji-modal-content">
        <div class="ji-report-header">
          <h2>{{ $t('{v0} Interview — {v1}', { v0: modalSession.interview_type, v1: modalSession.topic }) }}</h2>
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
          <div><strong>{{ $t('Type:') }}</strong> {{ modalSession.interview_type }}</div>
          <div><strong>{{ $t('Topic:') }}</strong> {{ modalSession.topic }}</div>
          <div><strong>{{ $t('Planned:') }}</strong> {{ $t('{v0} min', { v0: modalSession.planned_minutes }) }}<span
            v-if="modalSession.planned_questions"> {{ $t('· {v0} questions', { v0: modalSession.planned_questions }) }}</span></div>
          <div><strong>{{ $t('Duration:') }}</strong> {{ Math.floor(modalSession.duration_seconds/60) }}m {{ modalSession.duration_seconds%60 }}s</div>
          <div><strong>{{ $t('Questions:') }}</strong> {{ (modalSession.qa_pairs && modalSession.qa_pairs.length) || 0 }}</div>
          <div><strong>{{ $t('Score:') }}</strong> {{ modalSession.score }}/100</div>
          <div v-if="(modalSession.attempt || 1) > 1"><strong>{{ $t('Attempt:') }}</strong> #{{ modalSession.attempt }}</div>
          <div v-if="modalSession.cv_title"><strong>CV:</strong> {{ modalSession.cv_title }}</div>
        </div>

        <div class="ji-report-section" v-if="breakdownRows.length">
          <h3>{{ $t('📊 Where the score came from') }}</h3>
          <div class="ji-bars">
            <div class="ji-bar-row" v-for="row in breakdownRows" :key="row.key">
              <span class="ji-bar-label">{{ row.label }}</span>
              <span class="ji-bar-track"><span class="ji-bar-fill" :class="row.band" :style="{ width: row.value + '%' }"></span></span>
              <span class="ji-bar-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="ji-report-section ji-report-plan"
             v-if="modalSession.action_plan && modalSession.action_plan.length">
          <h3>{{ $t('🎯 Do this before your next interview') }}</h3>
          <ol class="ji-plan-list"><li v-for="(step, i) in modalSession.action_plan" :key="i">{{ step }}</li></ol>
        </div>

        <div class="ji-report-section ji-report-standout" v-if="modalSession.standout_moment">
          <h3>{{ $t('🌟 Your strongest moment') }}</h3><p>{{ modalSession.standout_moment }}</p>
        </div>

        <div class="ji-report-section ji-report-flags" v-if="modalSession.red_flags">
          <h3>{{ $t('⚠️ What would worry a hiring manager') }}</h3><p>{{ modalSession.red_flags }}</p>
        </div>

        <div class="ji-report-section"><h3>{{ $t('🏁 Recommendation') }}</h3><p>{{ modalSession.recommendation || '—' }}</p></div>
        <div class="ji-report-section"><h3>{{ $t('📝 Overall Summary') }}</h3><p>{{ modalSession.summary || '—' }}</p></div>
        <div class="ji-report-section"><h3>{{ $t('✅ Strengths') }}</h3><p>{{ modalSession.strengths || '—' }}</p></div>
        <div class="ji-report-section"><h3>{{ $t('📈 Areas to Improve') }}</h3><p>{{ modalSession.improvements || '—' }}</p></div>
        <div class="ji-report-section"><h3>🧠 {{ modalSession.interview_type === 'HR' ? 'Competency Assessment' : 'Technical Assessment' }}</h3><p>{{ modalSession.technical_assessment || '—' }}</p></div>
        <div class="ji-report-section"><h3>{{ $t('🗣️ Communication') }}</h3><p>{{ modalSession.communication || '—' }}</p></div>

        <div class="ji-report-section" v-if="modalSession.qualifications">
          <h3>{{ $t('📋 Qualifications Considered') }}</h3>
          <div class="ji-transcript-block">{{ modalSession.qualifications }}</div>
        </div>

        <div class="ji-report-section" v-if="modalSession.cv_summary">
          <h3>{{ $t('📄 CV the interviewer read') }}</h3>
          <div class="ji-transcript-block">{{ modalSession.cv_summary }}</div>
        </div>

        <div class="ji-report-section">
          <h3>{{ $t('💬 Question-by-question coaching') }}</h3>
          <p class="ji-card-lead">
            {{ $t('For each question: what you said, your own answer rewritten to be stronger, a short model answer you can rehearse, and why the interviewer asked it.') }}
          </p>
          <div class="ji-qa-list">
            <QaCoaching
              v-for="(qa, i) in (modalSession.qa_pairs || [])"
              :key="i" :qa="qa" :index="i" />
            <div v-if="!modalSession.qa_pairs || modalSession.qa_pairs.length === 0" style="color:var(--ji-text-mute)">{{ $t('No questions recorded.') }}</div>
          </div>
        </div>

        <div style="padding:1.25rem 1.75rem;display:flex;gap:1rem;justify-content:flex-end;flex-wrap:wrap">
          <button @click="modalSession = null" class="ji-btn-secondary">{{ $t('Close') }}</button>
          <button @click="editAndRedo(modalSession)" class="ji-btn-secondary">{{ $t('✏️ Change Details & Redo') }}</button>
          <button @click="redo(modalSession)" class="ji-btn-success">{{ $t('🔁 Redo This Interview') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import {
  jobInterviewService, type JobInterviewSession, type ScoreBreakdown,
} from '@/services/jobinterview.service';
import QaCoaching from '@/components/jobinterview/QaCoaching.vue';
import { askedQuestionsFrom, newSessionSeed, redoConfigFrom } from '@/utils/interviewSetup';
import { pickInterviewer } from '@/cast/actors';

const router = useRouter();
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

/**
 * The score's five dimensions, for the open report.
 *
 * Same order and same labels as the session view's own panel -- they are two
 * renderings of one thing, and a candidate comparing a fresh report against a
 * saved one must not have to work out that "Depth" and "Detail" are the same
 * row. Absent on every session recorded before 2026-08-22, and the panel simply
 * does not render for those.
 */
const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'structure', label: 'Structure' },
  { key: 'relevance', label: 'Answering the question' },
  { key: 'depth', label: 'Depth and detail' },
  { key: 'communication', label: 'Communication' },
  { key: 'impact', label: 'Results and impact' },
];

const breakdownRows = computed(() => {
  const breakdown = modalSession.value?.score_breakdown || {};
  return BREAKDOWN_LABELS
    .map(row => ({ ...row, value: Number(breakdown[row.key]) }))
    .filter(row => Number.isFinite(row.value))
    .map(row => ({
      key: String(row.key),
      label: row.label,
      value: Math.max(0, Math.min(100, Math.round(row.value))),
      band: scoreClass(row.value),
    }));
});

/**
 * The config for sitting a past interview again.
 *
 * The avoid list is built from EVERY past sitting of the same role, not just
 * the one being redone -- a candidate on their fourth attempt should not be
 * handed attempt two's questions back. Which is also why the attempt number is
 * counted across all of them rather than taken from the record: redoing an old
 * interview twice would otherwise produce two sittings both calling themselves
 * attempt 2, and app 27's fallback pool would rotate to the same place.
 */
function nextAttemptConfig(s: JobInterviewSession) {
  const sameGround = sessions.value.filter(x =>
    x.interview_type === s.interview_type &&
    (x.topic || '').trim().toLowerCase() === (s.topic || '').trim().toLowerCase());
  return redoConfigFrom(
    { ...s, attempt: sameGround.length },
    {
      interviewer: pickInterviewer().id,
      avoidQuestions: askedQuestionsFrom(sameGround, { type: s.interview_type, topic: s.topic }),
      // A new seed per sitting, or a redo differs only by the questions it was
      // explicitly told to skip -- and that list is capped, so a candidate on
      // their fifth attempt would start seeing the first one's questions again.
      sessionSeed: newSessionSeed(),
    },
  );
}

/** Straight back into the interview room, same setup, different questions. */
function redo(s: JobInterviewSession) {
  const config = nextAttemptConfig(s);
  if (config.type === 'Technical' && !config.topic) {
    // Nothing to redo against. Sending them to the room would greet them and
    // then interview them about "this field".
    editAndRedo(s);
    return;
  }
  sessionStorage.setItem('jobInterviewConfig', JSON.stringify(config));
  modalSession.value = null;
  router.push('/job-interview/session');
}

/** The same, but stopping at the form so the details can be changed first. */
function editAndRedo(s: JobInterviewSession) {
  sessionStorage.setItem('jobInterviewPrefill', JSON.stringify(nextAttemptConfig(s)));
  modalSession.value = null;
  router.push('/job-interview/pre-session');
}

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
