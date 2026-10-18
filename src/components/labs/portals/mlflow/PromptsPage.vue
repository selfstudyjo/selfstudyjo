<template>
  <div class="mf-page mf-prompts">
    <div class="mf-title-row">
      <h1 class="mf-title">Prompts</h1>
      <span class="mf-spacer"></span>
      <button type="button" class="mf-btn mf-btn--primary" disabled title="The Prompt Registry is not part of this lab">Create prompt</button>
    </div>
    <div class="mf-search mf-prompts__search"><MfIcon name="search" />
      <input class="mf-input" type="search" placeholder="Search prompts by name" aria-label="Search prompts" disabled /></div>
    <div class="mf-table-wrap">
      <table class="mf-table">
        <thead><tr><th>Name</th><th>Latest version</th><th>Last modified</th><th>Commit message</th><th>Tags</th></tr></thead>
      </table>
      <div class="mf-empty">
        <MfIcon name="sparkle" />
        <h3>No prompts created</h3>
        <p>The Prompt Registry versions the prompt templates of GenAI applications
          (<code class="mf-mono">mlflow.genai.register_prompt</code>). The models in this lab are classifiers and fine-tunes trained
          with <code class="mf-mono">mlx</code>, so nothing here registers a prompt.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MfIcon from './MfIcon.vue';
</script>

<style scoped src="./mf.css"></style>
<style scoped>
.mf-prompts { flex: 1; overflow: auto; }
.mf-prompts__search { width: 420px; max-width: 100%; }
@container sl-portal (max-width: 900px) { .mf-prompts { padding: 12px; } }
</style>
