<template>
  <div class="jk-cfg">
    <div class="jk-app-bar">
      <h1 class="jk-h1">Configure</h1>
      <label v-if="form && form.type !== 'folder'" class="jk-toggle">
        <input v-model="form.enabled" type="checkbox" />
        <span class="jk-toggle__track"><span class="jk-toggle__thumb"></span></span>
        <span>{{ form.enabled ? 'Enabled' : 'Disabled' }}</span>
      </label>
    </div>

    <div v-if="loadError" class="jk-alert jk-alert--danger">{{ loadError }}</div>
    <div v-else-if="!form" class="jk-muted">Loading…</div>

    <div v-else class="jk-cfg__layout">
      <nav class="jk-cfg__nav" aria-label="Configuration sections">
        <button v-for="section in sections" :key="section.id" type="button" class="jk-cfg__nav-item"
                :class="{ 'is-active': active === section.id }" @click="jump(section.id)">
          <JkIcon :name="section.icon" />{{ section.label }}
        </button>
      </nav>

      <form class="jk-cfg__form" @submit.prevent="save(true)">
        <!-- ===== General ===== -->
        <section :ref="el => register('general', el)" class="jk-cfg__section">
          <h2 class="jk-cfg__h2">General</h2>
          <div class="jk-field">
            <label class="jk-label" for="jk-cfg-desc">Description</label>
            <textarea id="jk-cfg-desc" v-model="form.description" class="jk-textarea" rows="4"></textarea>
            <div class="jk-cfg__preview"><span class="jk-muted">Plain text</span> <button type="button" class="jk-link" @click="preview = !preview">{{ preview ? 'Hide preview' : 'Preview' }}</button></div>
            <p v-if="preview" class="jk-card jk-cfg__preview-box">{{ form.description || '(no description)' }}</p>
          </div>

          <template v-if="form.type !== 'folder'">
            <label class="jk-check is-off" title="Not modelled in this lab"><input type="checkbox" disabled /> Discard old builds</label>
            <label v-if="isPipeline" class="jk-check is-off" title="Not modelled in this lab"><input type="checkbox" disabled /> Do not allow concurrent builds</label>
            <label v-if="isPipeline" class="jk-check is-off" title="Not modelled in this lab"><input type="checkbox" disabled /> Do not allow the pipeline to resume if the controller restarts</label>
            <label class="jk-check is-off" title="Not modelled in this lab"><input type="checkbox" disabled /> GitHub project</label>
            <label class="jk-check">
              <input v-model="form.parameterized" type="checkbox" /> This project is parameterized
            </label>
            <div v-if="form.parameterized" class="jk-cfg__nested">
              <div v-for="(param, index) in form.params" :key="param.key" class="jk-cfg__param">
                <header class="jk-cfg__param-head">
                  <strong>{{ PARAM_LABEL[param.type] }}</strong>
                  <button type="button" class="jk-cfg__x" :aria-label="'Remove ' + PARAM_LABEL[param.type]" @click="form.params.splice(index, 1)">
                    <JkIcon name="close" />
                  </button>
                </header>
                <div class="jk-field">
                  <label class="jk-label">Name</label>
                  <input v-model="param.name" class="jk-input" type="text" />
                  <p v-if="paramProblem(param)" class="jk-error">{{ paramProblem(param) }}</p>
                </div>
                <div v-if="param.type === 'string'" class="jk-field">
                  <label class="jk-label">Default Value</label>
                  <input v-model="param.defaultText" class="jk-input" type="text" />
                </div>
                <label v-else-if="param.type === 'boolean'" class="jk-check"><input v-model="param.defaultBool" type="checkbox" /> Set by Default</label>
                <div v-else class="jk-field">
                  <label class="jk-label">Choices</label>
                  <textarea v-model="param.choicesText" class="jk-textarea" rows="3"></textarea>
                  <p class="jk-help">Potential choices, one per line. The value on the first line will be the default.</p>
                </div>
              </div>
              <div class="jk-cfg__add">
                <button type="button" class="jk-btn" @click="addOpen = !addOpen">Add Parameter <JkIcon name="chevron-down" /></button>
                <div v-if="addOpen" class="jk-cfg__menu">
                  <button v-for="(label, type) in PARAM_LABEL" :key="type" type="button" class="jk-cfg__menu-item" @click="addParam(type)">{{ label }}</button>
                </div>
              </div>
            </div>
            <div v-if="declared.length" class="jk-alert jk-alert--info jk-cfg__declared">
              The Jenkinsfile's <code>parameters { }</code> block also defines:
              <strong>{{ declared.map(p => p.name).join(', ') }}</strong>. A declarative pipeline's own definitions win when it runs.
            </div>
          </template>
        </section>

        <!-- ===== Source Code Management (Freestyle) ===== -->
        <section v-if="form.type === 'freestyle'" :ref="el => register('scm', el)" class="jk-cfg__section">
          <h2 class="jk-cfg__h2">Source Code Management</h2>
          <label class="jk-check"><input v-model="form.checkout" type="radio" :value="false" /> None</label>
          <label class="jk-check"><input v-model="form.checkout" type="radio" :value="true" /> Git</label>
          <div v-if="form.checkout" class="jk-cfg__nested">
            <div class="jk-field"><label class="jk-label">Repository URL</label><input class="jk-input" type="text" :value="REPO" readonly /></div>
            <div class="jk-field"><label class="jk-label">Branch Specifier (blank for 'any')</label><input v-model="form.branchSpec" class="jk-input" type="text" /></div>
          </div>
        </section>

        <!-- ===== Triggers ===== -->
        <section v-if="form.type !== 'folder' && form.type !== 'multibranch'" :ref="el => register('triggers', el)" class="jk-cfg__section">
          <h2 class="jk-cfg__h2">Build Triggers</h2>
          <p class="jk-help jk-cfg__lead">Set up automated actions that start your build based on specific events, like code changes or scheduled times.</p>
          <label class="jk-check"><input v-model="form.upstreamOn" type="checkbox" /> Build after other projects are built</label>
          <div v-if="form.upstreamOn" class="jk-cfg__nested">
            <div class="jk-field">
              <label class="jk-label">Projects to watch</label>
              <input v-model="form.upstream" class="jk-input" type="text" list="jk-cfg-projects" />
              <datalist id="jk-cfg-projects"><option v-for="other in others" :key="other" :value="other" /></datalist>
              <p v-if="upstreamProblem" class="jk-error">{{ upstreamProblem }}</p>
            </div>
          </div>
          <label class="jk-check"><input v-model="form.cronOn" type="checkbox" /> Build periodically</label>
          <div v-if="form.cronOn" class="jk-cfg__nested">
            <div class="jk-field">
              <label class="jk-label">Schedule</label>
              <textarea v-model="form.cron" class="jk-textarea jk-mono" rows="2"></textarea>
              <p v-if="cronProblem(form.cron)" class="jk-error">{{ cronProblem(form.cron) }}</p>
              <p v-else-if="/\*\//.test(form.cron)" class="jk-warning">Spread load evenly by using ‘H/15 * * * *’ rather than ‘*/15 * * * *’</p>
              <p v-else class="jk-help">Would run on the schedule {{ form.cron || '(empty)' }}. (The lab has no scheduler: a timer never fires here.)</p>
            </div>
          </div>
          <label class="jk-check is-off"><input type="checkbox" disabled /> GitHub hook trigger for GITScm polling</label>
          <label class="jk-check"><input v-model="form.pollOn" type="checkbox" /> Poll SCM</label>
          <div v-if="form.pollOn" class="jk-cfg__nested">
            <div class="jk-field">
              <label class="jk-label">Schedule</label>
              <textarea v-model="form.poll" class="jk-textarea jk-mono" rows="2"></textarea>
              <p v-if="cronProblem(form.poll)" class="jk-error">{{ cronProblem(form.poll) }}</p>
            </div>
          </div>
          <label class="jk-check is-off"><input type="checkbox" disabled /> Quiet period</label>
          <label class="jk-check is-off"><input type="checkbox" disabled /> Trigger builds remotely (e.g., from scripts)</label>
        </section>

        <!-- ===== Build Steps (Freestyle) ===== -->
        <section v-if="form.type === 'freestyle'" :ref="el => register('steps', el)" class="jk-cfg__section">
          <h2 class="jk-cfg__h2">Build Steps</h2>
          <div v-if="form.shellOn" class="jk-cfg__param">
            <header class="jk-cfg__param-head">
              <strong>Execute shell</strong>
              <button type="button" class="jk-cfg__x" aria-label="Remove Execute shell" @click="form.shellOn = false"><JkIcon name="close" /></button>
            </header>
            <label class="jk-label">Command</label>
            <JkCodeEditor v-model="form.shell" label="Command" height="176px" />
            <p class="jk-help">See the list of available environment variables. The lab shell has 61 builtins and no compiler.</p>
          </div>
          <div class="jk-cfg__add">
            <button type="button" class="jk-btn" @click="stepOpen = !stepOpen">Add build step <JkIcon name="chevron-down" /></button>
            <div v-if="stepOpen" class="jk-cfg__menu">
              <button type="button" class="jk-cfg__menu-item" @click="form.shellOn = true; stepOpen = false">Execute shell</button>
              <button type="button" class="jk-cfg__menu-item" disabled>Execute Windows batch command</button>
              <button type="button" class="jk-cfg__menu-item" disabled>Invoke top-level Maven targets</button>
            </div>
          </div>
        </section>

        <!-- ===== Pipeline / Branch sources ===== -->
        <section v-if="isPipeline" :ref="el => register('pipeline', el)" class="jk-cfg__section">
          <h2 class="jk-cfg__h2">{{ form.type === 'multibranch' ? 'Branch Sources' : 'Pipeline' }}</h2>
          <template v-if="form.type === 'pipeline'">
            <div class="jk-field">
              <label class="jk-label" for="jk-cfg-def">Definition</label>
              <select id="jk-cfg-def" v-model="form.definition" class="jk-select jk-cfg__select">
                <option value="script">Pipeline script</option>
                <option value="scm">Pipeline script from SCM</option>
              </select>
            </div>
          </template>

          <template v-if="form.type === 'pipeline' && form.definition === 'script'">
            <div class="jk-field jk-cfg__wide">
              <label class="jk-label">Script</label>
              <JkCodeEditor v-model="form.script" label="Pipeline script" />
              <div class="jk-cfg__script-foot">
                <label class="jk-check is-off"><input type="checkbox" checked disabled /> Use Groovy Sandbox</label>
                <button type="button" class="jk-link" @click="ctx.go({ page: 'syntax', job: form.name })">Pipeline Syntax</button>
              </div>
              <p class="jk-help">The lab's tasks read the repository's <code>Jenkinsfile</code>; an inline script lives only in this job.</p>
            </div>
          </template>

          <template v-else>
            <div class="jk-field">
              <label class="jk-label">SCM</label>
              <select class="jk-select jk-cfg__select" disabled><option>Git</option></select>
            </div>
            <div class="jk-cfg__nested">
              <div class="jk-field"><label class="jk-label">Repository URL</label><input class="jk-input" type="text" :value="REPO" readonly /></div>
              <div class="jk-field">
                <label class="jk-label">Credentials</label>
                <select class="jk-select jk-cfg__select" disabled><option>- none -</option></select>
              </div>
              <div class="jk-field">
                <label class="jk-label">Branch Specifier (blank for 'any')</label>
                <input v-model="form.branchSpec" class="jk-input" type="text" />
                <p class="jk-help">Builds report <code>BRANCH_NAME</code> from this (<code>jenkins-cli set-branch</code>).</p>
              </div>
            </div>
            <div class="jk-field">
              <label class="jk-label">Script Path</label>
              <input v-model="form.scriptPath" class="jk-input" type="text" list="jk-cfg-files" />
              <datalist id="jk-cfg-files"><option v-for="file in files" :key="file" :value="file" /></datalist>
              <p v-if="!files.includes(form.scriptPath.trim())" class="jk-warning">{{ form.scriptPath }} is not in the repository yet — a build will fail until it is committed.</p>
            </div>
            <label class="jk-check is-off"><input type="checkbox" checked disabled /> Lightweight checkout</label>

            <div class="jk-cfg__repo">
              <div class="jk-cfg__repo-head">
                <strong><JkIcon name="doc" /> {{ form.scriptPath || 'Jenkinsfile' }}</strong>
                <span class="jk-muted">in the lab repository · saving commits it</span>
              </div>
              <JkCodeEditor v-model="form.scmText" :label="form.scriptPath" />
            </div>
          </template>
        </section>

        <div class="jk-bottom-bar">
          <button type="submit" class="jk-btn jk-btn--primary jk-cfg__save" :disabled="saving">Save</button>
          <button type="button" class="jk-btn" :disabled="saving" @click="save(false)">Apply</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, type ComponentPublicInstance } from 'vue';
