<template>
  <div class="sl-drive" :class="{ 'is-wide': wide }">
    <!-- The toolbar: what to run, where, in what. -->
    <div class="sl-drive__bar">
      <div class="sl-drive__group">
        <label class="sl-drive__field">
          <span>{{ $t('Script') }}</span>
          <select v-model="script" :disabled="running || !scripts.length">
            <option v-for="name in scripts" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <button type="button" class="sl-drive__run" :disabled="running || !script"
                @click="runScript">
          <Play v-if="!running" class="sl-drive__i" />
          <Loader2 v-else class="sl-drive__i sl-drive__spin" />
          {{ running ? $t('Running… {v0}s', { v0: runElapsed }) : $t('Run') }}
        </button>
      </div>
      <div class="sl-drive__group">
        <label class="sl-drive__field">
          <span>{{ $t('Town') }}</span>
          <select v-model="mapId" :disabled="running" @change="onMapChange">
            <option v-for="town in towns" :key="town.id" :value="town.id">
              {{ town.id }} — {{ $t(town.name) }}
            </option>
          </select>
        </label>
        <label class="sl-drive__field">
          <span>{{ $t('Weather') }}</span>
          <select v-model="weatherName" :disabled="running" @change="onWeatherChange">
            <option v-for="w in weathers" :key="w.name" :value="w.name">{{ w.name }}</option>
          </select>
        </label>
      </div>
      <div class="sl-drive__group sl-drive__modes" role="tablist">
        <button type="button" role="tab" :aria-selected="mode === 'replay'"
                :class="{ 'is-on': mode === 'replay' }" @click="setMode('replay')">
          <Film class="sl-drive__i" /> {{ $t('Replay') }}
        </button>
        <button type="button" role="tab" :aria-selected="mode === 'drive'"
                :class="{ 'is-on': mode === 'drive' }" @click="setMode('drive')">
          <Gamepad2 class="sl-drive__i" /> {{ $t('Drive') }}
        </button>
        <button type="button" class="sl-drive__iconbtn" :title="$t('Wider view')"
                @click="wide = !wide">
          <Maximize2 class="sl-drive__i" />
        </button>
      </div>
    </div>

    <div class="sl-drive__body">
      <!-- THE STAGE. A place, not a paragraph: pinned left-to-right like every
           canvas on this platform, because a mirrored city is a wrong city. -->
      <div class="sl-drive__stagewrap">
        <div ref="stageEl" class="sl-drive__stage" tabindex="0"
             :aria-label="$t('Simulator view')"
             @keydown="onKey($event, true)" @keyup="onKey($event, false)"
             @blur="releaseKeys">
          <canvas v-show="webgl" ref="canvas" class="sl-drive__canvas"></canvas>
          <canvas v-show="!webgl" ref="flat" class="sl-drive__canvas sl-drive__flat"></canvas>

          <div v-if="loading" class="sl-drive__overlay">
            <Loader2 class="sl-drive__spin sl-drive__big" />
            <p>{{ loading }}</p>
          </div>
          <div v-else-if="!webgl" class="sl-drive__note">
            {{ $t('3D is not available in this browser, so the replay is drawn from above.') }}
          </div>

          <!-- Cameras -->
          <div v-if="webgl" class="sl-drive__cams">
            <button v-for="cam in cameraModes" :key="cam.id" type="button"
                    :class="{ 'is-on': camera === cam.id }" :title="$t(cam.label)"
                    @click="setCamera(cam.id)">{{ $t(cam.label) }}</button>
          </div>

          <!-- HUD -->
          <div v-if="egoPose" class="sl-drive__hud">
            <div class="sl-drive__gauge">
              <svg viewBox="0 0 120 70" aria-hidden="true">
                <path d="M10 64 A50 50 0 0 1 110 64" class="sl-drive__arc" />
                <path :d="gaugePath" class="sl-drive__arc is-fill" />
              </svg>
              <div class="sl-drive__speed">
                <strong>{{ speedKmh }}</strong><span>km/h</span>
              </div>
              <div v-if="speedLimit" class="sl-drive__limit"
                   :class="{ 'is-over': speedKmh > speedLimit * 1.1 }">{{ speedLimit }}</div>
            </div>
            <div class="sl-drive__steer">
              <span :style="{ transform: `rotate(${steerDeg}deg)` }">⎊</span>
            </div>
            <div v-if="egoPose.braking" class="sl-drive__brake">{{ $t('BRAKE') }}</div>
            <div v-if="crashed" class="sl-drive__crash">{{ $t('Crashed - press R to reset') }}</div>
            <div v-if="offRoad" class="sl-drive__crash is-warn">{{ $t('Off the road') }}</div>
          </div>

          <!-- Minimap -->
          <canvas v-show="webgl && mapData" ref="mini" class="sl-drive__mini"
                  width="180" height="180"></canvas>

          <!-- Manual controls -->
          <div v-if="mode === 'drive'" class="sl-drive__keys">
            <span>{{ $t('W / ↑ throttle · S / ↓ brake, then reverse · A D / ← → steer · Space handbrake · R reset') }}</span>
            <div class="sl-drive__touch">
              <button type="button" @pointerdown="hold('left', true)" @pointerup="hold('left', false)"
                      @pointerleave="hold('left', false)">◀</button>
              <button type="button" @pointerdown="hold('brake', true)" @pointerup="hold('brake', false)"
                      @pointerleave="hold('brake', false)">{{ $t('Brake') }}</button>
              <button type="button" @pointerdown="hold('throttle', true)" @pointerup="hold('throttle', false)"
                      @pointerleave="hold('throttle', false)">{{ $t('Go') }}</button>
              <button type="button" @pointerdown="hold('right', true)" @pointerup="hold('right', false)"
                      @pointerleave="hold('right', false)">▶</button>
            </div>
          </div>

          <!-- Event toast -->
          <transition name="sl-drive-fade">
            <div v-if="toast" class="sl-drive__toast" :class="`is-${toast.kind}`">{{ toast.text }}</div>
          </transition>
        </div>

        <!-- Playback -->
        <div v-if="mode === 'replay' && replay" class="sl-drive__play">
          <button type="button" class="sl-drive__iconbtn" :title="playing ? $t('Pause') : $t('Play')"
                  @click="togglePlay">
            <Pause v-if="playing" class="sl-drive__i" /><Play v-else class="sl-drive__i" />
          </button>
          <span class="sl-drive__time">{{ clock.toFixed(1) }} / {{ total.toFixed(1) }} s</span>
          <div class="sl-drive__scrub">
            <input type="range" min="0" :max="total || 0" step="0.05" :value="clock"
                   :aria-label="$t('Replay position')" @input="onSeek" />
            <span v-for="(mark, i) in marks" :key="i" class="sl-drive__mark"
                  :class="`is-${mark.kind}`" :style="{ insetInlineStart: markLeft(mark.t) }"
                  :title="`${mark.t.toFixed(1)} s · ${mark.label}`"></span>
          </div>
          <select v-model.number="rate" class="sl-drive__rate" :aria-label="$t('Playback speed')"
                  @change="onRate">
            <option :value="0.25">0.25×</option>
            <option :value="0.5">0.5×</option>
            <option :value="1">1×</option>
            <option :value="2">2×</option>
            <option :value="4">4×</option>
          </select>
        </div>
      </div>

      <!-- Side panel -->
      <aside class="sl-drive__side">
        <div class="sl-drive__tabs" role="tablist">
          <button v-for="tab in tabs" :key="tab.id" type="button" role="tab"
                  :aria-selected="panel === tab.id" :class="{ 'is-on': panel === tab.id }"
                  @click="panel = tab.id">{{ $t(tab.label) }}</button>
        </div>

        <!-- The car picker -->
        <section v-if="panel === 'car'" class="sl-drive__cars">
          <p class="sl-drive__hint">{{ $t('Pick the car your script drives. The pane passes it as --vehicle; the starter scripts read it with argparse.') }}</p>
          <div v-for="group in carGroups" :key="group.body" class="sl-drive__cargroup">
            <h4>{{ $t(bodyLabel(group.body)) }}</h4>
            <button v-for="car in group.cars" :key="car.id" type="button" class="sl-drive__car"
                    :class="{ 'is-on': vehicleId === car.id }" @click="pickVehicle(car.id)">
              <span class="sl-drive__swatch" :style="{ background: swatch(car) }"></span>
              <span class="sl-drive__carname">
                <strong>{{ car.make }} {{ car.model }}</strong>
                <code>{{ car.id }}</code>
              </span>
              <span class="sl-drive__carspec">
                {{ car.length.toFixed(2) }} m · {{ Math.round(car.power_kw) }} kW ·
                {{ Math.round(car.max_steer) }}°
              </span>
            </button>
          </div>
        </section>

        <!-- The run -->
        <section v-else-if="panel === 'run'" class="sl-drive__run-panel">
          <div v-if="replay" class="sl-drive__stats">
            <div v-for="row in statRows" :key="row.label" class="sl-drive__stat">
              <span>{{ $t(row.label) }}</span><strong>{{ row.value }}</strong>
            </div>
          </div>
          <p v-else class="sl-drive__hint">{{ $t('No run yet. Press Run - or type python drive.py in the CARLA Console.') }}</p>
          <h4 v-if="goals.length">{{ $t('Goals') }}</h4>
          <ul class="sl-drive__goals">
            <li v-for="g in goals" :key="g.id" :class="{ 'is-met': g.achieved }">
              <CheckCircle2 v-if="g.achieved" class="sl-drive__i" />
              <Circle v-else class="sl-drive__i" />
              <span><code>{{ g.id }}</code> {{ g.goal }}</span>
              <small v-if="goalDetail(g.id)">{{ goalDetail(g.id) }}</small>
            </li>
          </ul>
        </section>

        <!-- Events -->
        <section v-else-if="panel === 'events'" class="sl-drive__events">
          <p v-if="!marks.length" class="sl-drive__hint">{{ $t('No collisions, red lights or lane invasions in this run.') }}</p>
          <button v-for="(mark, i) in marks" :key="i" type="button" class="sl-drive__event"
                  :class="`is-${mark.kind}`" @click="jump(mark.t)">
            <span>{{ mark.t.toFixed(1) }} s</span> {{ $t(markLabel(mark.kind)) }} — {{ mark.label }}
          </button>
        </section>

        <!-- Output -->
        <section v-else-if="panel === 'output'" class="sl-drive__output">
          <pre v-if="output">{{ output }}</pre>
          <pre v-if="errorText" class="is-err">{{ errorText }}</pre>
          <p v-if="!output && !errorText" class="sl-drive__hint">{{ $t('What your script prints appears here.') }}</p>
        </section>

        <!-- Sensors -->
        <section v-else-if="panel === 'sensors'" class="sl-drive__sensors">
          <p v-if="!images.length && !estimateNames.length" class="sl-drive__hint">
            {{ $t('Images your script saves with save_to_disk, and estimates it submits with sfs_eval, appear here.') }}
          </p>
          <figure v-for="img in images" :key="img.name + img.frame">
            <img :src="`data:image/png;base64,${img.png}`" :alt="img.name" />
            <figcaption><code>{{ img.name }}</code> · {{ $t('frame') }} {{ img.frame }}</figcaption>
          </figure>
          <div v-for="name in estimateNames" :key="name" class="sl-drive__est">
            <h4><code>{{ name }}</code>
              <small v-if="estimateRmse(name) != null">RMSE {{ estimateRmse(name)!.toFixed(3) }}</small></h4>
            <canvas :ref="el => registerChart(name, el as HTMLCanvasElement | null)"
                    width="300" height="120"></canvas>
            <p class="sl-drive__legend"><span class="is-you"></span>{{ $t('your estimate') }}
              <span class="is-truth"></span>{{ $t('ground truth') }}</p>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The SIMULATOR pane of a CARLA lab: a 3D studio for the student's runs.
 *
 * It does not simulate anything that is graded. A run happens on app 11 - the
 * student's script runs as a CARLA client against the simulator server - and
 * comes back as a REPLAY, which this pane draws: every car at 10 Hz,
 * interpolated, the traffic lights, the debug drawings, the planned route and
 * every collision and infraction on the timeline. The Drive tab is the one
 * thing that runs here, the same bicycle model ported to TypeScript, for
 * getting a feel for a car before writing a controller for it.
 *
 * Three decisions worth keeping:
 *
 * - **Run goes through the console's path.** The pane posts `action: run` and
 *   app 11 runs exactly `python <script> --map ... --vehicle ...` - same log
 *   line, same grading - so a run from here and one typed in the console are
 *   the same thing to every check.
 * - **Babylon arrives on demand** (`import('@/drive3d/driveStage')`), and a
 *   browser with no WebGL gets a top-down 2D replay instead of nothing.
 * - **Nothing reaches `v-html`.** Every string here - output, event labels,
 *   file names - came out of a student's script.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CheckCircle2, Circle, Film, Gamepad2, Loader2, Maximize2, Pause, Play } from 'lucide-vue-next';
