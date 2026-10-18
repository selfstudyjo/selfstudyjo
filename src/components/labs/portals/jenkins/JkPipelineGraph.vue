<template>
  <!-- The Pipeline Graph View: one node per stage on a line, coloured by result. -->
  <div class="jk-pg">
    <ol class="jk-pg__track">
      <li class="jk-pg__node jk-pg__end"><span class="jk-pg__dot is-terminal"></span><span class="jk-pg__label">Start</span></li>
      <li v-for="stage in visible" :key="stage.name" class="jk-pg__node">
        <button type="button" class="jk-pg__btn" :class="{ 'is-selected': selected === stage.name }" :title="stage.note || stage.status"
                @click="emit('select', stage.name)">
          <span class="jk-pg__dot" :class="'is-' + tone(stage.status)">
            <svg v-if="tone(stage.status) === 'ok'" viewBox="0 0 24 24"><path d="M7 12.4l3 3 7-7.2" /></svg>
            <svg v-else-if="tone(stage.status) === 'bad'" viewBox="0 0 24 24"><path d="M8 8l8 8M16 8l-8 8" /></svg>
            <svg v-else-if="tone(stage.status) === 'warn'" viewBox="0 0 24 24"><path d="M12 6.5v6.5M12 17v.4" /></svg>
          </span>
          <span class="jk-pg__label">{{ stage.name }}</span>
          <span class="jk-pg__time">{{ stage.status === 'NOT_EXECUTED' ? 'skipped' : stageTime(stage.ms) }}</span>
        </button>
      </li>
      <li class="jk-pg__node jk-pg__end"><span class="jk-pg__dot is-terminal"></span><span class="jk-pg__label">End</span></li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { stageTime, type Stage } from './jenkinsKit';

const props = withDefaults(defineProps<{ stages: Stage[]; selected?: string }>(), { selected: '' });
const emit = defineEmits<{ (event: 'select', name: string): void }>();
const visible = computed(() => props.stages.filter(stage => !stage.name.startsWith('post / ')));

function tone(status: string): string {
  return { SUCCESS: 'ok', FAILURE: 'bad', UNSTABLE: 'warn', NOT_EXECUTED: 'skip' }[status] || 'skip';
}
</script>

<style scoped>
.jk-pg { overflow-x: auto; padding: 0.4rem 0 0.6rem; }
.jk-pg__track { display: flex; align-items: flex-start; list-style: none; margin: 0; padding: 0; min-width: max-content; }
.jk-pg__node { position: relative; display: flex; flex-direction: column; align-items: center; min-width: 6.5rem; }
.jk-pg__node + .jk-pg__node::before { content: ''; position: absolute; top: 0.95rem; right: 50%; width: 100%; height: 3px; background: #c9c8cd; z-index: 0; }
.jk-pg__btn { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0 0.3rem 0.3rem; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; border-radius: 0.6rem; }
.jk-pg__btn.is-selected .jk-pg__label { text-decoration: underline; font-weight: 650; }
.jk-pg__end { min-width: 4rem; z-index: 1; }
.jk-pg__dot { position: relative; z-index: 1; display: grid; place-items: center; width: 1.9rem; height: 1.9rem; border-radius: 50%; background: #fff; border: 3px solid #c9c8cd; box-sizing: border-box; }
.jk-pg__dot svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.jk-pg__dot.is-terminal { width: 0.9rem; height: 0.9rem; margin-top: 0.5rem; background: #c9c8cd; border: 0; }
.jk-pg__dot.is-ok { background: var(--jk-green); border-color: var(--jk-green); }
.jk-pg__dot.is-bad { background: var(--jk-red); border-color: var(--jk-red); }
.jk-pg__dot.is-warn { background: var(--jk-orange); border-color: var(--jk-orange); }
.jk-pg__dot.is-skip { background: #fff; border-color: #c9c8cd; border-style: dashed; }
.jk-pg__label { max-width: 8rem; text-align: center; font-size: 0.8rem; line-height: 1.25; word-break: break-word; }
.jk-pg__time { font-size: 0.72rem; color: var(--jk-secondary); }
</style>
