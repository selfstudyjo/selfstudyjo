<template>
  <div class="ji-page">
    <div class="ji-form-card">
      <h1>🎯 Prepare Your Interview</h1>
      <p>Configure your mock interview. The AI interviewer will ask questions one at a time and wait for your answers.</p>

      <div class="ji-redo-banner" v-if="isRedo">
        🔁 <strong>Practising again.</strong> Your role and requirements are filled in from your
        last interview — change anything you like, or just start. The interviewer knows which
        questions you have already been asked and will cover different ground.
      </div>

      <form @submit.prevent="startSession">
        <label>Interview Type *</label>
        <select v-model="form.type" @change="onTypeChange" required>
          <option value="Technical">Technical Interview (role / topic based)</option>
          <option value="HR">HR Interview (behavioral / soft skills)</option>
        </select>

        <div class="ji-type-info" v-html="typeInfo"></div>

        <div v-if="form.type === 'Technical'">
          <label>Role / Topic *</label>
          <input v-model="form.topic" list="ji-topic-suggestions"
                 placeholder="e.g., Python Developer, DevOps, Frontend Engineer" :required="form.type === 'Technical'">
          <datalist id="ji-topic-suggestions">
            <option value="Python Developer" />
            <option value="Linux System Engineer" />
            <option value="System Engineer" />
            <option value="DevOps Engineer" />
            <option value="Software Engineer" />
            <option value="Frontend Engineer" />
            <option value="Backend Engineer" />
            <option value="Full Stack Developer" />
            <option value="Odoo Developer" />
            <option value="Site Reliability Engineer (SRE)" />
            <option value="Data Engineer" />
            <option value="Cloud Engineer" />
            <option value="Teacher" />
            <option value="English Teacher" />
          </datalist>
        </div>

        <label>
          Qualifications / Job Requirements (optional)
        </label>
        <textarea
          v-model="form.qualifications"
          rows="7"
          class="ji-textarea"
          placeholder="Paste the job requirements or qualifications here. The interviewer will tailor questions to them.

