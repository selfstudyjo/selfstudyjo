<template>
  <div class="ji-page">
    <div class="ji-form-card">
      <h1>{{ $t('🎯 Prepare Your Interview') }}</h1>
      <p>{{ $t('Configure your mock interview. The AI interviewer will ask questions one at a time and wait for your answers.') }}</p>

      <div class="ji-redo-banner" v-if="isRedo">
        🔁 <strong>{{ $t('Practising again.') }}</strong> {{ $t('Your role and requirements are filled in from your last interview — change anything you like, or just start. The interviewer knows which questions you have already been asked and will cover different ground.') }}
      </div>

      <form @submit.prevent="startSession">
        <label>{{ $t('Interview Type *') }}</label>
        <select v-model="form.type" @change="onTypeChange" required>
          <option value="Technical">{{ $t('Technical Interview (role / topic based)') }}</option>
          <option value="HR">{{ $t('HR Interview (behavioral / soft skills)') }}</option>
        </select>

        <div class="ji-type-info" v-html="typeInfo"></div>

        <!--
          THE CANDIDATE'S OWN QUESTIONS. A recruiter's list, the questions a
          friend was asked at the same company last month, a course's revision
          sheet: rehearsing a SPECIFIC list is the commonest way people prepare,
          and until this box the interviewer could only ask its own.

          One question per line, because that is the shape a pasted list already
          has; bullets and numbering are stripped in `parseCustomQuestions`, and
          the preview below shows exactly what the interviewer will read, so a
          line that parsed badly is visible before the room rather than in it.
        -->
        <label class="ji-inline-check ji-custom-toggle">
          <input type="checkbox" v-model="form.customOn">
          {{ $t('Add questions manually') }}
        </label>
        <div class="ji-custom" v-if="form.customOn">
          <label for="ji-custom-questions">{{ $t('Your questions — one per line *') }}</label>
          <textarea
            id="ji-custom-questions"
            v-model="form.customText"
            rows="8"
            class="ji-textarea"
            dir="auto"
            :placeholder="customPlaceholder"
          ></textarea>
          <p class="ji-hint">
            {{ $t('💡 Paste a list straight from a job posting, a document or an email. Bullets and numbering are removed for you; repeated questions are asked once. Up to {v0} questions.', { v0: MAX_CUSTOM_QUESTIONS }) }}
          </p>

          <p class="ji-hint ji-custom-warn" v-if="parsed.duplicates || parsed.overflow || parsed.clipped">
            <template v-if="parsed.duplicates">{{ $t('⚠️ {v0} repeated line(s) removed.', { v0: parsed.duplicates }) }} </template>
            <template v-if="parsed.overflow">{{ $t('⚠️ Only the first {v0} questions are used; {v1} more were left out.', { v0: MAX_CUSTOM_QUESTIONS, v1: parsed.overflow }) }} </template>
            <template v-if="parsed.clipped">{{ $t('⚠️ {v0} very long line(s) were shortened to {v1} characters.', { v0: parsed.clipped, v1: MAX_CUSTOM_QUESTION_CHARS }) }}</template>
          </p>

          <details class="ji-custom-preview" v-if="ownCount" open>
            <summary>{{ $t('The interviewer will ask these {v0} question(s)', { v0: ownCount }) }}</summary>
            <ol dir="auto">
              <li v-for="(q, i) in previewQuestions" :key="i">{{ q }}</li>
            </ol>
          </details>

          <label class="ji-inline-check">
            <input type="checkbox" v-model="form.customShuffle">
            {{ $t('Ask them in a random order') }}
          </label>
          <p class="ji-hint">
            {{ $t('Real interviewers do not follow your list. Shuffling makes sure you know each answer, not just the order.') }}
          </p>

          <label class="ji-inline-check">
            <input type="checkbox" v-model="form.customExtra">
            {{ $t('After my questions, let the interviewer add its own') }}
          </label>
          <p class="ji-hint">
            {{ $t('Your questions always come first and are all asked. The interviewer then adds new questions on the role, requirements and CV above — never repeating one of yours.') }}
          </p>

          <p class="ji-hint">
            {{ $t('📝 Your report is the same as a normal interview: every answer gets feedback, a model answer to rehearse, and your own answer rewritten to be stronger.') }}
          </p>
        </div>

        <div v-if="form.type === 'Technical'">
          <label>{{ $t('Role / Topic *') }}</label>
          <input v-model="form.topic" list="ji-topic-suggestions"
                 :placeholder="$t('e.g., Python Developer, DevOps, Frontend Engineer')" :required="form.type === 'Technical'">
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
          {{ $t('Qualifications / Job Requirements (optional)') }}
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
        <p class="ji-hint">{{ $t('💡 If you fill this in, the interviewer will ask questions specifically related to these qualifications.') }}</p>

        <!--
          The CV is optional and stays optional. An interview that cannot start
          because the CV Builder is cold is a worse feature than one conducted
          without a CV, so every failure below leaves the select disabled with a
          sentence saying why rather than blocking the form.
        -->
        <label for="ji-cv-select">{{ $t('Attach a CV (optional)') }}</label>
        <select id="ji-cv-select" v-model="form.cvId" :disabled="cvState !== 'ready' || !cvs.length">
          <option value="">{{ $t('— No CV — interview me on the role and requirements only') }}</option>
          <option v-for="cv in cvs" :key="cv.id" :value="cv.id">{{ cvLabel(cv) }}</option>
        </select>

        <p class="ji-hint" v-if="cvState === 'loading'">{{ $t('⏳ Loading your CVs from the CV Builder…') }}</p>
        <p class="ji-hint" v-else-if="cvState === 'error'">
          {{ $t('⚠️ Could not reach the CV Builder right now, so no CV can be attached. Everything else works — you can start the interview without one.') }}
        </p>
        <p class="ji-hint" v-else-if="!cvs.length">
          {{ $t('📄 You have no CVs yet.') }}
          <router-link to="/cv-builder">{{ $t('Build one in the CV Builder') }}</router-link>
          {{ $t('and the interviewer will read it before asking anything.') }}
        </p>
        <p class="ji-hint" v-else-if="form.cvId">
          {{ $t('✅ The interviewer will read this CV and ask about what is actually on it — your real projects, the gaps against the requirements, and the claims worth probing.') }}
          <span v-if="cvLoading"> {{ $t('Loading it now…') }}</span>
        </p>
        <p class="ji-hint" v-else>
          {{ $t('💡 Attaching a CV makes the interview far more realistic: questions come from your own experience rather than from the role title alone.') }}
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
        <!--
          With the candidate's own list the count is either the list (nothing
          to choose) or a TOTAL with the list as its floor. One number either
          way, which `plannedQuestionCount` reads -- there is no separate flag
          that could disagree with it.
        -->
        <template v-if="usingOwn && !form.customExtra">
          <label>{{ $t('How many questions?') }}</label>
          <p class="ji-hint ji-custom-count">
            <strong>{{ $t('{v0} — your list', { v0: ownCount }) }}</strong>
            {{ $t('· planned at 1:30 each, so') }}
            <strong>{{ $t('{v0} minutes', { v0: suggestedMinutes }) }}</strong>.
          </p>
        </template>
        <template v-else-if="usingOwn">
          <label for="ji-question-count">{{ $t('Total questions (yours + the interviewer’s) *') }}</label>
          <input id="ji-question-count" type="number" v-model.number="form.questions"
                 :min="ownCount + 1" :max="MAX_CUSTOM_QUESTIONS" required>
          <p class="ji-hint">
            {{ $t('{v0} of yours, then {v1} from the interviewer — {v2} minutes at 1:30 each.', { v0: ownCount, v1: planCount - ownCount, v2: suggestedMinutes }) }}
          </p>
        </template>
        <template v-else>
          <label for="ji-question-count">{{ $t('How many questions? *') }}</label>
          <input id="ji-question-count" type="number" v-model.number="form.questions"
                 :min="MIN_QUESTIONS" :max="MAX_QUESTIONS" required>
          <div class="ji-quick-picks">
            <button type="button" v-for="n in QUICK_PICKS" :key="n"
                    class="ji-quick-pick" :class="{ on: form.questions === n }"
                    @click="pickQuestions(n)">{{ n }}</button>
          </div>
          <p class="ji-hint">
            {{ $t('From {v0} to {v1}. Each answer is planned at', { v0: MIN_QUESTIONS, v1: MAX_QUESTIONS }) }}
            <strong>{{ $t('1 minute 30') }}</strong> {{ $t('— so {v0} questions is', { v0: questionCount }) }}
            <strong>{{ $t('{v0} minutes', { v0: suggestedMinutes }) }}</strong>.
          </p>
        </template>

        <label for="ji-minutes">{{ $t('Total time (minutes)') }}</label>
        <input id="ji-minutes" type="number" v-model.number="form.minutes"
               :min="suggestedMinutes" :max="MAX_MINUTES">
        <p class="ji-hint">
          <template v-if="extraMinutes > 0">
            {{ $t('⏱️ {v0} extra minute{v1} — about', { v0: extraMinutes, v1: extraMinutes === 1 ? '' : 's' }) }} <strong>{{ perAnswerLabel }}</strong> {{ $t('per answer instead of 1:30.') }}
          </template>
          <template v-else>
            {{ $t('Set from your question count. Raise it if you want longer than 1:30 to think and answer; it cannot go below what {v0} questions need.', { v0: planCount }) }}
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
          <h3>{{ $t('🎙️ Fixing what you said, while you say it') }}</h3>
          <p>
            {{ $t('Your speech is transcribed live into an') }} <strong>{{ $t('editable') }}</strong> {{ $t('box. If you start a sentence badly — which everybody does, and non-native speakers do more — you do not have to live with it in your report.') }}
          </p>
          <ul>
            <li>
              <strong>{{ $t('Just type.') }}</strong> {{ $t('The transcript is an ordinary text box. Click into it and correct anything at any time, even mid-answer.') }}
            </li>
            <li>
              <strong>{{ $t('Say “sorry”.') }}</strong> {{ $t('One') }} <em>{{ $t('sorry') }}</em> {{ $t('deletes the last part of the sentence — back to the previous comma.') }} <em>{{ $t('“sorry sorry”') }}</em> {{ $t('deletes the last two parts,') }}
              <em>{{ $t('“sorry sorry ignore”') }}</em> {{ $t('the last three, and so on. It never wipes the whole answer. Anything you say after the correction carries straight on.') }}
            </li>
            <li>
              <strong>{{ $t('Highlight and replace.') }}</strong> {{ $t('Select the words that came out wrong, press') }}
              <em>{{ $t('✂️ Replace highlighted') }}</em>{{ $t(', and keep talking — the new words land exactly where the old ones were, not at the end.') }}
            </li>
          </ul>
          <p class="ji-howto-words">
            {{ $t('Words that count as a correction:') }}
            <code>sorry</code> · <code>scratch that</code> · <code>ignore that</code> ·
            <code>forget that</code> · <code>oops</code> · <code>correction</code> ·
            <code>let me rephrase</code>
          </p>
          <label class="ji-inline-check">
            <input type="checkbox" v-model="form.voiceEditing">
            {{ $t('Let spoken corrections edit my answer') }}
          </label>
          <p class="ji-hint">
            {{ $t('Turn this off if your interview is about something where you would say those words for real. You can still type and highlight, and you can switch it back on in the room.') }}
          </p>
        </div>

        <!--
          LIVE INTERVIEW. Off by default: the button-driven room is what every
          candidate has used so far, and switching how turns are taken without
          being asked would be a surprise in the middle of an interview.
          Explained here, before the room, because in live mode there are no
          buttons to discover it from.
        -->
        <div class="ji-howto ji-live-option">
          <h3>{{ $t('🎙️ Live interview') }}</h3>
          <label class="ji-inline-check">
            <input type="checkbox" v-model="form.liveInterview">
            {{ $t('Run it as a live interview — no buttons, just talk') }}
          </label>
          <ul>
            <li>{{ $t('The microphone listens all the time. Start answering whenever you are ready — there is no “Start Answering” or “Submit” button.') }}</li>
            <li>{{ $t('Your answer ends when you stop talking for about two seconds, and the interviewer moves on — exactly as in a real call.') }}</li>
            <li>{{ $t('If you talk over the interviewer, they stop and listen. Each time is counted as an interruption, and your report treats it as a communication weakness.') }}</li>
            <li>{{ $t('You can still mute your microphone, pause to edit your answer, and end the interview at any time.') }}</li>
          </ul>
          <p class="ji-hint">{{ $t('Use headphones if you can: they stop the interviewer’s voice reaching your microphone.') }}</p>
        </div>

        <!--
          THE RULES, BEFORE THE ROOM, and working rule 53 is unambiguous about
          why: a system that penalises somebody owes them the rule beforehand,
          the reason at the time and the evidence afterwards. The interview
          records conduct on a PUBLIC activity record, so the one place this
          could go is in front of the button that opens the room.

          `IntegrityRules` rather than a hand-written list: the numbers come out
          of the same catalogue the ledger scores with, and a table of penalties
          that disagrees with the penalties actually applied is worse than no
          table at all.
        -->
        <div class="ji-howto">
          <h3>{{ $t('📋 What is recorded, and what it is worth') }}</h3>
          <p>
            {{ $t('An interview here is practice, so nothing below can fail you — there is no mark to void. What it does is keep a record: the turns you actually speak earn points, and leaving the window, pasting an answer in or walking out partway costs them. That record is public.') }}
          </p>
          <ul class="ji-rules-list">
            <li v-for="(rule, index) in integrityRules" :key="index">
              {{ $t(rule.key, rule.params) }}
            </li>
          </ul>
          <p class="ji-hint">
            {{ $t('Pasting is the one worth reading twice: the transcript is the record of what you said, so a pasted answer is coached and reported as speech you never gave.') }}
          </p>
        </div>

        <p class="ji-hint">{{ $t('⚠️ The next page will request camera & microphone permission. Your answers are transcribed by AI.') }}</p>
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
import { roomEarningRules } from '@/utils/practiceIntegrity';
import { t } from '@/i18n/runtime';
import {
  MAX_CUSTOM_QUESTIONS, MAX_CUSTOM_QUESTION_CHARS, MAX_MINUTES, MAX_QUESTIONS, MIN_MINUTES,
  MIN_QUESTIONS,
  askedQuestionsFrom, clampMinutes, clampQuestionCount, cleanCustomList, cvDigest, cvLabel,
  minutesForPlan, minutesForQuestions, newSessionSeed, parseCustomQuestions,
  plannedQuestionCount, secondsPerAnswer, shuffleQuestions,
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
  // Off by default: see the template.
  liveInterview: false,
  // The candidate's own questions. Off by default: the AI-planned interview is
  // still the right answer for somebody who has not been handed a list.
  customOn: false,
  customText: '',
  customShuffle: false,
  customExtra: false,
});

