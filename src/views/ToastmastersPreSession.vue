<template>
  <div class="tm-page">
    <div class="tm-form-card">
      <h1>{{ $t('🎯 Prepare Your Session') }}</h1>
      <p>{{ $t('Choose your role and configure today\'s session.') }}</p>
      <form @submit.prevent="startSession">

        <label>{{ $t('Your Role *') }}</label>
        <select v-model="form.role" @change="updateRole" required>
          <option value="Speaker">{{ $t('🎤 Speaker — Deliver a speech') }}</option>
          <option value="Toastmaster">{{ $t('🎙️ Toastmaster — Host the meeting') }}</option>
          <option value="Timer">{{ $t('⏱️ Timer — Track speech duration') }}</option>
          <option value="Ah-Counter">{{ $t('🗣️ Ah-Counter — Count filler words') }}</option>
          <option value="Grammarian">{{ $t('✍️ Grammarian — Analyze language & grammar') }}</option>
          <option value="Speech Evaluator">{{ $t('📋 Speech Evaluator — Evaluate a speech') }}</option>
          <option value="General Evaluator">{{ $t('🎯 General Evaluator — Overall meeting feedback') }}</option>
        </select>

        <div class="tm-type-info" v-html="roleInfo"></div>

        <div v-if="showSpeechType">
          <label>{{ $t('Speech Type *') }}</label>
          <select v-model="form.type" @change="updateType" required>
            <option value="Prepared Speech">{{ $t('Prepared Speech') }}</option>
            <option value="Table Topics (Impromptu)">{{ $t('Table Topics (Impromptu)') }}</option>
            <option value="Ice Breaker">{{ $t('Ice Breaker (First Speech)') }}</option>
            <option value="Evaluation Speech">{{ $t('Evaluation Speech') }}</option>
            <option value="Inspirational Speech">{{ $t('Inspirational Speech') }}</option>
            <option value="Persuasive Speech">{{ $t('Persuasive Speech') }}</option>
          </select>
          <div class="tm-type-info" v-if="typeInfo" v-html="typeInfo"></div>
        </div>

        <div v-if="needsTopic">
          <label>{{ $t('Speech Topic / Title *') }}</label>
          <input v-model="form.topic" :placeholder="$t('e.g., The Power of Daily Habits')" :required="needsTopic">
        </div>

        <div class="tm-row">
          <div>
            <label>{{ $t('Min Duration (min)') }}</label>
            <input type="number" v-model.number="form.min_time" min="1" max="60" required>
          </div>
          <div>
            <label>{{ $t('Max Duration (min)') }}</label>
            <input type="number" v-model.number="form.max_time" min="1" max="60" required>
          </div>
        </div>

        <!--
          THE RULES, BEFORE THE ROOM, and working rule 53 is unambiguous about
          why: a system that penalises somebody owes them the rule beforehand,
          the reason at the time and the evidence afterwards. A meeting records
          conduct on a PUBLIC activity record, so the one place this could go is
          in front of the button that opens the room.

          This page had no explainer of any kind, so the panel is new rather
          than an addition to one - the role and speech-type blurbs above are
          descriptions of what the member has chosen, not an explanation of how
          the room works.

          A bullet list rather than the shared `IntegrityRules` table: this is a
          FORM, and a two-column penalty table between the last field and the
          submit button pushes the button off a phone. The sentences come from
          `roomEarningRules('toastmasters')`, so the figures are the room's own
          rather than a paper's - a page that promises the wrong number is worse
          than a page that promises nothing.
        -->
        <div class="tm-howto">
          <h3>{{ $t('📋 What is recorded, and what it is worth') }}</h3>
          <p>
            {{ $t('A meeting is practice, so nothing below can fail you. What it does is keep a record: taking your turn out loud earns points, and so does hearing every other speaker out — while leaving the window, pasting your speech in or leaving partway costs them. That record is public.') }}
          </p>
          <ul class="tm-rules-list">
            <li v-for="(rule, index) in integrityRules" :key="index">
              {{ $t(rule.key, rule.params) }}
            </li>
          </ul>
          <p class="tm-hint">
            {{ $t('Copying is deliberately not recorded here — the sample speech and the word of the day are on screen for you to use. Pasting into your own transcript is, because that transcript is what the Grammarian and both Evaluators read as your speech.') }}
          </p>
        </div>

        <p class="tm-hint">{{ $t('⚠️ The next page will request camera and microphone permission.') }}</p>
        <button type="submit" class="tm-btn-primary">
          {{ form.role === 'Speaker' ? 'Join Meeting →' : `Practice ${form.role} Role →` }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { roomEarningRules } from '@/utils/practiceIntegrity';

const router = useRouter();

const ROLE_INFO: Record<string, { info: string; showSpeechType: boolean; showTopic: boolean; min: number; max: number }> = {
  'Speaker': {
    info: '🎤 <strong>Speaker Role:</strong> You will deliver a speech. Choose your speech type, topic, and duration below. AI bots will evaluate your performance.',
    showSpeechType: true, showTopic: true, min: 5, max: 7
  },
  'Toastmaster': {
    info: '🎙️ <strong>Toastmaster Role:</strong> You will practice hosting a meeting. A sample speaker (AI bot) will deliver a speech. Your job is to:<ul><li>Welcome attendees and introduce the meeting</li><li>Introduce the sample speaker</li><li>Manage transitions between segments</li><li>Close the meeting professionally</li></ul>',
    showSpeechType: false, showTopic: false, min: 2, max: 5
  },
  'Timer': {
    info: '⏱️ <strong>Timer Role:</strong> You will practice being the Timer. A sample speaker will deliver a speech. Your job is to:<ul><li>Track the speech duration carefully</li><li>Note when the traffic lights change (green → yellow → red)</li><li>Deliver a clear Timer report stating exact time and whether the speaker was within target</li></ul>',
    showSpeechType: false, showTopic: false, min: 1, max: 2
  },
  'Ah-Counter': {
    info: '🗣️ <strong>Ah-Counter Role:</strong> A sample speaker will deliver a speech WITH filler words. Your job is to:<ul><li>Listen carefully for filler words (um, uh, like, you know, basically, etc.)</li><li>Count each type of filler word</li><li>Deliver a clear, encouraging Ah-Counter report</li></ul>The AI will compare your count to the actual fillers.',
    showSpeechType: false, showTopic: false, min: 1, max: 2
  },
  'Grammarian': {
    info: '✍️ <strong>Grammarian Role:</strong> You will practice being the Grammarian. Your job is to:<ul><li>Introduce a Word of the Day before the speech</li><li>Listen for grammar quality, vocabulary, and language patterns</li><li>Deliver a Grammarian report with specific observations and quotes</li></ul>',
    showSpeechType: false, showTopic: false, min: 1, max: 3
  },
  'Speech Evaluator': {
    info: '📋 <strong>Speech Evaluator Role:</strong> A sample speaker will deliver a speech. Your job is to:<ul><li>Listen carefully to the speech content and delivery</li><li>Use the <strong>Praise-Suggest-Encourage</strong> method</li><li>Quote specific moments from the speech</li><li>Give actionable improvement suggestions</li></ul>',
    showSpeechType: false, showTopic: false, min: 2, max: 3
  },
  'General Evaluator': {
    info: '🎯 <strong>General Evaluator Role:</strong> A sample meeting will take place. Your job is to:<ul><li>Observe the entire meeting flow</li><li>Comment on timing, organization, and transitions</li><li>Evaluate individual performances holistically</li><li>Provide constructive feedback and encouragement</li></ul>',
    showSpeechType: false, showTopic: false, min: 2, max: 4
  }
};

const TYPE_INFO: Record<string, { info: string; min: number; max: number; needsTopic: boolean }> = {
  'Prepared Speech': { info: '📝 Deliver a prepared speech on your topic. Speech Evaluator will check topic alignment.', min: 5, max: 7, needsTopic: true },
  'Table Topics (Impromptu)': { info: '⚡ The Toastmaster gives you an impromptu question. <strong>Topic generated automatically.</strong>', min: 1, max: 2, needsTopic: false },
  'Ice Breaker': { info: '🌱 Your first speech — talk about yourself. <strong>Camera must be on.</strong>', min: 4, max: 6, needsTopic: true },
  'Evaluation Speech': { info: '🎯 Practice being a Speech Evaluator. A bot delivers a speech; you evaluate it.', min: 2, max: 3, needsTopic: false },
  'Inspirational Speech': { info: '💫 Lift your audience with emotional stories and vivid imagery.', min: 5, max: 7, needsTopic: true },
  'Persuasive Speech': { info: '🎯 Convince with facts and a clear call to action.', min: 5, max: 7, needsTopic: true }
};

const form = reactive({
  role: 'Speaker',
  type: 'Prepared Speech',
  topic: '',
  min_time: 5,
  max_time: 7
});

/**
 * What the ledger pays and charges in this room, priced IN this room.
 *
 * Derived from `ACTIONS` rather than written out here: the base prices are a
 * PAPER's, so quoting them would tell a member a switched window costs four
 * when in a meeting it costs three.
 */
const integrityRules = roomEarningRules('toastmasters');

const roleInfo = computed(() => ROLE_INFO[form.role]?.info || '');
const showSpeechType = computed(() => ROLE_INFO[form.role]?.showSpeechType || false);
const typeInfo = computed(() => showSpeechType.value ? (TYPE_INFO[form.type]?.info || '') : '');
const needsTopic = computed(() => {
  if (!showSpeechType.value) return false;
  return TYPE_INFO[form.type]?.needsTopic || false;
});

function updateRole() {
  const cfg = ROLE_INFO[form.role];
  if (cfg) {
    form.min_time = cfg.min;
    form.max_time = cfg.max;
    if (!cfg.showTopic) {
      form.topic = form.role + ' Practice';
    }
    if (cfg.showSpeechType) {
      updateType();
    }
  }
}

function updateType() {
  if (form.role !== 'Speaker') return;
  const cfg = TYPE_INFO[form.type];
  if (cfg) {
    form.min_time = cfg.min;
    form.max_time = cfg.max;
    if (!cfg.needsTopic) form.topic = form.type === 'Table Topics (Impromptu)' ? 'Auto-generated by Toastmaster' : 'Evaluation Practice';
  }
}

function startSession() {
  let topic = form.topic;
  if (form.role !== 'Speaker') {
    topic = form.role + ' Practice';
  } else if (!needsTopic.value) {
    topic = form.type === 'Table Topics (Impromptu)' ? 'Auto-generated by Toastmaster' : 'Evaluation Practice';
  }
  router.push({
    path: '/toastmasters/session',
    query: {
      role: form.role,
      type: form.role === 'Speaker' ? form.type : '',
      topic: topic,
      min_time: String(form.min_time),
      max_time: String(form.max_time)
    }
  });
}

updateRole();
</script>

<style src="@/assets/css/toastmasters.css"></style>