import { hasWebGL } from '@/stage3d/loader';
import { useI18n } from '@/i18n/runtime';
import {
  LaneIndex, bodyOf, carsAt, duration, estimateSeries, frameIndexAt, kmh, parseColor,
  rmse, timelineMarks, weatherLook, type DriveMap, type Replay, type TownSummary,
  type VehicleSpec, type WeatherPreset,
} from '@/utils/driveSim';
import type { CameraMode, DriveStage, StageTick } from '@/drive3d/driveStage';

const props = defineProps<{
  toolId: string;
  run: (toolId: string, payload: Record<string, unknown>) => Promise<any>;
}>();

const { t } = useI18n();

const canvas = ref<HTMLCanvasElement | null>(null);
const flat = ref<HTMLCanvasElement | null>(null);
const mini = ref<HTMLCanvasElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const webgl = ref(true);
const loading = ref('');
const wide = ref(false);
const mode = ref<'replay' | 'drive'>('replay');
const camera = ref<CameraMode>('chase');
const panel = ref<'car' | 'run' | 'events' | 'output' | 'sensors'>('run');

const vehicles = ref<VehicleSpec[]>([]);
const towns = ref<TownSummary[]>([]);
const weathers = ref<WeatherPreset[]>([]);
const scripts = ref<string[]>([]);
const goals = ref<Array<{ id: string; goal: string; achieved: boolean }>>([]);
const script = ref('drive.py');
const mapId = ref('Town03');
const vehicleId = ref('vehicle.tesla.model3');
const weatherName = ref('ClearNoon');
const mapData = ref<DriveMap | null>(null);
const replay = ref<Replay | null>(null);
const output = ref('');
const errorText = ref('');
const running = ref(false);
const runElapsed = ref(0);
const clock = ref(0);
const total = ref(0);
const playing = ref(false);
const rate = ref(1);
const egoPose = ref<StageTick['ego']>(null);
const crashed = ref(false);
const toast = ref<{ kind: string; text: string } | null>(null);