import { pick } from '@/utils/portalKit';
import JkIcon from './JkIcon.vue';
import JkCodeEditor from './JkCodeEditor.vue';
import { useJk } from './jkContext';
import { jcli, paramSpec, type JobConfig, type ParamDef } from './jenkinsKit';

const ctx = useJk();
const r = computed(() => ctx.route.value as any);
const REPO = 'https://git.lab.internal/selfstudy/demo-app.git';
const MAX = 3900;

const PARAM_LABEL: Record<string, string> = {
  boolean: 'Boolean Parameter',
  choice: 'Choice Parameter',
  string: 'String Parameter',
};

interface ParamRow { key: number; type: string; name: string; defaultText: string; defaultBool: boolean; choicesText: string }

interface Form {
  name: string; type: string; enabled: boolean; description: string;
  parameterized: boolean; params: ParamRow[];
  upstreamOn: boolean; upstream: string; cronOn: boolean; cron: string; pollOn: boolean; poll: string;
  definition: 'script' | 'scm'; script: string; scriptPath: string; scmText: string; branchSpec: string;
  checkout: boolean; shellOn: boolean; shell: string;
}

const form = ref<Form | null>(null);
const original = ref<Form | null>(null);
const config = ref<JobConfig | null>(null);
const loadError = ref('');
const saving = ref(false);
const preview = ref(false);
const addOpen = ref(false);
const stepOpen = ref(false);
const active = ref('general');
let seq = 0;

