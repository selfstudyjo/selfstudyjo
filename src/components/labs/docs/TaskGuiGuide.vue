<template>
  <div class="stg">
    <p v-if="loading" class="stg__state">{{ $t('Preparing the GUI walkthrough...') }}</p>
    <template v-else-if="sections.length">
      <p class="stg__intro">
        {{ $t('The same task, done by clicking. Watch the walkthrough, or step through it with the list - then open the tool and do it yourself.') }}
      </p>
      <nav v-if="sections.length > 1" class="stg__pick" :aria-label="$t('GUI walkthroughs for this task')">
        <button v-for="(section, at) in sections" :key="at" type="button"
                :class="{ 'is-active': at === picked }" @click="picked = at">
          {{ at + 1 }}. {{ section.title }}
        </button>
      </nav>
      <GuiWalkthrough :key="picked" :section="sections[picked]" :autoplay="true" />
      <div class="stg__open">
        <button type="button" class="sl-btn sl-btn--primary sl-btn--sm" @click="$emit('open-tool', sections[picked].toolId)">
          {{ $t('Open {v0} and do it', { v0: toolLabel(sections[picked].toolId) }) }}
        </button>
      </div>
    </template>
    <div v-else class="stg__state stg__state--left">
      <p><strong>{{ $t('This task is done in the terminal.') }}</strong></p>
      <p>{{ $t('None of the graphical tools in this lab can do this step - it is a command, so the Terminal tab has the instructions. Everything you do there is saved and checked the same way.') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The GUI tab of a task's information window. Its own async chunk: the recipe
 * maps, the walkthrough component and (behind that) three.js are fetched only
 * when somebody presses the tab.
 */
import { computed, onMounted, ref, watch } from 'vue';
import GuiWalkthrough from './GuiWalkthrough.vue';
import { loadMaps, workspaceMap } from '@/utils/labWalkthrough';
import { guiSections, skinsForLab, type GuiSection, type WalkthroughMap } from '@/utils/labDocs';
import type { LabTask, LabTool } from '@/utils/labCatalogue';

const props = defineProps<{ task: LabTask; tools: LabTool[] }>();
defineEmits<{ (event: 'open-tool', toolId: string): void }>();

const maps = ref<Record<string, WalkthroughMap>>({});
const loading = ref(true);
const picked = ref(0);

const sections = computed<GuiSection[]>(() =>
  guiSections(props.task, props.tools, maps.value, workspaceMap));

function toolLabel(id: string) {
  return props.tools.find(tool => tool.id === id)?.label || id;
}

async function load() {
  loading.value = true;
  maps.value = await loadMaps(skinsForLab(props.tools));
  loading.value = false;
}

onMounted(load);
watch(() => props.task?.id, () => { picked.value = 0; });
</script>

<style scoped>
.stg__intro { font-size: 0.9rem; color: var(--sfs-text-muted, #94a3b8); margin: 0 0 0.5rem; }
.stg__pick { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.stg__pick button { font: inherit; font-size: 0.82rem; padding: 0.3rem 0.7rem; border-radius: 999px; cursor: pointer; color: inherit;
  border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.35); background: transparent; }
.stg__pick button.is-active { border-color: var(--sfs-accent, #667eea); background: rgb(var(--sfs-accent-rgb, 102 126 234) / 0.16); }
.stg__open { display: flex; justify-content: flex-end; }
.stg__state { text-align: center; padding: 1.5rem 0.5rem; color: var(--sfs-text-muted, #94a3b8); }
.stg__state--left { text-align: start; }
.stg__state p { margin: 0.3rem 0; }
</style>
