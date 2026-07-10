<template>
  <div class="tm-page">
    <div class="tm-form-card">
      <h1>🎯 Prepare Your Session</h1>
      <p>Choose your role and configure today's session.</p>
      <form @submit.prevent="startSession">

        <label>Your Role *</label>
        <select v-model="form.role" @change="updateRole" required>
          <option value="Speaker">🎤 Speaker — Deliver a speech</option>
          <option value="Toastmaster">🎙️ Toastmaster — Host the meeting</option>
          <option value="Timer">⏱️ Timer — Track speech duration</option>
          <option value="Ah-Counter">🗣️ Ah-Counter — Count filler words</option>
          <option value="Grammarian">✍️ Grammarian — Analyze language &amp; grammar</option>
          <option value="Speech Evaluator">📋 Speech Evaluator — Evaluate a speech</option>
          <option value="General Evaluator">🎯 General Evaluator — Overall meeting feedback</option>
        </select>

        <div class="tm-type-info" v-html="roleInfo"></div>

        <div v-if="showSpeechType">
          <label>Speech Type *</label>
          <select v-model="form.type" @change="updateType" required>
            <option value="Prepared Speech">Prepared Speech</option>
            <option value="Table Topics (Impromptu)">Table Topics (Impromptu)</option>
            <option value="Ice Breaker">Ice Breaker (First Speech)</option>
            <option value="Evaluation Speech">Evaluation Speech</option>
            <option value="Inspirational Speech">Inspirational Speech</option>
            <option value="Persuasive Speech">Persuasive Speech</option>
          </select>
          <div class="tm-type-info" v-if="typeInfo" v-html="typeInfo"></div>
        </div>

        <div v-if="needsTopic">
          <label>Speech Topic / Title *</label>
          <input v-model="form.topic" placeholder="e.g., The Power of Daily Habits" :required="needsTopic">
        </div>

        <div class="tm-row">
          <div>
            <label>Min Duration (min)</label>
            <input type="number" v-model.number="form.min_time" min="1" max="60" required>
          </div>
          <div>
            <label>Max Duration (min)</label>
            <input type="number" v-model.number="form.max_time" min="1" max="60" required>
          </div>
        </div>

        <p class="tm-hint">⚠️ The next page will request camera and microphone permission.</p>
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