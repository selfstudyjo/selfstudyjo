<template>
  <div v-if="route.page === 'major_list'" class="form-page">
    <div class="bar"><h1 class="bar__title">Major Incident Workbench</h1><span class="bar__sub">Major incidents and candidates</span></div>
    <div class="scroll pad">
      <h2 class="section-title">Major incidents ({{ majors.length }})</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Number</th><th>Short description</th><th>Major incident manager</th><th>Bridge</th><th>Updates</th><th>Next update due</th><th>State</th></tr></thead>
          <tbody>
            <tr v-for="i in majors" :key="i.number">
              <td><button type="button" class="link" @click="$emit('navigate', { page: 'major', id: i.number })">{{ i.number }}</button></td>
              <td>{{ i.short }}</td><td>{{ personName(model, i.major!.manager) }}</td><td>{{ i.major!.bridge || '—' }}</td>
              <td class="num">{{ i.major!.updates.length }}</td>
              <td><span :class="i.major!.overdue ? 'pill pill--critical' : ''">{{ i.major!.resolved ? '—' : i.major!.next_due }}</span></td>
              <td>{{ i.major!.pir ? 'Closed (PIR)' : i.major!.resolved ? 'Resolved' : 'Accepted' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!majors.length" class="empty">No major incidents. Promote a P1 from its form or below.</div>
      </div>
      <h2 class="section-title">Candidates — open P1 incidents ({{ candidates.length }})</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Number</th><th>Short description</th><th>State</th><th>Assignment group</th><th></th></tr></thead>
          <tbody>
            <tr v-for="i in candidates" :key="i.number">
              <td><button type="button" class="link" @click="$emit('navigate', { page: 'incident', id: i.number })">{{ i.number }}</button></td>
              <td>{{ i.short }}</td><td>{{ i.state }}</td><td>{{ i.group }}</td>
              <td><button type="button" class="btn btn--sm" @click="promoting = i.number">Promote</button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!candidates.length" class="empty">No open P1 incidents.</div>
      </div>
    </div>
    <SnModal v-if="promoting" title="Promote to Major Incident" @close="promoting = ''">
      <div class="field"><label class="field__label" for="mgr">Major incident manager</label>
        <select id="mgr" v-model="manager" class="select">
          <option v-for="p in model.people" :key="p.id" :value="p.id">{{ p.name }} — {{ p.role }}</option>
        </select></div>
      <template #footer>
        <button type="button" class="btn" @click="promoting = ''">Cancel</button>
        <button type="button" class="btn btn--primary" :disabled="busy" @click="promote">Promote</button>
      </template>
    </SnModal>
  </div>

  <div v-else class="form-page wb">
    <div class="wb-head">
      <button type="button" class="icon-btn wb-back" aria-label="Back" @click="$emit('navigate', { page: 'major_list' })">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" /></svg>
      </button>
      <span class="pill pill--critical">MAJOR INCIDENT</span>
      <div class="wb-title" v-if="inc"><b>{{ inc.number }}</b> {{ inc.short }}</div>
      <span class="bar__spacer"></span>
      <template v-if="inc && inc.major">
        <span class="wb-meta">Manager <b>{{ personName(model, inc.major.manager) }}</b></span>
        <span class="wb-meta">Declared <b>{{ inc.major.declared }}</b></span>
        <span class="wb-meta">State <b>{{ inc.state }}</b></span>
      </template>
    </div>
    <div v-if="!inc || !inc.major" class="empty">{{ number }} is not a major incident.</div>
    <div v-else class="wb-body">
      <aside class="wb-side">
        <div class="card">
          <div class="card__head"><h3 class="card__title">Communications cadence</h3></div>
          <div class="card__body">
            <dl class="kv">
              <dt>Last update</dt><dd>{{ inc.major.last_update }}</dd>
              <dt>Next update due</dt><dd><span :class="inc.major.overdue ? 'pill pill--critical' : 'pill pill--positive'">{{ inc.major.resolved ? 'stood down' : inc.major.next_due }}</span></dd>
              <dt>Missed cadence</dt><dd>{{ inc.major.missed }}</dd>
              <dt>Updates sent</dt><dd>{{ inc.major.updates.length }}</dd>
              <dt>Cadence</dt><dd>every {{ model.choices.major_cadence }} minutes</dd>
            </dl>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3 class="card__title">Bridge</h3></div>
          <div class="card__body">
            <p v-if="inc.major.bridge" class="bridge">{{ inc.major.bridge }}</p>
            <input v-model="bridge" class="input" placeholder="https://acme.zoom.example/j/..." aria-label="Bridge URL" />
            <button type="button" class="btn btn--sm mt" :disabled="busy || !bridge.trim()" @click="setBridge">{{ inc.major.bridge ? 'Change bridge' : 'Open bridge' }}</button>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3 class="card__title">Task SLAs</h3></div>
          <div class="card__body">
            <div v-for="s in inc.slas" :key="s.name" class="sla-row"><span>{{ SLA_LABEL[s.name] || s.name }}</span><SlaBar :sla="s" /></div>
          </div>
        </div>
      </aside>
      <section class="wb-main">
        <div class="tabs" role="tablist">
          <button v-for="t in TABS" :key="t" type="button" class="tab" :class="{ 'is-active': tab === t }" @click="tab = t">{{ t }}</button>
        </div>
        <div v-if="tab === 'Communications'" class="wb-pane">
          <div class="compose card">
            <div class="card__body">
              <div class="row">
                <label for="aud" class="lbl">Audience</label>
                <select id="aud" v-model="audience" class="select aud">
                  <option value="stakeholders">Stakeholders</option><option value="customers">Customers</option><option value="executives">Executives</option>
                </select>
                <span class="bar__spacer"></span>
                <button type="button" class="btn btn--sm" @click="useTemplate">Insert template</button>
              </div>
              <textarea v-model="text" class="textarea big" aria-label="Update text" placeholder="Impact: ... Action: ... Next update HH:MM UTC."></textarea>
              <div class="row">
                <span class="field__help">An update says what is affected (Impact), what is being done, and when the next update is (Next).</span>
                <span class="bar__spacer"></span>
                <button type="button" class="btn btn--primary" :disabled="busy || !text.trim()" @click="send">Send update</button>
              </div>
            </div>
          </div>
          <ul class="timeline">
            <li v-for="(u, i) in [...inc.major.updates].reverse()" :key="i" class="timeline__item">
              <span class="timeline__time">{{ u.at }}</span><span class="pill pill--info">{{ cap(u.audience) }}</span>
              <p>{{ u.text }}</p>
            </li>
            <li v-if="!inc.major.updates.length" class="muted">No communications sent yet.</li>
          </ul>
        </div>
        <div v-else-if="tab === 'Timeline'" class="wb-pane">
          <ul class="timeline">
            <li v-for="(n, i) in [...inc.notes].reverse()" :key="i" class="timeline__item">
              <span class="timeline__time">{{ n.at }}</span><span class="pill">{{ n.kind === 'work' ? 'Work note' : n.kind === 'customer' ? 'Comment' : 'System' }}</span>
              <p>{{ n.text }}</p>
            </li>
          </ul>
        </div>
        <div v-else class="wb-pane">
          <div class="card">
            <div class="card__head"><h3 class="card__title">Stand down</h3></div>
            <div class="card__body">
              <p class="muted">The major incident ends when service is restored: resolve the incident itself first ({{ inc.state }}).</p>
              <button type="button" class="btn" :disabled="busy || Boolean(inc.major.resolved)" @click="standDown">Resolve major incident</button>
              <button type="button" class="btn btn--ghost" @click="$emit('navigate', { page: 'incident', id: inc.number })">Open incident form</button>
            </div>
          </div>
          <div class="card mt">
            <div class="card__head"><h3 class="card__title">Post Incident Review</h3></div>
            <div class="card__body">
              <p v-if="inc.major.pir" class="pill pill--positive">PIR attached: {{ inc.major.pir }}</p>
              <p class="muted">Attach a blameless PIR from your workspace (a timeline, the impact, the root cause and the actions).</p>
              <div class="row">
                <select v-model="pirFile" class="select" aria-label="PIR file">
                  <option value="">-- Select a file --</option>
                  <option v-for="f in model.files" :key="f" :value="f">{{ f }}</option>
                </select>
                <button type="button" class="btn btn--primary" :disabled="busy || !pirFile" @click="attachPir">Attach PIR</button>
              </div>
            </div>
          </div>
          <div class="card mt">
            <div class="card__head"><h3 class="card__title">Hand over to Problem Management</h3></div>
            <div class="card__body">
              <button type="button" class="btn" @click="$emit('navigate', { page: 'problem', id: '-1', preset: { incidents: inc.number, short: inc.short, ci: inc.ci } })">Create Problem</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/** The Major Incident Workbench: declaring, the bridge, the cadence, standing down and the PIR. */
import { computed, ref } from 'vue';
import type { PortalApi } from '../usePortal';
import SnModal from './SnModal.vue';
import SlaBar from './SlaBar.vue';
import { SLA_LABEL, cap, cmd, isOpen, personName, type Model } from './snow';
import type { Route } from './route';

const props = defineProps<{ model: Model; api: PortalApi; route: Route }>();
const emit = defineEmits<{ (event: 'navigate', route: Route): void }>();
const TABS = ['Communications', 'Timeline', 'Resolution'];

const busy = computed(() => props.api.busy.value);
const number = computed(() => ('id' in props.route ? props.route.id : ''));
const inc = computed(() => props.model.incidents.find(i => i.number === number.value));
const majors = computed(() => props.model.incidents.filter(i => i.major));
const candidates = computed(() => props.model.incidents.filter(i => !i.major && i.priority === 1 && isOpen(i)));

const promoting = ref('');
const manager = ref('l.chen');
const tab = ref('Communications');
const audience = ref('stakeholders');
const text = ref('');
const bridge = ref('');
const pirFile = ref('');

async function one(line: string, success: string) {
  return (await props.api.exec(line, { success })).ok;
}
async function promote() {
  const id = promoting.value;
  if (await one(cmd.majorDeclare(id, manager.value), `${id} promoted to a major incident`)) {
    promoting.value = '';
    emit('navigate', { page: 'major', id });
  }
}
function useTemplate() {
  text.value = `Impact: ${inc.value?.short || ''}. Action: . Next update ${inc.value?.major?.next_due || ''} UTC.`;
}
async function send() {
  if (await one(cmd.majorUpdate(number.value, audience.value, text.value.trim()), `${cap(audience.value)} update sent`)) text.value = '';
}
async function setBridge() {
  if (await one(cmd.majorBridge(number.value, bridge.value.trim()), 'Bridge opened')) bridge.value = '';
}
async function standDown() { await one(cmd.majorResolve(number.value), 'Major incident stood down'); }
async function attachPir() { await one(cmd.majorPir(number.value, pirFile.value), 'PIR attached'); }
</script>

<style scoped src="./sn.css"></style>
<style scoped src="./form.css"></style>
<style scoped>
.pad { padding: 0 16px; }
.wb { background: var(--sn-page); }
.wb-head { display: flex; align-items: center; gap: 11.2px; flex-wrap: wrap; padding: 9.6px 16px; background: var(--sn-brand); color: #fff; }
.wb-back { color: #fff; }
.wb-title { font-size: 15.2px; min-width: 0; }
.wb-meta { font-size: 12.48px; opacity: 0.9; }
.wb-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 304px minmax(0, 1fr); gap: 12.8px; padding: 12.8px; overflow: auto; }
.wb-side { display: flex; flex-direction: column; gap: 12.8px; }
.wb-main { min-width: 0; border: 1px solid var(--sn-border); border-radius: var(--sn-radius-lg); background: var(--sn-surface); }
.wb-pane { padding: 12.8px; }
.bridge { margin: 0 0 8px; overflow-wrap: anywhere; font-size: 12.8px; color: var(--sn-link); }
.mt { margin-top: 9.6px; }
.sla-row { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 6.4px; align-items: center; padding: 3.2px 0; font-size: 12.48px; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lbl { font-size: 13px; font-weight: 700; }
.aud { width: auto; }
.big { margin: 8px 0; min-height: 96px; }
.timeline { margin: 12.8px 0 0; padding: 0; list-style: none; }
.timeline__item { position: relative; margin-left: 8px; padding: 0 0 12.8px 16px; border-left: 2px solid var(--sn-border); }
.timeline__item::before { content: ''; position: absolute; left: -6.4px; top: 3.2px; width: 10.4px; height: 10.4px; border-radius: 50%; background: var(--sn-primary); }
.timeline__time { margin-right: 8px; font-size: 12px; font-weight: 700; color: var(--sn-text-muted); }
.timeline__item p { margin: 4.8px 0 0; font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
@container sl-portal (max-width: 900px) {
  .wb-body { grid-template-columns: minmax(0, 1fr); }
}
</style>