const questionCount = computed(() => clampQuestionCount(form.questions));

/** The pasted list as the room will ask it, plus what was left out and why. */
const parsed = computed(() => form.customOn
  ? parseCustomQuestions(form.customText)
  : { questions: [] as string[], duplicates: 0, overflow: 0, clipped: 0 });
const ownCount = computed(() => parsed.value.questions.length);
/** Ticked AND non-empty: an empty list is an AI interview, not a refusal. */
const usingOwn = computed(() => form.customOn && ownCount.value > 0);
/** The preview, in its stored order -- the shuffle happens once, at submit. */
const previewQuestions = computed(() => parsed.value.questions);

/**
 * How many questions this sitting has, whichever way it was set up.
 *
 * With the candidate's list and no extras it IS the list. With extras it is a
 * total whose floor is one more than the list -- "add your own" with nothing
 * added would be a box that did nothing.
 */
const planCount = computed(() => {
  if (!usingOwn.value) return questionCount.value;
  if (!form.customExtra) return ownCount.value;
  const wanted = Math.round(Number(form.questions)) || 0;
  return Math.min(MAX_CUSTOM_QUESTIONS, Math.max(ownCount.value + 1, wanted));
});
const suggestedMinutes = computed(() => usingOwn.value
  ? minutesForPlan(planCount.value)
  : minutesForQuestions(questionCount.value));

