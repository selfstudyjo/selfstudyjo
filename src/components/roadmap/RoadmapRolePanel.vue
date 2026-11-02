<template>
  <!--
    What the role actually asks of somebody: the summary, the day-to-day
    responsibilities, the skills, the tools and the certifications, with the
    sources they were drawn from. Record text is English data and is rendered
    as-is (`{{ }}`, never v-html); `unicode-bidi: plaintext` lets an English
    paragraph keep its punctuation inside an Arabic page.
  -->
  <section class="rmrole" :aria-label="$t('What this role needs')">
    <h3 class="rmrole__h">{{ $t('What this role needs') }}</h3>
    <p v-if="role.summary" class="rmrole__sum rmrole__data">{{ role.summary }}</p>

    <div v-if="role.responsibilities.length" class="rmrole__block">
      <h4>{{ $t('Responsibilities') }}</h4>
      <ul class="rmrole__list">
        <li v-for="(r, i) in role.responsibilities" :key="i" class="rmrole__data">{{ r }}</li>
      </ul>
    </div>

    <div v-if="role.skills.length" class="rmrole__block">
      <h4>{{ $t('Skills') }}</h4>
      <ul class="rmrole__chips">
        <li v-for="(s, i) in role.skills" :key="i" class="rmrole__chip rmrole__data">{{ s }}</li>
      </ul>
    </div>

    <div v-if="role.tools.length" class="rmrole__block">
      <h4>{{ $t('Tools') }}</h4>
      <ul class="rmrole__chips">
        <li v-for="(s, i) in role.tools" :key="i" class="rmrole__chip is-tool rmrole__data">{{ s }}</li>
      </ul>
    </div>

    <div v-if="role.certifications.length" class="rmrole__block">
      <h4>{{ $t('Certifications') }}</h4>
      <ul class="rmrole__list">
        <li v-for="(s, i) in role.certifications" :key="i" class="rmrole__data">{{ s }}</li>
      </ul>
    </div>

    <div v-if="notes.length" class="rmrole__block">
      <h4>{{ $t('Notes') }}</h4>
      <ul class="rmrole__list">
        <li v-for="(s, i) in notes" :key="i" class="rmrole__data">{{ s }}</li>
      </ul>
    </div>

    <div v-if="sources.length" class="rmrole__block">
      <h4>{{ $t('Sources') }}</h4>
      <ul class="rmrole__list rmrole__sources">
        <li v-for="(s, i) in sources" :key="i">
          <a :href="s.href" target="_blank" rel="noopener noreferrer" class="rmrole__link">
            <span class="rmrole__data">{{ s.title || s.href }}</span>
            <ExternalLink class="rmrole__i" aria-hidden="true" />
          </a>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ExternalLink } from 'lucide-vue-next';
import { safeExternal, type RoadmapRole } from '@/utils/roadmapLayout';

const props = defineProps<{ role: RoadmapRole; notes?: string[] }>();

const notes = computed(() => props.notes || []);
/** Only http(s) sources become links; anything else is dropped. */
const sources = computed(() => props.role.sources
  .map(s => ({ title: s.title, href: safeExternal(s.url) }))
  .filter((s): s is { title: string; href: string } => !!s.href));
</script>

<style scoped>
.rmrole {
  display: grid; gap: 0.9rem;
  padding: 1rem 1.1rem;
  border-radius: var(--sfs-radius-lg, 16px);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border: 1px solid var(--sfs-border, rgba(255, 255, 255, 0.14));
  min-width: 0;
}
.rmrole__h { margin: 0; font-size: 1.05rem; color: var(--sfs-text, #f1f5f9); }
.rmrole__block { display: grid; gap: 0.4rem; min-width: 0; }
.rmrole__block h4 {
  margin: 0; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--sfs-accent-text, #a5b4fc);
}
.rmrole__data { unicode-bidi: plaintext; overflow-wrap: anywhere; }
.rmrole__sum { margin: 0; color: var(--sfs-text-muted, #cbd5e1); line-height: 1.55; font-size: 0.92rem; }
.rmrole__list { margin: 0; padding-inline-start: 1.1rem; display: grid; gap: 0.3rem;
  color: var(--sfs-text, #f1f5f9); font-size: 0.9rem; line-height: 1.45; }
.rmrole__chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.35rem; }
.rmrole__chip {
  padding: 0.2rem 0.6rem; border-radius: var(--sfs-radius-pill, 999px);
  font-size: 0.8rem; color: var(--sfs-text, #f1f5f9);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16);
  border: 1px solid rgb(var(--sfs-accent-rgb, 102 126 234) / 0.32);
}
.rmrole__chip.is-tool {
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  border-color: var(--sfs-border, rgba(255, 255, 255, 0.18));
}
.rmrole__sources { list-style: none; padding: 0; }
.rmrole__link {
  display: inline-flex; align-items: center; gap: 0.35rem;
  color: var(--sfs-accent-text, #a5b4fc); text-decoration: none;
}
.rmrole__link:hover { text-decoration: underline; }
.rmrole__i { width: 0.9em; height: 0.9em; flex: none; }
</style>
