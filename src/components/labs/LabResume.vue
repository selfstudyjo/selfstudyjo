<template>
  <section v-if="point || allDone" class="sl-resume"
           :style="{ '--sl-pc': color, '--sl-pct': `${point ? point.percent : 100}%` }"
           :aria-label="$t('Your next lab')">
    <div class="sl-resume__body">
      <p class="sl-resume__kicker">
        <PlayCircle class="sl-i" />
        {{ allDone ? $t('Every lab completed') : kicker }}
      </p>
      <template v-if="point">
        <h2 class="sl-resume__title">{{ $td(point.lab, 'title') }}</h2>
        <p class="sl-resume__track">
          {{ point.track ? $td(point.track, 'title') : '' }}
          <span aria-hidden="true">·</span>
          {{ $t('{v0} of {v1} labs completed', { v0: point.done, v1: point.total }) }}
        </p>
        <div class="sl-resume__bar" role="progressbar" :aria-valuenow="point.percent"
             aria-valuemin="0" aria-valuemax="100" :aria-label="$t('Track progress')">
          <span class="sl-resume__fill" />
        </div>
      </template>
      <p v-else class="sl-resume__track">{{ $t('Great work - every track is finished.') }}</p>
    </div>
    <div class="sl-resume__side">
      <div v-if="overall" class="sl-resume__ring" :style="{ '--sl-ring': `${overall.percent}%`, '--sl-ringc': overallColor }">
        <span>{{ overall.percent }}%</span>
        <small>{{ $t('overall') }}</small>
      </div>
      <router-link v-if="point" :to="`/lab/${point.lab.id}`" class="sl-btn sl-btn--primary sl-resume__go">
        {{ point.reason === 'continue' ? $t('Resume lab') : $t('Start lab') }}
        <ArrowRight class="sl-i sl-flip" />
      </router-link>
      <router-link v-else to="/labs" class="sl-btn sl-btn--ghost">{{ $t('Browse labs') }}</router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * "Continue where you left off": the lab to open next, its track's progress and
 * the reader's overall progress. Given the catalogue and progress by a page that
 * already has them (Labs); otherwise it fetches them itself (Home), and draws
 * nothing for a reader without the labs or while the service is unreachable.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowRight, PlayCircle } from 'lucide-vue-next';
import { useAuthStore } from '@/store/auth';
import { t } from '@/i18n/runtime';
import { labsService } from '@/services/labs.service';
import {
  progressColor, resumePoint, type LabProgress, type LabSummary, type LabTrack,
} from '@/utils/labCatalogue';

const props = defineProps<{ tracks?: LabTrack[]; labs?: LabSummary[]; progress?: LabProgress[] }>();


const auth = useAuthStore();
const own = ref<{ tracks: LabTrack[]; labs: LabSummary[]; progress: LabProgress[] } | null>(null);

const data = computed(() => (props.labs ? {
  tracks: props.tracks || [], labs: props.labs, progress: props.progress || [],
} : own.value));

const point = computed(() => (data.value ? resumePoint(data.value.tracks, data.value.labs,
                                                          data.value.progress) : null));
const allDone = computed(() => Boolean(data.value && data.value.labs.length
  && !point.value && data.value.progress.length));
const overall = computed(() => {
  if (!data.value || !data.value.labs.length) return null;
  const ids = new Set(data.value.labs.map(lab => lab.id));
  const done = data.value.progress.filter(row => ids.has(row.lab_id) && row.status === 'completed').length;
  return { percent: Math.round((100 * done) / data.value.labs.length) };
});
const kicker = computed(() => (point.value?.reason === 'continue' ? t('Continue where you left off')
  : point.value?.reason === 'start' ? t('Start here') : t('Your next lab')));
const color = computed(() => progressColor(point.value ? point.value.percent : 100));
const overallColor = computed(() => progressColor(overall.value?.percent || 0));

async function load() {
  if (props.labs || !auth.hasLabAccess || !auth.user?.username) return;
  try {
    const [catalogue, progress] = await Promise.all([
      labsService.getCatalogue(),
      labsService.getProgress(auth.user.username, String(auth.user.user_id || '')),
    ]);
    own.value = { tracks: catalogue.tracks, labs: catalogue.labs, progress };
  } catch {
    own.value = null; // the dashboard must not show a broken card
  }
}

onMounted(load);
watch(() => auth.hasLabAccess, value => { if (value) load(); });
</script>