/**
 * An example of the shape the box wants, in the reader's language.
 *
 * Localised, unlike the requirements example above it, because this field holds
 * the reader's own content -- the rule `untranslated.json` documents for
 * placeholders: localise where the field is the reader's data.
 */
const customPlaceholder = computed(() => [
  t('One question per line, for example:'),
  t('Tell me about yourself.'),
  t('Why do you want to work here?'),
  t('Explain the difference between a process and a thread.'),
  t('Describe a time you disagreed with your manager.'),
].join('\n'));
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
  const seconds = secondsPerAnswer(totalMinutes.value, planCount.value);
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

// The same rule for the candidate's list: the minutes follow the plan upwards
// and keep any extra the candidate deliberately bought.
watch(planCount, count => {
  if (!usingOwn.value) return;
  form.minutes = Math.max(minutesForPlan(count), clampMinutes(form.minutes));
});

// Ticking "let the interviewer add its own" starts from a total that actually
// adds something, rather than leaving a count below the list that the input
// then shows as invalid.
watch(() => form.customExtra, on => {
  if (on && Math.round(Number(form.questions)) <= ownCount.value) {
    form.questions = Math.min(MAX_CUSTOM_QUESTIONS, ownCount.value + 3);
  }
});

const cvs = ref<CvSummary[]>([]);
const cvState = ref<'loading' | 'ready' | 'error'>('loading');
const cvLoading = ref(false);
const submitting = ref(false);