let stage: DriveStage | null = null;
let laneIndex: LaneIndex | null = null;
let runTimer: number | null = null;
let toastTimer: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let flatTimer: number | null = null;
const mapCache = new Map<string, DriveMap>();
const charts = new Map<string, HTMLCanvasElement>();
const keys = new Set<string>();
let lastToastT = -1;

const cameraModes: Array<{ id: CameraMode; label: string }> = [
  { id: 'chase', label: 'Chase' },
  { id: 'hood', label: 'Driver' },
  { id: 'top', label: 'Top' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'spectator', label: 'Spectator' },
];

const tabs = [
  { id: 'run' as const, label: 'Run' },
  { id: 'car' as const, label: 'Car' },
  { id: 'events' as const, label: 'Events' },
  { id: 'output' as const, label: 'Output' },
  { id: 'sensors' as const, label: 'Sensors' },
];

const BODY_LABELS: Record<string, string> = {
  sedan: 'Sedans', coupe: 'Coupés', hatch: 'Hatchbacks', suv: 'SUVs', pickup: 'Pickups',
  van: 'Vans', bus: 'Buses', truck: 'Trucks', sports: 'Sports cars',
};

function bodyLabel(body: string): string {
  return BODY_LABELS[body] || body;
}

const carGroups = computed(() => {
  const groups = new Map<string, VehicleSpec[]>();
  for (const car of vehicles.value) {
    const body = bodyOf(car);
    groups.set(body, [...(groups.get(body) || []), car]);
  }
  return [...groups.entries()].map(([body, cars]) => ({ body, cars }));
});

const specById = computed(() => {
  const out: Record<string, VehicleSpec> = {};
  for (const v of vehicles.value) out[v.id] = v;
  return out;
});

const selectedSpec = computed(() => specById.value[vehicleId.value] || vehicles.value[0]);

function swatch(car: VehicleSpec): string {
  const [r, g, b] = parseColor(car.colors?.[0]);
  return `rgb(${r}, ${g}, ${b})`;
}

const marks = computed(() => timelineMarks(replay.value));

function markLeft(at: number): string {
  return total.value > 0 ? `${(at / total.value) * 100}%` : '0%';
}

function markLabel(kind: string): string {
  return ({ collision: 'Collision', red_light: 'Red light', invasion: 'Lane invasion',
    speeding: 'Speeding' } as Record<string, string>)[kind] || 'Event';
}