const isPipeline = computed(() => form.value?.type === 'pipeline' || form.value?.type === 'multibranch');
const declared = computed(() => (config.value?.params || []).filter(p => p.declared));
const files = computed(() => config.value?.files || []);
const others = computed(() => ctx.jobs.value.map(j => j.name).filter(n => n !== form.value?.name));

const sections = computed(() => {
  const f = form.value;
  if (!f) return [];
  const out = [{ id: 'general', label: 'General', icon: 'gear' }];
  if (f.type === 'freestyle') out.push({ id: 'scm', label: 'Source Code Management', icon: 'branch' });
  if (f.type !== 'folder' && f.type !== 'multibranch') out.push({ id: 'triggers', label: 'Triggers', icon: 'clock-play' });
  if (f.type === 'freestyle') out.push({ id: 'steps', label: 'Build Steps', icon: 'terminal' });
  if (f.type === 'pipeline') out.push({ id: 'pipeline', label: 'Pipeline', icon: 'pipeline' });
  if (f.type === 'multibranch') out.push({ id: 'pipeline', label: 'Branch Sources', icon: 'branch' });
  return out;
});

const anchors: Record<string, HTMLElement> = {};
function register(id: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) anchors[id] = el;
}
function jump(id: string) {
  active.value = id;
  anchors[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toRow(def: ParamDef): ParamRow {
  return {
    key: ++seq, type: def.type || 'string', name: def.name || '',
    defaultText: typeof def.default === 'string' ? def.default : '',
    defaultBool: Boolean(def.default), choicesText: (def.choices || []).join('\n'),
  };
}

function toDef(row: ParamRow): ParamDef {
  if (row.type === 'boolean') return { type: 'boolean', name: row.name.trim(), default: row.defaultBool };
  if (row.type === 'choice') {
    return { type: 'choice', name: row.name.trim(),
             choices: row.choicesText.split('\n').map(c => c.trim()).filter(Boolean) };
  }
  return { type: 'string', name: row.name.trim(), default: row.defaultText };
}

function fromConfig(c: JobConfig): Form {
  const triggers = c.triggers || {};
  const branch = c.branch || String(pick(ctx.view.value, 'portal.branch', 'main'));
  return {
    name: c.name, type: c.type || 'pipeline', enabled: !c.disabled, description: c.description || '',
    parameterized: (c.param_defs || []).length > 0, params: (c.param_defs || []).map(toRow),
    upstreamOn: Boolean(triggers.upstream), upstream: triggers.upstream || '',
    cronOn: Boolean(triggers.cron), cron: triggers.cron || 'H/15 * * * *',
    pollOn: Boolean(triggers.pollscm), poll: triggers.pollscm || 'H/5 * * * *',
    definition: c.from_scm ? 'scm' : 'script',
    script: c.script || '', scriptPath: c.script_path || 'Jenkinsfile',
    scmText: c.scm_text ?? '', branchSpec: `*/${branch}`,
    checkout: c.checkout !== false, shellOn: Boolean(c.shell), shell: c.shell || '',
  };
}

async function load() {
  loadError.value = '';
  const result = await ctx.run(jcli(['get-job', r.value.job]), { quiet: true, unlogged: true, direct: true });
  const data = result.data as JobConfig | undefined;
  if (!result.ok || !data) {
    loadError.value = String(result.error || result.output || 'The job could not be read.');
    return;
  }
  config.value = data;
  form.value = fromConfig(data);
  original.value = fromConfig(data);
}

onMounted(load);

function paramProblem(row: ParamRow): string {
  const name = row.name.trim();
  if (!name) return 'Name is required.';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return 'The parameter name must be letters, digits and underscores.';
  if (form.value && form.value.params.filter(p => p.name.trim() === name).length > 1) return `Parameter ${name} is defined twice.`;
  if (row.type === 'choice' && !row.choicesText.trim()) return 'Add at least one choice.';
  return '';
}

function cronProblem(spec: string): string {
  for (const raw of spec.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('@')) {
      if (!['@yearly', '@annually', '@monthly', '@weekly', '@daily', '@midnight', '@hourly'].includes(line)) return `Invalid input: "${line}"`;
      continue;
    }
    if (line.split(/\s+/).length !== 5) return `Invalid input: "${line}": expecting 5 fields (MINUTE HOUR DOM MONTH DOW)`;
  }
  return '';
}

const upstreamProblem = computed(() => {
  const f = form.value;
  if (!f?.upstreamOn) return '';
  const names = f.upstream.split(',').map(s => s.trim()).filter(Boolean);
  if (!names.length) return 'No project specified';
  const bad = names.find(n => !others.value.includes(n));
  return bad ? `No such project ‘${bad}’.` : '';
});

function addParam(type: string) {
  form.value?.params.push({ key: ++seq, type, name: '', defaultText: '', defaultBool: false, choicesText: '' });
  addOpen.value = false;
}

function branchName(spec: string): string {
  return spec.trim().replace(/^\*\//, '').replace(/^refs\/heads\//, '') || 'main';
}

/** The update-job words, with the big text values held back so they can be split off. */
function plan(f: Form, o: Form): { words: string[]; texts: [string, string][]; problem: string } {
  const words: string[] = ['update-job', f.name];
  const texts: [string, string][] = [];
  if (f.description !== o.description) {
    if (f.description.trim()) texts.push(['--description', f.description]);
    else words.push('--no-description');
  }
  if (f.type !== 'folder') {
    const wasParams = o.parameterized && o.params.length > 0;
    if (f.parameterized && f.params.length) {
      const problem = f.params.map(paramProblem).find(Boolean);
      if (problem) return { words, texts, problem };
      const defs = f.params.map(toDef);
      if (JSON.stringify(defs) !== JSON.stringify(o.params.map(toDef)) || !wasParams) {
        for (const def of defs) words.push('--param', paramSpec(def));
      }
    } else if (wasParams) {
      words.push('--no-params');
    }
    if (f.type !== 'multibranch') {
      if (f.upstreamOn) {
        if (upstreamProblem.value) return { words, texts, problem: upstreamProblem.value };
        if (f.upstream !== o.upstream || !o.upstreamOn) words.push('--upstream', f.upstream.split(',').map(s => s.trim()).filter(Boolean).join(','));
      } else if (o.upstreamOn) words.push('--no-upstream');
      for (const [on, value, wasOn, was, flag] of [
        [f.cronOn, f.cron, o.cronOn, o.cron, 'cron'], [f.pollOn, f.poll, o.pollOn, o.poll, 'poll-scm'],
      ] as [boolean, string, boolean, string, string][]) {
        if (on) {
          const problem = cronProblem(value) || (value.trim() ? '' : 'Schedule cannot be empty.');
          if (problem) return { words, texts, problem };
          if (value !== was || !wasOn) texts.push([`--${flag}`, value]);
        } else if (wasOn) words.push(`--no-${flag}`);
      }
    }
  }
  if (f.type === 'pipeline' && f.definition === 'script') {
    if (f.script !== o.script || o.definition !== 'script') {
      if (f.script.trim()) texts.push(['--script-text', f.script]);
      else words.push('--inline');
    }
  }
  if (isPipeline.value && (f.type === 'multibranch' || f.definition === 'scm')) {
    const path = f.scriptPath.trim();
    if (!path) return { words, texts, problem: 'Script Path is required.' };
    if (path !== o.scriptPath || o.definition !== 'scm') words.push('--script', path);
    if (f.scmText !== o.scmText && f.scmText.trim()) texts.push(['--scm-text', f.scmText]);
  }
  if (f.type === 'freestyle') {
    if (f.checkout !== o.checkout) words.push(f.checkout ? '--checkout' : '--no-checkout');
    const shell = f.shellOn ? f.shell : '';
    const wasShell = o.shellOn ? o.shell : '';
    if (shell !== wasShell) {
      if (shell.trim()) texts.push(['--shell', shell]);
      else words.push('--no-shell');
    }
  }
  return { words, texts, problem: '' };
}

async function save(leave: boolean) {
  const f = form.value;
  const o = original.value;
  if (!f || !o || saving.value) return;
  const { words, texts, problem } = plan(f, o);
  if (problem) {
    ctx.notify('error', 'Fix the form before saving', problem);
    return;
  }
  // One update-job when it fits; when a Jenkinsfile makes it too long, each
  // large value goes in a command of its own.
  const commands: string[] = [];
  const all = jcli([...words, ...texts.flat()]);
  if (all.length <= MAX) {
    if (words.length > 2 || texts.length) commands.push(all);
  } else {
    if (words.length > 2) commands.push(jcli(words));
    for (const [flag, value] of texts) {
      const one = jcli(['update-job', f.name, flag, value]);
      if (one.length > MAX) {
        ctx.notify('error', 'That text is too long for the lab', `The ${flag.replace(/^--/, '')} value is ${value.length} characters; one command can carry about ${MAX - 60}.`);
        return;
      }
      commands.push(one);
    }
  }
  saving.value = true;
  try {
    for (const command of commands) {
      const result = await ctx.run(command);
      if (!result.ok) return;
    }
    if (f.type !== 'folder' && f.enabled !== o.enabled) {
      const result = await ctx.run(jcli([f.enabled ? 'enable-job' : 'disable-job', f.name]));
      if (!result.ok) return;
    }
    const usesBranch = (isPipeline.value && (f.type === 'multibranch' || f.definition === 'scm')) || (f.type === 'freestyle' && f.checkout);
    if (usesBranch && branchName(f.branchSpec) !== branchName(o.branchSpec)) {
      const result = await ctx.run(jcli(['set-branch', branchName(f.branchSpec)]));
      if (!result.ok) return;
    }
    ctx.notify('success', 'Saved');
    if (leave) ctx.go({ page: 'job', job: f.name });
    else await load();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.jk-cfg__layout { display: grid; grid-template-columns: 208px minmax(0, 1fr); gap: 32px; align-items: start; }
.jk-cfg__nav { position: sticky; top: 0; display: flex; flex-direction: column; gap: 1.6px; }
.jk-cfg__nav-item { display: flex; align-items: center; gap: 9.6px; padding: 7.2px 11.2px; border: 0; border-radius: 9.6px; background: none; font: inherit; font-weight: 500; color: var(--jk-text); text-align: left; cursor: pointer; }
.jk-cfg__nav-item:hover { background: var(--jk-btn-hover); }
.jk-cfg__nav-item.is-active { background: var(--jk-btn-bg); font-weight: 650; }
.jk-cfg__nav-item .jk-icon { width: 17.6px; height: 17.6px; }
.jk-cfg__form { min-width: 0; }
.jk-cfg__section { padding-bottom: 19.2px; margin-bottom: 22.4px; border-bottom: 1px solid var(--jk-border); scroll-margin-top: 8px; }
.jk-cfg__h2 { font-size: 20.8px; font-weight: 700; margin: 0 0 16px; }
.jk-cfg__lead { margin: -9.6px 0 12.8px; }
.jk-cfg__nested { margin: 4.8px 0 16px 26.4px; padding-left: 16px; border-left: 2px solid var(--jk-border); }
.jk-cfg__param { position: relative; border: 1px solid var(--jk-border); border-radius: 12.8px; padding: 12.8px 16px 4.8px; margin-bottom: 12.8px; max-width: 832px; background: #fff; }
.jk-cfg__param-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9.6px; }
.jk-cfg__x { display: flex; border: 0; background: none; padding: 3.2px; border-radius: 6.4px; color: var(--jk-secondary); cursor: pointer; }
.jk-cfg__x:hover { background: var(--jk-btn-hover); color: var(--jk-red); }
.jk-cfg__x .jk-icon { width: 16px; height: 16px; }
.jk-cfg__add { position: relative; display: inline-block; margin-bottom: 6.4px; }
.jk-cfg__add .jk-icon { width: 14.4px; height: 14.4px; }
.jk-cfg__menu { position: absolute; top: calc(100% + 4.8px); left: 0; z-index: 20; min-width: 256px; padding: 5.6px; background: #fff; border-radius: 12.8px; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06), 0 10px 30px rgba(0, 0, 0, 0.18); }
.jk-cfg__menu-item { display: block; width: 100%; padding: 7.2px 11.2px; border: 0; background: none; border-radius: 8px; font: inherit; text-align: left; cursor: pointer; color: var(--jk-text); }
.jk-cfg__menu-item:hover:not(:disabled) { background: var(--jk-btn-hover); }
.jk-cfg__menu-item:disabled { color: var(--jk-secondary); cursor: not-allowed; }
.jk-cfg__declared { max-width: 832px; margin-top: 9.6px; }
.jk-cfg__select { max-width: 384px; }
.jk-cfg__wide { max-width: 960px; }
.jk-cfg__script-foot { display: flex; align-items: center; justify-content: space-between; max-width: 960px; }
.jk-cfg__preview { margin-top: 4.8px; font-size: 12.8px; }
.jk-cfg__preview-box { margin-top: 6.4px; white-space: pre-wrap; }
.jk-cfg__repo { margin-top: 19.2px; max-width: 960px; }
.jk-cfg__repo-head { display: flex; align-items: center; gap: 9.6px; flex-wrap: wrap; margin-bottom: 6.4px; }
.jk-cfg__repo-head strong { display: flex; align-items: center; gap: 5.6px; }
.jk-cfg__repo-head .jk-icon { width: 16px; height: 16px; }
.jk-cfg__save { min-width: 88px; }
.jk-check.is-off { color: var(--jk-secondary); cursor: not-allowed; }
.jk-toggle { display: inline-flex; align-items: center; gap: 8.8px; font-weight: 600; cursor: pointer; }
.jk-toggle input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.jk-toggle__track { position: relative; width: 38.4px; height: 21.6px; border-radius: 16px; background: rgba(119, 118, 124, 0.35); transition: background 0.15s; }
.jk-toggle__thumb { position: absolute; top: 2.88px; left: 2.88px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25); }
.jk-toggle input:checked + .jk-toggle__track { background: var(--jk-accent); }
.jk-toggle input:checked + .jk-toggle__track .jk-toggle__thumb { transform: translateX(16.8px); }
.jk-toggle input:focus-visible + .jk-toggle__track { box-shadow: 0 0 0 3px rgba(11, 102, 228, 0.3); }
@container sl-portal (max-width: 900px) {
  .jk-cfg__layout { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .jk-cfg__nav { position: static; flex-direction: row; overflow-x: auto; padding-bottom: 6.4px; }
  .jk-cfg__nav-item { white-space: nowrap; }
  .jk-cfg__nested { margin-left: 6.4px; padding-left: 11.2px; }
}
</style>