/**
 * What the ledger pays and charges in this room, priced IN this room.
 *
 * Derived from `ACTIONS` rather than written out here, because a page that
 * promises the wrong figure is worse than a page that promises nothing - and
 * the base prices are a PAPER's, so quoting them would tell a candidate a
 * switched window costs four when in an interview it costs three.
 */
const integrityRules = roomEarningRules('interview');
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
      form.liveInterview = prefill.liveInterview === true;
      // A redo of an interview with the candidate's own list comes back with
      // the list in the box -- rehearsing the same questions again is the
      // point of pressing "practise again" on one.
      const own = cleanCustomList(prefill.customQuestions);
      if (own.length) {
        form.customOn = true;
        form.customText = own.join('\n');
        form.customExtra = plannedQuestionCount(prefill) > own.length;
        form.questions = plannedQuestionCount(prefill);
        form.minutes = Math.max(minutesForPlan(form.questions), clampMinutes(prefill.minutes));
      }
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
    alert(t('Please enter the role / topic for a Technical interview.'));
    return;
  }
  // Ticked with nothing usable in the box. Starting an AI interview instead
  // would be the room quietly ignoring a choice the candidate made on purpose.
  if (form.customOn && !ownCount.value) {
    alert(t('Add at least one question (one per line), or untick "Add questions manually".'));
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

    // Minted once, here, and carried: the room re-derives its question plan
    // after a reload, and a seed regenerated there would re-plan an interview
    // somebody is halfway through. Same reasoning as the interviewer below.
    const sessionSeed = newSessionSeed();
    const own = usingOwn.value
      ? (form.customShuffle ? shuffleQuestions(parsed.value.questions, sessionSeed) : parsed.value.questions)
      : [];

    const config: InterviewConfig = {
      type: form.type === 'HR' ? 'HR' : 'Technical',
      topic,
      qualifications: form.qualifications.trim(),
      questions: planCount.value,
      minutes: totalMinutes.value,
      sessionSeed,
      customQuestions: own.length ? own : undefined,
      voiceEditing: form.voiceEditing,
      liveInterview: form.liveInterview || undefined,
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
