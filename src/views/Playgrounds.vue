<template>
  <!--
    EVERY TOOL'S PLAYGROUND, as a page: the top bar's menu with room to say
    what each one has in it. A playground is a free-practice workspace per tool
    (app 11's unpublished, task-less `play-*` records) - the student's own
    saved environment, its consoles, dashboards and product portal, and not a
    lab: nothing is graded and no progress is recorded.
  -->
  <div class="sfs-pg">
    <header class="sfs-pg__head">
      <div>
        <h1 class="sfs-pg__title">{{ $t('Playgrounds') }}</h1>
        <p class="sfs-pg__lead">
          {{ $t('Your own workspace for every tool on the platform - its consoles, its dashboards and its portal. Practise anything: nothing here is graded or recorded, and your work is saved between visits.') }}
        </p>
      </div>
      <router-link to="/labs" class="sfs-pg__btn">
        <FlaskConical class="sfs-pg__i" /> {{ $t('Graded labs') }}
      </router-link>
    </header>

    <div class="sfs-pg__tools">
      <label class="sfs-pg__search">
        <Search class="sfs-pg__i" aria-hidden="true" />
        <input v-model="query" type="search" :placeholder="$t('Search tools…')"
               :aria-label="$t('Search tools…')" />
      </label>
    </div>

    <p v-if="loading && !rows.length" class="sfs-pg__state">
      <Loader2 class="sfs-pg__i sfs-pg__spin" /> {{ $t('Loading the playgrounds…') }}
    </p>
    <div v-else-if="!rows.length" class="sfs-pg__state is-error">
      <p>{{ $t('The playgrounds could not be loaded.') }}</p>
      <button type="button" class="sfs-pg__btn" @click="load">{{ $t('Try again') }}</button>
    </div>
    <p v-if="rows.length && !grouped.length" class="sfs-pg__state">
      {{ $t('No tool matches that search.') }}
    </p>

    <section v-for="group in grouped" :key="group.group" class="sfs-pg__group">
      <h2 class="sfs-pg__gtitle">{{ groupLabel(group.group) }}</h2>
      <ul class="sfs-pg__grid">
        <li v-for="row in group.rows" :key="row.id">
          <router-link :to="playgroundHref(row)" class="sfs-pg__card">
            <span class="sfs-pg__glyph"><PlaygroundIcon :name="row.icon" /></span>
            <span class="sfs-pg__body">
              <span class="sfs-pg__name">{{ playgroundTitle(row) }}</span>
              <span class="sfs-pg__sum">{{ playgroundSummary(row) }}</span>
              <span v-if="visibleTools(row).length" class="sfs-pg__chips">
                <span v-for="tool in visibleTools(row)" :key="tool.id"
                      class="sfs-pg__chip" :class="{ 'is-portal': tool.kind === 'portal' }">
                  {{ tool.label }}
                </span>
              </span>
            </span>
          </router-link>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FlaskConical, Loader2, Search } from 'lucide-vue-next';
import { labsService } from '@/services/labs.service';
import { localeId } from '@/i18n/runtime';
import {
  groupPlaygrounds, playgroundHref, visibleTools, withLinked, type Playground,
} from '@/utils/playgrounds';
import {
  groupLabel, playgroundSearchText, playgroundSummary, playgroundTitle,
} from '@/composables/playgroundLabels';
import PlaygroundIcon from '@/components/playgrounds/PlaygroundIcon.vue';

const rows = ref<Playground[]>([]);
const loading = ref(false);
const query = ref('');

// The linked studios are only listed once the service has answered, so a
// failure reads as a failure rather than as a platform with two tools.
const grouped = computed(() => rows.value.length
  ? groupPlaygrounds(withLinked(rows.value), query.value, localeId.value, playgroundSearchText)
  : []);

async function load() {
  loading.value = true;
  try {
    rows.value = await labsService.getPlaygrounds();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.sfs-pg {
  max-width: 78rem;
  margin: 0 auto;
  padding: clamp(0.9rem, 2.4vw, 1.75rem);
  color: var(--sfs-text, #e6e8ef);
}
.sfs-pg__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
  margin-bottom: 1rem;
}
.sfs-pg__title { margin: 0 0 0.35rem; font-size: clamp(1.4rem, 3vw, 1.9rem); }
.sfs-pg__lead {
  max-width: 48rem;
  margin: 0;
  color: var(--sfs-text-muted, #b7bdcc);
  line-height: 1.55;
}
.sfs-pg__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  min-height: max(2.25rem, 40px);
  padding: 0.4rem 0.9rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
  border-radius: 999px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #e6e8ef);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.sfs-pg__btn:hover { background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.12); }
.sfs-pg__i { width: 1.05em; height: 1.05em; flex: 0 0 auto; }
.sfs-pg__tools { margin-bottom: 1rem; }
.sfs-pg__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 28rem;
  padding: 0 0.85rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.2);
  border-radius: 999px;
  background: rgb(var(--sfs-sink-rgb, 0 0 0) / 0.25);
  color: var(--sfs-text-muted, #b7bdcc);
}
.sfs-pg__search input {
  flex: 1;
  min-width: 0;
  min-height: max(2.4rem, 42px);
  border: 0;
  background: transparent;
  color: var(--sfs-text, #e6e8ef);
  font: inherit;
  outline: none;
}
.sfs-pg__state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  color: var(--sfs-text-muted, #b7bdcc);
}
.sfs-pg__state p { margin: 0; }
.sfs-pg__spin { animation: sfs-pg-spin 1.2s linear infinite; }
@keyframes sfs-pg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.sfs-pg__group + .sfs-pg__group { margin-top: 1.4rem; }
.sfs-pg__gtitle {
  margin: 0 0 0.6rem;
  color: var(--sfs-text-muted, #b7bdcc);
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.sfs-pg__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
  gap: 0.7rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sfs-pg__grid > li { display: flex; }
.sfs-pg__card {
  display: flex;
  flex: 1;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.85rem 0.9rem;
  border: 1px solid rgb(var(--sfs-line-rgb, 255 255 255) / 0.14);
  border-radius: 14px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s, background-color 0.15s;
}
.sfs-pg__card:hover,
.sfs-pg__card:focus-visible {
  border-color: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.55);
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.1);
  outline: none;
}
.sfs-pg__glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 10px;
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.18);
  color: var(--sfs-accent-text, #a5b4fc);
}
.sfs-pg__glyph :deep(.sfs-pg-icon) { width: 1.35rem; height: 1.35rem; }
.sfs-pg__body { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.sfs-pg__name { font-weight: 800; overflow-wrap: anywhere; }
.sfs-pg__sum {
  color: var(--sfs-text-muted, #b7bdcc);
  font-size: 0.85rem;
  line-height: 1.45;
  unicode-bidi: plaintext;
}
.sfs-pg__chips { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.15rem; }
.sfs-pg__chip {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.08);
  color: var(--sfs-text-muted, #b7bdcc);
  font-size: 0.72rem;
  font-weight: 600;
  /* A product name is an identifier: keep it left-to-right in Arabic. */
  direction: ltr;
  unicode-bidi: isolate;
}
.sfs-pg__chip.is-portal {
  background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.2);
  color: var(--sfs-text, #e6e8ef);
}
@media (prefers-reduced-motion: reduce) {
  .sfs-pg__spin { animation: none; }
  .sfs-pg__card { transition: none; }
}
</style>