const speedKmh = computed(() => kmh(egoPose.value?.v || 0));
const steerDeg = computed(() => Math.round((egoPose.value?.steer || 0) * 180 / Math.PI * 4));
const gaugePath = computed(() => {
  const frac = Math.max(0, Math.min(1, speedKmh.value / 160));
  const a = Math.PI * (1 - frac);
  const x = 60 + 50 * Math.cos(a);
  const y = 64 - 50 * Math.sin(a);
  return `M10 64 A50 50 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
});
const laneHit = computed(() => (egoPose.value && laneIndex)
  ? laneIndex.nearest(egoPose.value.x, egoPose.value.y) : null);
const speedLimit = computed(() => laneHit.value?.lane.speed || 0);
const offRoad = computed(() => mode.value === 'drive' && !!laneHit.value
  && laneHit.value.distance > laneHit.value.lane.w / 2 + 1.2 && laneHit.value.lane.j < 0);

const statRows = computed(() => {
  const m = replay.value?.metrics || {};
  const pct = (v: any) => (v == null ? '—' : `${Math.round(Number(v) * 100)}%`);
  const num = (v: any, unit = '') => (v == null ? '—' : `${v}${unit}`);
  return [
    { label: 'Status', value: replay.value?.status || '—' },
    { label: 'Simulated time', value: num(m.duration, ' s') },
    { label: 'Distance', value: num(m.distance, ' m') },
    { label: 'Max speed', value: m.max_speed == null ? '—' : `${kmh(m.max_speed)} km/h` },
    { label: 'Collisions', value: num(m.collisions) },
    { label: 'Lane invasions', value: num(m.lane_invasions) },
    { label: 'Red lights run', value: num(m.red_lights) },
    { label: 'Mean cross-track error', value: num(m.mean_cte, ' m') },
    { label: 'Route completion', value: pct(m.route_completion) },
    { label: 'Driving score', value: m.driving_score == null ? '—'
      : Number(m.driving_score).toFixed(2) },
  ];
});

function goalDetail(id: string): string {
  const g = (replay.value?.goals || []).find(row => row.id === id);
  if (!g || !g.detail || typeof g.detail !== 'object') return '';
  return Object.entries(g.detail).filter(([, v]) => v !== null && typeof v !== 'object')
    .slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ');
}

const images = computed(() => replay.value?.images || []);
const estimateNames = computed(() => Object.keys(replay.value?.submissions || {})
  .filter(name => (replay.value?.submissions?.[name] || []).length > 1));

function estimateRmse(name: string): number | null {
  return rmse(estimateSeries(replay.value?.submissions?.[name] || []));
}

function registerChart(name: string, el: HTMLCanvasElement | null) {
  if (el) {
    charts.set(name, el);
    drawChart(name);
  }
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* A canvas cannot read a CSS custom property (working rule 37), so the two
   series colours are resolved off the document when drawn. */
function drawChart(name: string) {
  const el = charts.get(name);
  if (!el) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  const rows = estimateSeries(replay.value?.submissions?.[name] || []);
  const w = el.width;
  const h = el.height;
  ctx.clearRect(0, 0, w, h);
  if (rows.length < 2) return;
  const values = rows.flatMap(r => [r.value, r.truth]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const t0 = rows[0].t;
  const t1 = rows[rows.length - 1].t || t0 + 1;
  const X = (tt: number) => ((tt - t0) / (t1 - t0 || 1)) * (w - 8) + 4;
  const Y = (v: number) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12);
  ctx.strokeStyle = cssVar('--sfs-line', 'rgba(128,128,128,0.35)');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, Y(0));
  ctx.lineTo(w - 4, Y(0));
  ctx.stroke();
  const series = (pick: (r: { value: number; truth: number }) => number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    rows.forEach((r, i) => (i ? ctx.lineTo(X(r.t), Y(pick(r))) : ctx.moveTo(X(r.t), Y(pick(r)))));
    ctx.stroke();
  };
  series(r => r.truth, cssVar('--sfs-text-muted', '#8a94a6'));
  series(r => r.value, cssVar('--sfs-accent', '#4f7cff'));
}

/* ─────────────────── talking to app 11 ─────────────────── */

async function call(payload: Record<string, unknown>) {
  return props.run(props.toolId, payload);
}

async function loadCatalogue() {
  const answer = await call({ action: 'catalogue' });
  if (!answer || answer.ok === false) {
    errorText.value = answer?.error || t('The simulator could not be reached.');
    return;
  }
  vehicles.value = answer.vehicles || [];
  towns.value = answer.towns || [];
  weathers.value = answer.weathers || [];
  scripts.value = answer.scripts || [];
  const view = answer.view || {};
  goals.value = view.goals || [];
  const cfg = view.config || {};
  mapId.value = cfg.map || mapId.value;
  vehicleId.value = cfg.vehicle || vehicleId.value;
  weatherName.value = cfg.weather || weatherName.value;
  if (!scripts.value.includes(script.value)) {
    script.value = scripts.value.includes(cfg.script) ? cfg.script : (scripts.value[0] || '');
  }
}

async function loadMap(id: string): Promise<DriveMap | null> {
  if (mapCache.has(id)) return mapCache.get(id)!;
  const answer = await call({ action: 'map', map: id });
  if (!answer?.map) return null;
  mapCache.set(id, answer.map);
  return answer.map;
}

async function showMap(id: string) {
  const data = await loadMap(id);
  if (!data) return;
  mapData.value = data;
  laneIndex = new LaneIndex(data);
  stage?.setMap(data);
  drawMiniBase();
}

function presetParams(name: string): Record<string, number> {
  const w = weathers.value.find(row => row.name === name);
  return (w || {}) as unknown as Record<string, number>;
}

async function applyReplay(next: Replay | null) {
  replay.value = next;
  total.value = duration(next);
  clock.value = 0;
  lastToastT = -1;
  if (next) {
    if (next.map && next.map !== mapData.value?.id) await showMap(next.map);
    output.value = next.stdout || '';
    errorText.value = next.stderr || '';
    stage?.setReplay(next);
    if (!next.weather_params) stage?.setWeather(presetParams(next.weather));
    if (camera.value === 'orbit') setCamera('chase');
    await nextTick();
    for (const name of estimateNames.value) drawChart(name);
  } else {
    stage?.setReplay(null);
    stage?.setWeather(presetParams(weatherName.value));
    if (selectedSpec.value) stage?.showPreview(selectedSpec.value, selectedSpec.value.colors[0]);
  }
}

async function runScript() {
  if (running.value || !script.value) return;
  running.value = true;
  runElapsed.value = 0;
  mode.value = 'replay';
  stage?.stopManual();
  const started = Date.now();
  runTimer = window.setInterval(() => {
    runElapsed.value = Math.round((Date.now() - started) / 1000);
  }, 500);
  try {
    const answer = await call({ action: 'run', script: script.value, map: mapId.value,
      vehicle: vehicleId.value, weather: weatherName.value });
    output.value = answer?.output || '';
    errorText.value = answer?.error || '';
    const carla = answer?.carla;
    if (carla?.replay) {
      await applyReplay(carla.replay as Replay);
      panel.value = (carla.replay.frames || []).length ? 'run' : 'output';
    } else {
      panel.value = 'output';
    }
    const refreshed = await call({ action: 'catalogue' });
    if (refreshed?.view?.goals) goals.value = refreshed.view.goals;
  } finally {
    running.value = false;
    if (runTimer) window.clearInterval(runTimer);
    runTimer = null;
  }
}

async function saveConfig(patch: Record<string, unknown>) {
  await call({ action: 'config', ...patch });
}

async function onMapChange() {
  await saveConfig({ map: mapId.value });
  await showMap(mapId.value);
  if (mode.value === 'drive') startDriving();
  else if (!replay.value || replay.value.map !== mapId.value) {
    replay.value = null;
    stage?.setReplay(null);
    if (selectedSpec.value) stage?.showPreview(selectedSpec.value, selectedSpec.value.colors[0]);
  }
}

async function onWeatherChange() {
  stage?.setWeather(presetParams(weatherName.value));
  await saveConfig({ weather: weatherName.value });
}

async function pickVehicle(id: string) {
  vehicleId.value = id;
  const spec = specById.value[id];
  if (spec && mode.value === 'drive') startDriving();
  else if (spec && !replay.value) stage?.showPreview(spec, spec.colors[0]);
  await saveConfig({ vehicle: id });
}

/* ─────────────────── playback, cameras, driving ─────────────────── */

function togglePlay() {
  if (!stage) return;
  if (playing.value) stage.pause();
  else {
    if (clock.value >= total.value - 0.05) stage.seek(0);
    stage.play();
  }
}

function onRate() {
  stage?.setRate(rate.value);
}

function onSeek(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  stage?.pause();
  stage?.seek(value);
  clock.value = value;
  if (!webgl.value) drawFlat();
}

function jump(at: number) {
  stage?.pause();
  stage?.seek(Math.max(0, at - 1.5));
  clock.value = Math.max(0, at - 1.5);
  if (camera.value === 'top') setCamera('chase');
}

function setCamera(id: CameraMode) {
  camera.value = id;
  stage?.setCamera(id);
}

function setMode(next: 'replay' | 'drive') {
  mode.value = next;
  if (next === 'drive') startDriving();
  else {
    stage?.stopManual();
    if (replay.value) stage?.setReplay(replay.value);
    else if (selectedSpec.value) stage?.showPreview(selectedSpec.value, selectedSpec.value.colors[0]);
  }
}

function startDriving() {
  if (!stage || !selectedSpec.value) return;
  stage.setWeather(presetParams(weatherName.value));
  stage.startManual(selectedSpec.value, selectedSpec.value.colors[0]);
  if (camera.value === 'orbit' || camera.value === 'spectator') setCamera('chase');
  stageEl.value?.focus();
}

function applyKeys() {
  if (!stage || mode.value !== 'drive') return;
  const fwd = keys.has('throttle');
  const back = keys.has('brake');
  const v = egoPose.value?.v || 0;
  const reverse = back && v <= 0.3 && !fwd;
  stage.setInput({
    throttle: fwd ? 0.75 : reverse ? 0.45 : 0,
    brake: back && !reverse ? 0.9 : 0,
    reverse,
    steer: (keys.has('right') ? 0.55 : 0) - (keys.has('left') ? 0.55 : 0),
    handbrake: keys.has('handbrake'),
  });
}

const KEYMAP: Record<string, string> = {
  KeyW: 'throttle', ArrowUp: 'throttle', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'handbrake',
};

function onKey(event: KeyboardEvent, down: boolean) {
  if (mode.value !== 'drive') return;
  if (event.code === 'KeyR' && down) {
    stage?.resetManual();
    event.preventDefault();
    return;
  }
  const action = KEYMAP[event.code];
  if (!action) return;
  event.preventDefault();
  if (down) keys.add(action); else keys.delete(action);
  applyKeys();
}

function hold(action: string, down: boolean) {
  if (down) keys.add(action); else keys.delete(action);
  applyKeys();
}

function releaseKeys() {
  keys.clear();
  applyKeys();
}

/* ─────────────────── the minimap and the 2D fallback ─────────────────── */

let miniBase: HTMLCanvasElement | null = null;

function drawMapTo(ctx: CanvasRenderingContext2D, data: DriveMap, size: number) {
  const [x0, y0, x1, y1] = data.bounds;
  const span = Math.max(x1 - x0, y1 - y0);
  const k = size / span;
  const P = (p: number[]) => [(p[0] - x0) * k, (p[1] - y0) * k];
  ctx.fillStyle = '#26332a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#8b8a85';
  for (const block of data.blocks || []) {
    if (block.kind !== 'block') continue;
    ctx.beginPath();
    block.poly.forEach((p, i) => { const [x, y] = P(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.fill();
  }
  ctx.fillStyle = '#3d4046';
  for (const s of data.surfaces || []) {
    ctx.beginPath();
    [...s.left, ...[...s.right].reverse()].forEach((p, i) => {
      const [x, y] = P(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.fill();
  }
  for (const j of data.junctions || []) {
    ctx.beginPath();
    j.poly.forEach((p, i) => { const [x, y] = P(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.fill();
  }
  ctx.fillStyle = '#6a7a92';
  for (const b of data.buildings || []) {
    const [cx, cy, w, d] = b;
    const [px, py] = P([cx, cy]);
    ctx.fillRect(px - (w * k) / 2, py - (d * k) / 2, w * k, d * k);
  }
}

function drawMiniBase() {
  if (!mapData.value) return;
  miniBase = document.createElement('canvas');
  miniBase.width = 360;
  miniBase.height = 360;
  const ctx = miniBase.getContext('2d');
  if (ctx) drawMapTo(ctx, mapData.value, 360);
}

function drawCars(ctx: CanvasRenderingContext2D, size: number) {
  const data = mapData.value;
  if (!data) return;
  const [x0, y0, x1, y1] = data.bounds;
  const k = size / Math.max(x1 - x0, y1 - y0);
  const P = (x: number, y: number) => [(x - x0) * k, (y - y0) * k];
  const route = replay.value?.route || [];
  if (route.length > 1) {
    ctx.strokeStyle = '#3fd3ff';
    ctx.lineWidth = Math.max(1, size / 180);
    ctx.beginPath();
    route.forEach((p, i) => { const [x, y] = P(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }
  const frames = replay.value?.frames || [];
  if (mode.value === 'replay' && frames.length) {
    const cars = carsAt(frames, clock.value);
    for (const [id, pose] of cars) {
      const [x, y] = P(pose.x, pose.y);
      const hero = id === replay.value?.ego;
      ctx.fillStyle = hero ? '#3fd3ff' : '#f2f2f2';
      ctx.beginPath();
      ctx.arc(x, y, hero ? Math.max(3, size / 70) : Math.max(1.6, size / 140), 0, Math.PI * 2);
      ctx.fill();
    }
    const states = frames[frameIndexAt(frames, clock.value)]?.l || '';
    (data.lights || []).forEach((light, i) => {
      const [x, y] = P(light.x, light.y);
      ctx.fillStyle = ({ g: '#36d27a', y: '#f5c242', r: '#ff4d4d' } as Record<string, string>)[
        states[i] || 'r'];
      ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
    });
  }
  const ego = egoPose.value;
  if (ego && mode.value === 'drive') {
    const [x, y] = P(ego.x, ego.y);
    ctx.fillStyle = '#3fd3ff';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3, size / 70), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMini() {
  const el = mini.value;
  if (!el || !miniBase) return;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(miniBase, 0, 0, el.width, el.height);
  drawCars(ctx, el.width);
}

function drawFlat() {
  const el = flat.value;
  if (!el || !mapData.value) return;
  const size = Math.min(el.clientWidth || 600, el.clientHeight || 400);
  el.width = size;
  el.height = size;
  const ctx = el.getContext('2d');
  if (!ctx) return;
  drawMapTo(ctx, mapData.value, size);
  drawCars(ctx, size);
}

/* ─────────────────── life cycle ─────────────────── */

function onTick(tick: StageTick) {
  clock.value = tick.t;
  playing.value = tick.playing;
  egoPose.value = tick.ego;
  crashed.value = tick.crashed;
  drawMini();
  // A toast when the replay passes an event.
  for (const mark of marks.value) {
    if (mark.t > lastToastT && mark.t <= tick.t && tick.playing) {
      showToast(mark.kind, `${t(markLabel(mark.kind))} — ${mark.label}`);
      lastToastT = mark.t;
    }
  }
}

function showToast(kind: string, text: string) {
  toast.value = { kind, text };
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.value = null; }, 2600);
}

onMounted(async () => {
  webgl.value = hasWebGL();
  loading.value = t('Loading the simulator…');
  try {
    await loadCatalogue();
    if (webgl.value && canvas.value) {
      const mod = await import('@/drive3d/driveStage');
      stage = await mod.DriveStage.create(canvas.value);
      stage.on(onTick);
      stage.setSpecs(specById.value);
      stage.setCamera(camera.value);
    }
    const last = await call({ action: 'last' });
    const lastReplay = last?.carla?.replay as Replay | undefined;
    await showMap(lastReplay?.map || mapId.value);
    stage?.setWeather(presetParams(weatherName.value));
    await applyReplay(lastReplay && (lastReplay.frames || []).length ? lastReplay : null);
    if (stage) stage.pause();
  } catch (error: any) {
    errorText.value = String(error?.message || error);
  } finally {
    loading.value = '';
  }
  if (!webgl.value) {
    flatTimer = window.setInterval(() => {
      if (playing.value && replay.value) {
        clock.value = Math.min(total.value, clock.value + 0.1 * rate.value);
        if (clock.value >= total.value) playing.value = false;
      }
      drawFlat();
    }, 100);
  }
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    resizeObserver = new ResizeObserver(() => { stage?.resize(); if (!webgl.value) drawFlat(); });
    resizeObserver.observe(stageEl.value);
  }
});

watch(wide, () => nextTick(() => stage?.resize()));
watch(() => specById.value, specs => stage?.setSpecs(specs));

onBeforeUnmount(() => {
  if (runTimer) window.clearInterval(runTimer);
  if (toastTimer) window.clearTimeout(toastTimer);
  if (flatTimer) window.clearInterval(flatTimer);
  resizeObserver?.disconnect();
  stage?.dispose();
  stage = null;
});

void weatherLook;
</script>

<style scoped>
.sl-drive {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 0;
  height: 100%;
}
.sl-drive__bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  align-items: flex-end;
  justify-content: space-between;
}
.sl-drive__group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}
.sl-drive__field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
  color: var(--sfs-text-muted, #8a94a6);
}
.sl-drive__field select {
  min-width: 9rem;
  padding: 0.4rem 0.5rem;
  border-radius: var(--sfs-radius-sm, 8px);
  border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.35);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06);
  color: var(--sfs-text, #e5e7eb);
}
.sl-drive__run {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.1rem;
  border-radius: var(--sfs-radius-sm, 8px);
  border: 0;
  font-weight: 600;
  background: var(--sfs-accent, #4f7cff);
  color: var(--sfs-on-accent, #ffffff);
  cursor: pointer;
  min-height: max(2.4rem, 40px);
}
.sl-drive__run:disabled { opacity: 0.6; cursor: progress; }
.sl-drive__modes button,
.sl-drive__iconbtn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  border-radius: var(--sfs-radius-sm, 8px);
  border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.35);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
  color: var(--sfs-text, #e5e7eb);
  cursor: pointer;
}
.sl-drive__modes button.is-on {
  background: var(--sfs-accent, #4f7cff);
  color: var(--sfs-on-accent, #ffffff);
  border-color: transparent;
}
.sl-drive__i { width: 1em; height: 1em; flex: none; }
.sl-drive__spin { animation: sl-drive-spin 1s linear infinite; }
.sl-drive__big { width: 2rem; height: 2rem; }
@keyframes sl-drive-spin { to { transform: rotate(360deg); } }

.sl-drive__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 20rem);
  gap: 0.8rem;
  min-height: 0;
  flex: 1;
}
.sl-drive.is-wide .sl-drive__body { grid-template-columns: minmax(0, 1fr); }
.sl-drive.is-wide .sl-drive__side { display: none; }
@media (max-width: 1100px) {
  .sl-drive__body { grid-template-columns: minmax(0, 1fr); }
}
.sl-drive__stagewrap { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.sl-drive__stage {
  position: relative;
  direction: ltr;
  aspect-ratio: 16 / 9;
  min-height: 18rem;
  border-radius: var(--sfs-radius, 12px);
  overflow: hidden;
  /* The HUD is sized against the STAGE, not the viewport: the stage is a
     column on a desktop and the whole width on a phone, and a fixed 9rem
     minimap covered half the road at 390px. */
  container-type: inline-size;
  background: #0d1117;
  outline: none;
}
.sl-drive__stage:focus-visible { box-shadow: 0 0 0 2px var(--sfs-accent, #4f7cff); }
.sl-drive__canvas { width: 100%; height: 100%; display: block; touch-action: none; }
.sl-drive__flat { background: #1b2330; }
.sl-drive__overlay {
  position: absolute; inset: 0;
  display: grid; place-content: center; justify-items: center; gap: 0.6rem;
  color: #e8edf5; background: rgb(8 12 20 / 0.72);
}
.sl-drive__note {
  position: absolute; inset-block-start: 0.6rem; inset-inline-start: 0.6rem;
  padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.78rem;
  background: rgb(8 12 20 / 0.75); color: #e8edf5;
}
.sl-drive__cams {
  position: absolute; inset-block-start: 0.6rem; inset-inline-end: 0.6rem;
  display: flex; gap: 0.25rem; flex-wrap: wrap; justify-content: flex-end;
}
.sl-drive__cams button {
  padding: 0.3rem 0.55rem; border-radius: 6px; font-size: 0.75rem;
  border: 1px solid rgb(255 255 255 / 0.2); cursor: pointer;
  background: rgb(8 12 20 / 0.6); color: #e8edf5;
}
.sl-drive__cams button.is-on { background: #3fd3ff; color: #062030; border-color: transparent; }
.sl-drive__hud {
  position: absolute; inset-block-end: 0.7rem; inset-inline-end: 0.7rem;
  display: flex; align-items: flex-end; gap: 0.6rem; color: #f3f6fb;
  pointer-events: none;
}
.sl-drive__gauge {
  position: relative; width: clamp(5.5rem, 21cqi, 9rem); padding: 0.35rem 0.45rem 0.25rem;
  border-radius: 12px; background: rgb(8 12 20 / 0.68);
}
.sl-drive__gauge svg { width: 100%; height: auto; display: block; }
.sl-drive__arc { fill: none; stroke: rgb(255 255 255 / 0.18); stroke-width: 7; stroke-linecap: round; }
.sl-drive__arc.is-fill { stroke: #3fd3ff; }
.sl-drive__speed {
  position: absolute; inset-inline: 0; inset-block-end: 0.5rem;
  display: flex; justify-content: center; align-items: baseline; gap: 0.2rem;
}
.sl-drive__speed strong { font-size: clamp(1.05rem, 5cqi, 1.6rem); font-variant-numeric: tabular-nums; }
.sl-drive__speed span { font-size: 0.7rem; opacity: 0.8; }
.sl-drive__limit {
  position: absolute; inset-block-start: -0.6rem; inset-inline-end: -0.6rem;
  width: clamp(1.6rem, 6.5cqi, 2.2rem); height: clamp(1.6rem, 6.5cqi, 2.2rem);
  border-radius: 50%; display: grid; place-content: center;
  background: #ffffff; color: #111; border: 3px solid #d62828; font-weight: 700;
  font-size: clamp(0.62rem, 2.4cqi, 0.8rem);
}
.sl-drive__limit.is-over { animation: sl-drive-blink 0.6s steps(2) infinite; }
@keyframes sl-drive-blink { 50% { background: #ffd1d1; } }
.sl-drive__steer {
  width: clamp(2.1rem, 8cqi, 3rem); height: clamp(2.1rem, 8cqi, 3rem);
  border-radius: 50%; display: grid; place-content: center;
  background: rgb(8 12 20 / 0.68); font-size: clamp(1.1rem, 4.5cqi, 1.6rem);
}
.sl-drive__steer span { display: inline-block; transition: transform 80ms linear; }
.sl-drive__brake, .sl-drive__crash {
  padding: 0.35rem 0.6rem; border-radius: 8px; font-weight: 700; font-size: 0.8rem;
  background: #d62828; color: #fff;
}
.sl-drive__crash.is-warn { background: #e8a317; color: #1a1300; }
.sl-drive__mini {
  position: absolute; inset-block-end: 0.7rem; inset-inline-start: 0.7rem;
  width: clamp(4.5rem, 19cqi, 8rem); height: clamp(4.5rem, 19cqi, 8rem); border-radius: 10px;
  opacity: 0.92;
  border: 1px solid rgb(255 255 255 / 0.2); background: #1b2330;
}
.sl-drive__keys {
  position: absolute; inset-block-start: 0.6rem; inset-inline-start: 0.6rem;
  max-width: 60%; display: flex; flex-direction: column; gap: 0.4rem;
  font-size: 0.74rem; color: #e8edf5;
}
.sl-drive__keys > span { background: rgb(8 12 20 / 0.68); padding: 0.3rem 0.55rem; border-radius: 6px; }
.sl-drive__touch { display: none; gap: 0.4rem; }
@media (pointer: coarse) { .sl-drive__touch { display: flex; } }
.sl-drive__touch button {
  min-width: 3.2rem; min-height: 3.2rem; border-radius: 10px; border: 0;
  background: rgb(8 12 20 / 0.72); color: #fff; font-weight: 700; touch-action: none;
}
.sl-drive__toast {
  position: absolute; inset-block-start: 3rem; inset-inline-start: 50%; transform: translateX(-50%);
  padding: 0.45rem 0.9rem; border-radius: 999px; font-weight: 600; font-size: 0.85rem;
  background: rgb(8 12 20 / 0.82); color: #fff; border: 1px solid rgb(255 255 255 / 0.2);
}
.sl-drive__toast.is-collision { background: #b3261e; }
.sl-drive__toast.is-red_light { background: #c2410c; }
.sl-drive-fade-enter-active, .sl-drive-fade-leave-active { transition: opacity 0.25s; }
.sl-drive-fade-enter-from, .sl-drive-fade-leave-to { opacity: 0; }

.sl-drive__play {
  display: flex; align-items: center; gap: 0.6rem; direction: ltr;
}
.sl-drive__time { font-variant-numeric: tabular-nums; font-size: 0.82rem; white-space: nowrap;
  color: var(--sfs-text-muted, #8a94a6); }
.sl-drive__scrub { position: relative; flex: 1; min-width: 0; }
.sl-drive__scrub input { width: 100%; }
.sl-drive__mark {
  position: absolute; inset-block-start: -0.35rem; width: 3px; height: 0.7rem;
  border-radius: 2px; pointer-events: auto; transform: translateX(-1px);
}
.sl-drive__mark.is-collision { background: #ef4444; }
.sl-drive__mark.is-red_light { background: #f97316; }
.sl-drive__mark.is-invasion { background: #eab308; }
.sl-drive__mark.is-speeding { background: #a855f7; }
.sl-drive__rate {
  padding: 0.3rem; border-radius: 6px; border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.35);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.06); color: var(--sfs-text, #e5e7eb);
}

.sl-drive__side {
  display: flex; flex-direction: column; min-height: 0; min-width: 0;
  border-radius: var(--sfs-radius, 12px);
  border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.25);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04);
  overflow: hidden;
}
.sl-drive__tabs { display: flex; flex-wrap: wrap; border-block-end: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.25); }
.sl-drive__tabs button {
  flex: 1 1 auto; padding: 0.5rem 0.6rem; border: 0; background: none; cursor: pointer;
  color: var(--sfs-text-muted, #8a94a6); font-size: 0.82rem; border-block-end: 2px solid transparent;
}
.sl-drive__tabs button.is-on { color: var(--sfs-text, #e5e7eb); border-block-end-color: var(--sfs-accent, #4f7cff); }
.sl-drive__side section { padding: 0.7rem; overflow: auto; max-height: 34rem; }
.sl-drive__hint { font-size: 0.82rem; color: var(--sfs-text-muted, #8a94a6); margin: 0 0 0.6rem; }
.sl-drive__cargroup h4, .sl-drive__run-panel h4, .sl-drive__est h4 {
  margin: 0.6rem 0 0.35rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--sfs-text-muted, #8a94a6);
}
.sl-drive__car {
  width: 100%; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.15rem 0.55rem;
  align-items: center; text-align: start; padding: 0.45rem 0.5rem; margin-block-end: 0.3rem;
  border-radius: 8px; border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.2);
  background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.03); color: var(--sfs-text, #e5e7eb); cursor: pointer;
}
.sl-drive__car.is-on { border-color: var(--sfs-accent, #4f7cff); background: rgb(var(--sfs-accent-rgb, 79 124 255) / 0.12); }
.sl-drive__swatch { grid-row: span 2; width: 1.6rem; height: 1.6rem; border-radius: 6px;
  border: 1px solid rgb(0 0 0 / 0.25); }
.sl-drive__carname { display: flex; flex-direction: column; min-width: 0; }
.sl-drive__carname code { font-size: 0.7rem; color: var(--sfs-text-muted, #8a94a6); overflow-wrap: anywhere;
  direction: ltr; unicode-bidi: isolate; }
.sl-drive__carspec { grid-column: 2; font-size: 0.72rem; color: var(--sfs-text-muted, #8a94a6); }
.sl-drive__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; }
.sl-drive__stat { padding: 0.45rem 0.5rem; border-radius: 8px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.05);
  display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.sl-drive__stat span { font-size: 0.7rem; color: var(--sfs-text-muted, #8a94a6); }
.sl-drive__stat strong { font-size: 0.95rem; overflow-wrap: anywhere; }
.sl-drive__goals { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.sl-drive__goals li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.1rem 0.45rem;
  font-size: 0.82rem; align-items: start; }
.sl-drive__goals li small { grid-column: 2; color: var(--sfs-text-muted, #8a94a6); overflow-wrap: anywhere; }
.sl-drive__goals li.is-met { color: var(--sfs-success-text, #34d399); }
.sl-drive__goals code { direction: ltr; unicode-bidi: isolate; }
.sl-drive__event {
  width: 100%; text-align: start; padding: 0.4rem 0.5rem; margin-block-end: 0.3rem; border-radius: 8px;
  border: 1px solid rgb(var(--sfs-line-rgb, 148 163 184) / 0.2); background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.03);
  color: var(--sfs-text, #e5e7eb); font-size: 0.8rem; cursor: pointer;
}
.sl-drive__event span { font-variant-numeric: tabular-nums; color: var(--sfs-text-muted, #8a94a6); }
.sl-drive__event.is-collision { border-inline-start: 3px solid #ef4444; }
.sl-drive__event.is-red_light { border-inline-start: 3px solid #f97316; }
.sl-drive__event.is-invasion { border-inline-start: 3px solid #eab308; }
.sl-drive__output pre {
  direction: ltr; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.75rem;
  margin: 0 0 0.6rem; padding: 0.5rem; border-radius: 8px; background: #0d1117; color: #d7dde6;
}
.sl-drive__output pre.is-err { color: #ffb4a8; }
.sl-drive__sensors figure { margin: 0 0 0.7rem; }
.sl-drive__sensors img { width: 100%; image-rendering: pixelated; border-radius: 6px; }
.sl-drive__sensors figcaption { font-size: 0.72rem; color: var(--sfs-text-muted, #8a94a6); }
.sl-drive__est canvas { width: 100%; height: 7.5rem; border-radius: 6px; background: rgb(var(--sfs-tint-rgb, 255 255 255) / 0.04); }
.sl-drive__legend { font-size: 0.72rem; color: var(--sfs-text-muted, #8a94a6); display: flex; gap: 0.4rem; align-items: center; }
.sl-drive__legend span { display: inline-block; width: 0.9rem; height: 3px; border-radius: 2px; }
.sl-drive__legend .is-you { background: var(--sfs-accent, #4f7cff); }
.sl-drive__legend .is-truth { background: var(--sfs-text-muted, #8a94a6); }
</style>
