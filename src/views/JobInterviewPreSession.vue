<template>
  <div class="ji-page">
    <div class="ji-form-card">
      <h1>🎯 Prepare Your Interview</h1>
      <p>Configure your mock interview. The AI interviewer will ask questions one at a time and wait for your answers.</p>

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

        <label>Interview Duration (minutes) *</label>
        <input type="number" v-model.number="form.minutes" min="3" max="60" required>

        <p class="ji-hint">⚠️ The next page will request camera & microphone permission. Your answers are transcribed by AI.</p>
        <button type="submit" class="ji-btn-primary">Enter Interview Room →</button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const TYPE_INFO: Record<string, string> = {
  'Technical': '🛠️ A technical interview for a specific role/topic. Add qualifications to get tailored, deeper questions.',
  'HR': '🤝 A behavioral / soft-skills interview: motivation, teamwork, strengths, handling pressure, career goals.'
};

const form = reactive({
  type: 'Technical',
  topic: '',
  qualifications: '',
  minutes: 15
});

const typeInfo = computed(() => TYPE_INFO[form.type] || '');

function onTypeChange() {
  if (form.type === 'HR') {
    form.topic = '';
  }
}

function startSession() {
  if (form.type === 'Technical' && !form.topic.trim()) {
    alert('Please enter the role / topic for a Technical interview.');
    return;
  }
  const config = {
    type: form.type,
    topic: form.type === 'Technical' ? form.topic.trim() : 'HR / General',
    qualifications: form.qualifications.trim(),
    minutes: Math.max(3, Math.min(60, form.minutes || 15))
  };
  sessionStorage.setItem('jobInterviewConfig', JSON.stringify(config));
  router.push({ path: '/job-interview/session' });
}
</script>

<style src="@/assets/css/job-interview.css"></style>