Example:
· 5+ years of experience in DevOps / SRE roles
· Expert-level Linux & Windows administration, shell scripting (Bash/PowerShell)
· Deep understanding of TCP/IP, Load Balancing (Nginx/HAProxy), Firewalls, VPN
· Advanced RCA / blameless post-mortems
· Automation in Python, Go or Ruby
· Advanced SQL: query optimization, indexing, replication"
        ></textarea>
        <p class="ji-hint">💡 If you fill this in, the interviewer will ask questions specifically related to these qualifications.</p>

        <!--
          The CV is optional and stays optional. An interview that cannot start
          because the CV Builder is cold is a worse feature than one conducted
          without a CV, so every failure below leaves the select disabled with a
          sentence saying why rather than blocking the form.
        -->
        <label for="ji-cv-select">Attach a CV (optional)</label>
        <select id="ji-cv-select" v-model="form.cvId" :disabled="cvState !== 'ready' || !cvs.length">
          <option value="">— No CV — interview me on the role and requirements only</option>
          <option v-for="cv in cvs" :key="cv.id" :value="cv.id">{{ cvLabel(cv) }}</option>
        </select>

        <p class="ji-hint" v-if="cvState === 'loading'">⏳ Loading your CVs from the CV Builder…</p>
        <p class="ji-hint" v-else-if="cvState === 'error'">
          ⚠️ Could not reach the CV Builder right now, so no CV can be attached. Everything else
          works — you can start the interview without one.
        </p>
        <p class="ji-hint" v-else-if="!cvs.length">
          📄 You have no CVs yet.
          <router-link to="/cv-builder">Build one in the CV Builder</router-link>
          and the interviewer will read it before asking anything.
        </p>
        <p class="ji-hint" v-else-if="form.cvId">
          ✅ The interviewer will read this CV and ask about what is actually on it — your real
          projects, the gaps against the requirements, and the claims worth probing.
          <span v-if="cvLoading"> Loading it now…</span>
        </p>
        <p class="ji-hint" v-else>
          💡 Attaching a CV makes the interview far more realistic: questions come from your own
          experience rather than from the role title alone.
        </p>

        <!--
          The candidate picks the number of QUESTIONS and the minutes follow.

          It used to be the other way round: a duration box, and the question
          count fell out of it at a ratio nobody was shown. Nobody thinks "I
          would like fourteen minutes of interview" -- they think "let me
          rehearse five questions" -- and the old floor of four questions was
          itself only an artefact of a three-minute minimum divided by ninety
          seconds.
        -->
        <label for="ji-question-count">How many questions? *</label>
        <input id="ji-question-count" type="number" v-model.number="form.questions"
               :min="MIN_QUESTIONS" :max="MAX_QUESTIONS" required>
        <div class="ji-quick-picks">
          <button type="button" v-for="n in QUICK_PICKS" :key="n"
                  class="ji-quick-pick" :class="{ on: form.questions === n }"
                  @click="pickQuestions(n)">{{ n }}</button>
        </div>
        <p class="ji-hint">
          From {{ MIN_QUESTIONS }} to {{ MAX_QUESTIONS }}. Each answer is planned at
          <strong>1 minute 30</strong> — so {{ questionCount }} questions is
          <strong>{{ suggestedMinutes }} minutes</strong>.
        </p>

        <label for="ji-minutes">Total time (minutes)</label>
        <input id="ji-minutes" type="number" v-model.number="form.minutes"
               :min="suggestedMinutes" :max="MAX_MINUTES">
        <p class="ji-hint">
          <template v-if="extraMinutes > 0">
            ⏱️ {{ extraMinutes }} extra minute{{ extraMinutes === 1 ? '' : 's' }} —
            about <strong>{{ perAnswerLabel }}</strong> per answer instead of 1:30.
          </template>
          <template v-else>
            Set from your question count. Raise it if you want longer than 1:30 to think and
            answer; it cannot go below what {{ questionCount }} questions need.
          </template>
        </p>

        <!--
          The three ways to fix a sentence, said BEFORE the room rather than
          discovered in it. A non-native speaker restarting a sentence is the
          single commonest thing that happens in this feature, and until this
          page said so the only evidence the answer could be edited at all was a
          button that appeared while somebody was busy talking.
        -->
        <div class="ji-howto">
          <h3>🎙️ Fixing what you said, while you say it</h3>
          <p>
            Your speech is transcribed live into an <strong>editable</strong> box. If you start a
            sentence badly — which everybody does, and non-native speakers do more — you do not
            have to live with it in your report.
          </p>
          <ul>
            <li>
              <strong>Just type.</strong> The transcript is an ordinary text box. Click into it and
              correct anything at any time, even mid-answer.
            </li>
            <li>
              <strong>Say “sorry”.</strong> One <em>sorry</em> deletes the last part of the sentence
              — back to the previous comma. <em>“sorry sorry”</em> deletes the last two parts,
              <em>“sorry sorry ignore”</em> the last three, and so on. It never wipes the whole
              answer. Anything you say after the correction carries straight on.
            </li>
            <li>
              <strong>Highlight and replace.</strong> Select the words that came out wrong, press
              <em>✂️ Replace highlighted</em>, and keep talking — the new words land exactly where
              the old ones were, not at the end.
            </li>
          </ul>
          <p class="ji-howto-words">
            Words that count as a correction:
            <code>sorry</code> · <code>scratch that</code> · <code>ignore that</code> ·
            <code>forget that</code> · <code>oops</code> · <code>correction</code> ·
            <code>let me rephrase</code>
          </p>
          <label class="ji-inline-check">
            <input type="checkbox" v-model="form.voiceEditing">
            Let spoken corrections edit my answer
          </label>
          <p class="ji-hint">
            Turn this off if your interview is about something where you would say those words for
            real. You can still type and highlight, and you can switch it back on in the room.
          </p>
        </div>

        <p class="ji-hint">⚠️ The next page will request camera &amp; microphone permission. Your answers are transcribed by AI.</p>
        <button type="submit" class="ji-btn-primary" :disabled="submitting">
          {{ submitting ? 'Preparing…' : 'Enter Interview Room →' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { pickInterviewer } from '@/cast/actors';
import { useAuthStore } from '@/store/auth';
import { cvBuilderService, type CvSummary } from '@/services/cvbuilder.service';
import { jobInterviewService } from '@/services/jobinterview.service';
import {
  MAX_MINUTES, MAX_QUESTIONS, MIN_MINUTES, MIN_QUESTIONS,
  askedQuestionsFrom, clampMinutes, clampQuestionCount, cvDigest, cvLabel,
  minutesForQuestions, newSessionSeed, plannedQuestionCount, secondsPerAnswer,
  type InterviewConfig,
} from '@/utils/interviewSetup';

const router = useRouter();
const authStore = useAuthStore();

const TYPE_INFO: Record<string, string> = {
  'Technical': '🛠️ A technical interview for a specific role/topic. Add qualifications to get tailored, deeper questions.',
  'HR': '🤝 A behavioral / soft-skills interview: motivation, teamwork, strengths, handling pressure, career goals.'
};

/**
 * The counts worth one click.
 *
 * Six is the default because it is one real interview's worth at nine minutes:
 * long enough to be a rehearsal rather than a sample, short enough to sit
 * before work. Two is here because it is the floor and somebody wants it the
 * evening before an interview.
 */
const QUICK_PICKS = [2, 4, 6, 8, 10, 12] as const;

const form = reactive({
  type: 'Technical',
  topic: '',
  qualifications: '',
  questions: 6,
  minutes: minutesForQuestions(6),
  cvId: '',
  voiceEditing: true,
});

const questionCount = computed(() => clampQuestionCount(form.questions));
const suggestedMinutes = computed(() => minutesForQuestions(questionCount.value));
/**
 * Minutes bought on top of the plan.
 *
 * Clamped up rather than validated: a candidate who lowers the question count
 * after raising the time should not be told off by a form, and a total below
 * what the questions need is not a preference, it is a number that has gone
 * stale.
 */
const totalMinutes = computed(() =>
  Math.max(suggestedMinutes.value, clampMinutes(form.minutes)));
const extraMinutes = computed(() => totalMinutes.value - suggestedMinutes.value);
const perAnswerLabel = computed(() => {
  const seconds = secondsPerAnswer(totalMinutes.value, questionCount.value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});

/**
 * Changing the count re-plans the time, and only upwards from the new floor.
 *
 * Extra minutes the candidate deliberately bought are KEPT when they add a
 * question -- resetting the total to the bare plan every time the count moves
 * would silently undo a choice they made two fields ago.
 */
function pickQuestions(n: number) {
  form.questions = clampQuestionCount(n);
  form.minutes = Math.max(minutesForQuestions(form.questions), clampMinutes(form.minutes));
}

watch(() => form.questions, () => {
  form.minutes = Math.max(minutesForQuestions(form.questions), clampMinutes(form.minutes));
});

const cvs = ref<CvSummary[]>([]);
const cvState = ref<'loading' | 'ready' | 'error'>('loading');
const cvLoading = ref(false);
const submitting = ref(false);
const isRedo = ref(false);

/**
 * The CV a redo arrived with: its id and the digest that was sent to the
 * interviewer last time.
 *
 * Kept so a redo whose CV Builder call fails still interviews against the CV it
 * is meant to. The id is kept ALONGSIDE the digest and checked before the digest
 * is used -- without that, picking a different CV and having app 33 fail would
 * send the previous CV's text under the new CV's title, and the stored report
 * would name a CV the interviewer never read.
 */
let carriedCvId = '';
let carriedCvSummary = '';

/**
 * The avoid list and attempt number a redo arrived with, used when the history
 * lookup below does not come back in time.
 */
let carriedAvoidQuestions: string[] = [];
let carriedAttempt = 1;

/**
 * How long to wait for the interview history before starting anyway.
 *
 * A cold PythonAnywhere worker takes ~20s for its first answer and the room
 * calls the same service again on open. This is the one of the two waits that
 * buys only variety.
 */
const HISTORY_TIMEOUT_MS = 8000;

const typeInfo = computed(() => TYPE_INFO[form.type] || '');

function onTypeChange() {
  if (form.type === 'HR') {
    form.topic = '';
  }
}

onMounted(async () => {
  // A redo lands here with the previous sitting's answers already filled in.
  // Written by the results page and by the report at the end of a session; read
  // once and cleared, so a later visit to this page is a fresh interview rather
  // than a redo of something the user has forgotten about.
  try {
    const raw = sessionStorage.getItem('jobInterviewPrefill');
    if (raw) {
      sessionStorage.removeItem('jobInterviewPrefill');
      const prefill = JSON.parse(raw) as Partial<InterviewConfig>;
      form.type = prefill.type === 'HR' ? 'HR' : 'Technical';
      form.topic = prefill.type === 'HR' ? '' : (prefill.topic || '');
      form.qualifications = prefill.qualifications || '';
      form.questions = plannedQuestionCount(prefill);
      form.minutes = Math.max(minutesForQuestions(form.questions), clampMinutes(prefill.minutes));
      form.voiceEditing = prefill.voiceEditing !== false;
      form.cvId = prefill.cvId || '';
      carriedCvId = prefill.cvId || '';
      carriedCvSummary = prefill.cvSummary || '';
      carriedAvoidQuestions = prefill.avoidQuestions || [];
      carriedAttempt = Math.max(1, Math.round(Number(prefill.attempt) || 1));
      isRedo.value = true;
    }
  } catch { /* a corrupt prefill is a normal form, not an error */ }

  const userId = authStore.user?.id;
  if (!userId) { cvState.value = 'ready'; return; }
  try {
    cvs.value = await cvBuilderService.listCvs(userId);
    // A CV that has since been deleted must not sit in the select as a value
    // with no option: the browser renders that as a blank row and the interview
    // starts with no CV while the page says one is attached.
    if (form.cvId && !cvs.value.some(cv => cv.id === form.cvId)) {
      form.cvId = '';
      carriedCvId = '';
      carriedCvSummary = '';
    }
    cvState.value = 'ready';
  } catch (e) {
    console.error('Could not list CVs:', e);
    cvState.value = 'error';
  }
});

/**
 * The attached CV, rendered for the interviewer to read.
 *
 * Resolved HERE rather than in the interview room, because the room is
 * re-created by a reload and would then have to reach app 33 again mid-session
 * — one more service that has to be warm for an interview already in progress.
 * The text travels in the config, exactly as the topic and the interviewer do.
 */
async function resolveCvSummary(): Promise<{ summary: string; title: string }> {
  const chosen = cvs.value.find(cv => cv.id === form.cvId);
  if (!form.cvId || !chosen) return { summary: '', title: '' };

  const title = cvLabel(chosen);
  // Only for the CV the digest actually belongs to.
  const carried = form.cvId === carriedCvId ? carriedCvSummary : '';
  const userId = authStore.user?.id;
  if (!userId) return { summary: carried, title };

  cvLoading.value = true;
  try {
    const record = await cvBuilderService.getCv(userId, form.cvId);
    return { summary: cvDigest(record), title };
  } catch (e) {
    // Falling back to the digest a redo carried in beats losing the CV; and
    // with neither, the interview runs without one rather than not at all.
    console.error('Could not read the selected CV:', e);
    return { summary: carried, title };
  } finally {
    cvLoading.value = false;
  }
}

async function startSession() {
  if (form.type === 'Technical' && !form.topic.trim()) {
    alert('Please enter the role / topic for a Technical interview.');
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    const topic = form.type === 'Technical' ? form.topic.trim() : 'HR / General';
    const { summary, title } = await resolveCvSummary();

    // A CV was chosen and its content could not be read. Say so rather than
    // running the interview without it: the report would otherwise record a CV
    // the interviewer never saw, and the candidate would read questions that
    // ignore their experience as the feature not working.
    if (form.cvId && !summary) {
      const goOn = confirm(
        'Your CV could not be loaded from the CV Builder, so the interviewer will not be '
        + 'able to read it.\n\nStart the interview anyway without the CV?');
      if (!goOn) return;
    }
    // Only claim a CV that was actually handed over. The id is still carried, so
    // a later redo can try to read it again.
    const attachedTitle = summary ? title : '';

    // What this candidate has already been asked about this role, so a second
    // sitting is a second sitting rather than a re-run.
    //
    // Best effort, and bounded: app 27 may be a cold PythonAnywhere worker, and
    // the interview room calls it again the moment it opens. Making somebody
    // wait out two cold starts to enter a room is a worse bug than a redo that
    // occasionally repeats a question, so the lookup races a timeout and
    // whatever a redo carried in is the fallback.
    let avoidQuestions = carriedAvoidQuestions;
    let attempt = carriedAttempt;
    try {
      const userId = authStore.user?.id;
      if (userId) {
        const past = await Promise.race([
          jobInterviewService.getUserSessions(userId),
          new Promise<null>(resolve => setTimeout(() => resolve(null), HISTORY_TIMEOUT_MS)),
        ]);
        if (past) {
          avoidQuestions = askedQuestionsFrom(past, { type: form.type, topic });
          attempt = past.filter(s =>
            (s.interview_type === 'HR' ? 'HR' : 'Technical') === form.type &&
            (s.topic || '').trim().toLowerCase() === topic.toLowerCase()).length + 1;
        }
      }
    } catch (e) {
      console.error('Could not read past interviews:', e);
    }

    const config: InterviewConfig = {
      type: form.type === 'HR' ? 'HR' : 'Technical',
      topic,
      qualifications: form.qualifications.trim(),
      questions: questionCount.value,
      minutes: totalMinutes.value,
      // Minted once, here, and carried: the room re-derives its question plan
      // after a reload, and a seed regenerated there would re-plan an interview
      // somebody is halfway through. Same reasoning as the interviewer below.
      sessionSeed: newSessionSeed(),
      voiceEditing: form.voiceEditing,
      // Who conducts it is decided here, once, and travels in the config for the
      // same reason the topic does: the session view is re-created by a reload,
      // and re-casting there would swap the interviewer for a different person
      // partway through an interview.
      interviewer: pickInterviewer().id,
      cvId: form.cvId || undefined,
      cvTitle: attachedTitle || undefined,
      cvSummary: summary || undefined,
      attempt,
      avoidQuestions,
    };
    sessionStorage.setItem('jobInterviewConfig', JSON.stringify(config));
    router.push({ path: '/job-interview/session' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style src="@/assets/css/job-interview.css"></style>
