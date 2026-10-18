<template>
  <div v-if="page === 'pipelines'">
    <CsTable variant="full-page" title="Image pipelines" :items="pipelines" :columns="pipeCols" track-by="arn" selection-type="single" v-model:selected="sel"
             empty-title="No image pipelines" empty-text="Create an image pipeline to automate building golden images.">
      <template #actions>
        <CsDropdown :items="pipeActions" :disabled="!sel.length" @select="pipeAct" />
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('imagebuilder', 'pipeline-create')">Create image pipeline</button>
      </template>
      <template #cell-status="{ row }"><CsStatus :type="row.status === 'ENABLED' ? 'success' : 'stopped'" :label="row.status === 'ENABLED' ? 'Enabled' : 'Disabled'" /></template>
    </CsTable>
  </div>

  <div v-else-if="page === 'pipeline-create'">
    <CsHeader title="Create image pipeline" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Pipeline details" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Name</label><input v-model="pf.name" class="cs-input" placeholder="payments-api-weekly" /></div>
        <label class="cs-check"><input v-model="pf.tests" type="checkbox" /><span>Enable image tests<small>Run the test phase of the recipe's components before distributing the image.</small></span></label>
        <div class="cs-field"><label class="cs-label">Build schedule - cron expression <small>- optional</small></label><input v-model="pf.schedule" class="cs-input cs-mono" placeholder="cron(0 3 ? * SUN *)" />
          <span class="cs-constraint">Leave empty for a manual pipeline.</span></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Recipe and configurations" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label">Image recipe</label><select v-model="pf.recipe" class="cs-select"><option v-for="r in recipes" :key="r.arn" :value="r.arn">{{ r.name }} {{ r.version }}</option></select>
          <span v-if="!recipes.length" class="cs-error-text">Create an image recipe first.</span></div>
        <div class="cs-field"><label class="cs-label">Infrastructure configuration</label><select v-model="pf.infra" class="cs-select"><option v-for="r in infra" :key="r.arn" :value="r.arn">{{ r.name }}</option></select>
          <span v-if="!infra.length" class="cs-error-text">Create an infrastructure configuration first.</span></div>
        <div class="cs-field"><label class="cs-label">Distribution settings <small>- optional</small></label><select v-model="pf.dist" class="cs-select"><option value="">None</option><option v-for="r in dist" :key="r.arn" :value="r.arn">{{ r.name }}</option></select></div>
      </div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('imagebuilder', 'pipelines')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !pf.name.trim() || !pf.recipe || !pf.infra" @click="createPipeline">Create pipeline</button>
    </div>
  </div>

  <CsTable v-else-if="page === 'images'" variant="full-page" title="Images" :items="builds" :columns="imgCols" track-by="arn" empty-title="No images">
    <template #cell-status="{ row }"><CsStatus :type="row.status === 'AVAILABLE' ? 'success' : row.status === 'FAILED' ? 'error' : 'in-progress'" :label="row.status" /></template>
  </CsTable>

  <CsTable v-else-if="page === 'components'" variant="full-page" title="Components" :items="components" :columns="compCols" track-by="key" empty-title="No components">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openComponent">Create component</button></template>
  </CsTable>

  <CsTable v-else-if="page === 'recipes'" variant="full-page" title="Image recipes" :items="recipes" :columns="recCols" track-by="arn" empty-title="No image recipes">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openRecipe">Create image recipe</button></template>
  </CsTable>

  <CsTable v-else-if="page === 'infra'" variant="full-page" title="Infrastructure configurations" :items="infra" :columns="infraCols" track-by="arn" empty-title="No infrastructure configurations">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="openInfra">Create infrastructure configuration</button></template>
  </CsTable>

  <CsTable v-else-if="page === 'dist'" variant="full-page" title="Distribution settings" :items="dist" :columns="distCols" track-by="arn" empty-title="No distribution settings">
    <template #actions><button type="button" class="cs-btn cs-btn--primary" @click="distForm = { name: '', regions: [ctx.home.value] }">Create distribution settings</button></template>
  </CsTable>

  <CsModal v-if="compForm" title="Create component" size="large" @close="compForm = null">
    <div class="cs-stack">
      <div class="cs-grid-3">
        <div class="cs-field"><label class="cs-label">Component name</label><input v-model="compForm.name" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Component version</label><input v-model="compForm.version" class="cs-input" placeholder="1.0.0" /></div>
        <div class="cs-field"><label class="cs-label">Image operating system (OS)</label><select v-model="compForm.platform" class="cs-select"><option>Linux</option><option>Windows</option></select></div>
      </div>
      <div class="cs-field"><label class="cs-label">Content - define document content</label>
        <textarea v-model="compForm.data" class="cs-textarea cs-mono ib__yaml" spellcheck="false" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="compForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !compForm.name || !compForm.version || !compForm.data" @click="createComponent">Create component</button>
    </template>
  </CsModal>

  <CsModal v-if="recForm" title="Create image recipe" size="large" @close="recForm = null">
    <div class="cs-stack">
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Name</label><input v-model="recForm.name" class="cs-input" /></div>
        <div class="cs-field"><label class="cs-label">Version</label><input v-model="recForm.version" class="cs-input" placeholder="1.0.0" /></div>
      </div>
      <div class="cs-field"><label class="cs-label">Base image</label>
        <select v-model="recForm.parent" class="cs-select"><option value="amazon-linux-2023-x86">Amazon Linux 2023 x86</option><option value="windows-server-2022-english-full-base-x86">Windows Server 2022 English Full Base x86</option></select></div>
      <div class="cs-field"><label class="cs-label">Components</label>
        <div class="ib__chips"><label v-for="c in components.filter(c => c.platform === recPlatform)" :key="c.key" class="cs-check"><input v-model="recForm.components" type="checkbox" :value="c.name" />{{ c.name }} <small>({{ c.owner }})</small></label></div></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="recForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !recForm.name || !recForm.version || !recForm.components.length" @click="createRecipe">Create recipe</button>
    </template>
  </CsModal>

  <CsModal v-if="infraForm" title="Create infrastructure configuration" size="large" @close="infraForm = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="infraForm.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">IAM role (instance profile)</label><select v-model="infraForm.profile" class="cs-select"><option v-for="p in profiles" :key="p.name" :value="p.name">{{ p.name }}</option></select>
        <span class="cs-constraint">The build instance needs EC2InstanceProfileForImageBuilder and AmazonSSMManagedInstanceCore.</span></div>
      <div class="cs-grid-2">
        <div class="cs-field"><label class="cs-label">Subnet</label><select v-model="infraForm.subnet" class="cs-select"><option v-for="s in subnets" :key="s.id" :value="s.id">{{ s.id }} ({{ s.name }})</option></select></div>
        <div class="cs-field"><label class="cs-label">Security group</label><select v-model="infraForm.sg" class="cs-select"><option v-for="g in sgs" :key="g.id" :value="g.id">{{ g.id }} ({{ g.name }})</option></select></div>
      </div>
      <div class="cs-field"><label class="cs-label">Instance type</label><select v-model="infraForm.type" class="cs-select"><option>m5.large</option><option>c5.large</option><option>t3.large</option></select></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="infraForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !infraForm.name" @click="createInfra">Create configuration</button>
    </template>
  </CsModal>

  <CsModal v-if="distForm" title="Create distribution settings" @close="distForm = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Name</label><input v-model="distForm.name" class="cs-input" /></div>
      <div class="cs-field"><label class="cs-label">Regions</label>
        <div class="ib__chips"><label v-for="r in ['eu-west-1', 'eu-central-1', 'us-east-1']" :key="r" class="cs-check"><input v-model="distForm.regions" type="checkbox" :value="r" />{{ r }}</label></div></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="distForm = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !distForm.name || !distForm.regions.length" @click="createDist">Create settings</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete image pipeline" :word="deleting.name" :busy="busy" @close="deleting = null" @confirm="removePipeline">
    <p class="ib__p">Images it already built are kept.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsDropdown from '../../aws/CsDropdown.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsStatus from '../../aws/CsStatus.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const deleting = ref<any>(null);
const compForm = ref<any>(null);
const recForm = ref<any>(null);
const infraForm = ref<any>(null);
const distForm = ref<any>(null);

const pipelines = computed(() => rows<any>(ctx.c.value, 'imagebuilder.pipelines').map(p => ({ ...p, recipeName: p.recipe.split('/').slice(-2).join(' '),
  testsText: p.tests ? 'Enabled' : 'Disabled', scheduleText: p.schedule || 'Manual' })));
const builds = computed(() => rows<any>(ctx.c.value, 'imagebuilder.builds').map(b => ({ ...b, version: b.arn.split('/').slice(-2).join('/'), amiText: b.ami || '-' })));
const components = computed(() => rows<any>(ctx.c.value, 'imagebuilder.components').map(x => ({ ...x, key: `${x.owner}/${x.name}`, phasesText: (x.phases || []).join(', ') })));
const recipes = computed(() => rows<any>(ctx.c.value, 'imagebuilder.recipes').map(r => ({ ...r, componentsText: r.components.join(', ') })));
const infra = computed(() => rows<any>(ctx.c.value, 'imagebuilder.infra'));
const dist = computed(() => rows<any>(ctx.c.value, 'imagebuilder.dist').map(d => ({ ...d, regionsText: d.regions.join(', ') })));
const profiles = computed(() => rows<any>(ctx.c.value, 'iam.profiles'));
const subnets = computed(() => rows<any>(ctx.c.value, 'net.subnets').filter(s => s.vpc === 'vpc-0prod20a1b2c3d4e'));
const sgs = computed(() => rows<any>(ctx.c.value, 'net.sgs').filter(g => g.vpc === 'vpc-0prod20a1b2c3d4e'));
const recPlatform = computed(() => (recForm.value?.parent?.startsWith('windows') ? 'Windows' : 'Linux'));

const pipeCols = [{ id: 'name', header: 'Pipeline name' }, { id: 'status', header: 'Pipeline status' }, { id: 'recipeName', header: 'Image recipe' },
  { id: 'scheduleText', header: 'Schedule' }, { id: 'testsText', header: 'Image tests' }];
const imgCols = [{ id: 'name', header: 'Image name' }, { id: 'version', header: 'Version' }, { id: 'pipeline', header: 'Pipeline' },
  { id: 'status', header: 'Status' }, { id: 'amiText', header: 'Output AMI' }, { id: 'started', header: 'Started (shift)' },
  { id: 'reason', header: 'Status reason', cell: (b: any) => b.reason || '-' }];
const compCols = [{ id: 'name', header: 'Name', sortKey: 'name' }, { id: 'owner', header: 'Owner' }, { id: 'platform', header: 'Platform' }, { id: 'phasesText', header: 'Phases' }];
const recCols = [{ id: 'name', header: 'Name' }, { id: 'version', header: 'Version' }, { id: 'platform', header: 'Platform' }, { id: 'componentsText', header: 'Components' }];
const infraCols = [{ id: 'name', header: 'Name' }, { id: 'profile', header: 'IAM role' }, { id: 'subnet', header: 'Subnet' }];
const distCols = [{ id: 'name', header: 'Name' }, { id: 'regionsText', header: 'Regions' }];
const pipeActions = computed(() => {
  const p = pipelines.value.find(x => x.arn === sel.value[0]);
  return [{ id: 'run', text: 'Run pipeline' }, { id: 'toggle', text: p?.status === 'ENABLED' ? 'Disable pipeline' : 'Enable pipeline' }, { id: 'delete', text: 'Delete' }];
});

async function pipeAct(action: string) {
  const p = pipelines.value.find(x => x.arn === sel.value[0]);
  if (!p) return;
  if (action === 'delete') { deleting.value = p; return; }
  busy.value = true;
  if (action === 'run') await ctx.run(cli(['aws', 'imagebuilder', 'start-image-pipeline-execution'], { '--image-pipeline-arn': p.arn }),
    `Pipeline ${p.name} started. The build progresses as the scenario clock moves; follow it under Images.`);
  if (action === 'toggle') await ctx.run(cli(['aws', 'imagebuilder', 'update-image-pipeline'], { '--image-pipeline-arn': p.arn,
    '--status': p.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' }), `Pipeline ${p.name} updated.`);
  busy.value = false;
}
const pf = reactive({ name: '', tests: true, schedule: 'cron(0 3 ? * SUN *)', recipe: '', infra: '', dist: '' });
async function createPipeline() {
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'imagebuilder', 'create-image-pipeline'], {
    '--name': pf.name.trim(), '--image-recipe-arn': pf.recipe, '--infrastructure-configuration-arn': pf.infra,
    '--distribution-configuration-arn': pf.dist, '--schedule': pf.schedule.trim() ? `ScheduleExpression=${pf.schedule.trim()}` : '',
    '--image-tests-configuration': `imageTestsEnabled=${pf.tests}`,
  }), `Pipeline ${pf.name} created.`);
  busy.value = false;
  if (result.ok) ctx.to('imagebuilder', 'pipelines');
}
function openComponent() {
  compForm.value = { name: '', version: '1.0.0', platform: 'Linux', data: 'name: my-component\ndescription: Hardening\nschemaVersion: 1.0\nphases:\n  - name: build\n    steps:\n      - name: Harden\n        action: ExecuteBash\n        inputs:\n          commands:\n            - echo hardened\n' };
}
async function createComponent() {
  const f = compForm.value;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'imagebuilder', 'create-component'], { '--name': f.name.trim(), '--semantic-version': f.version.trim(),
    '--platform': f.platform, '--data': f.data }), `Component ${f.name} created.`);
  busy.value = false;
  if (result.ok) compForm.value = null;
}
function openRecipe() { recForm.value = { name: '', version: '1.0.0', parent: 'amazon-linux-2023-x86', components: [] }; }
async function createRecipe() {
  const f = recForm.value;
  const account = (n: string) => (components.value.find(c => c.name === n)?.owner === 'Amazon' ? 'aws' : ctx.account.value);
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'imagebuilder', 'create-image-recipe'], { '--name': f.name.trim(), '--semantic-version': f.version.trim(),
    '--parent-image': `arn:aws:imagebuilder:${ctx.home.value}:aws:image/${f.parent}/x.x.x`,
    '--components': f.components.map((n: string) => `componentArn=arn:aws:imagebuilder:${ctx.home.value}:${account(n)}:component/${n}/x.x.x`) }),
    `Recipe ${f.name} created.`);
  busy.value = false;
  if (result.ok) recForm.value = null;
}
function openInfra() { infraForm.value = { name: '', profile: 'imagebuilder-instance-role', subnet: 'subnet-0app-a', sg: 'sg-0app', type: 'm5.large' }; }
async function createInfra() {
  const f = infraForm.value;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'imagebuilder', 'create-infrastructure-configuration'], { '--name': f.name.trim(), '--instance-profile-name': f.profile,
    '--subnet-id': f.subnet, '--security-group-ids': [f.sg], '--instance-types': [f.type] }), `Infrastructure configuration ${f.name} created.`);
  busy.value = false;
  if (result.ok) infraForm.value = null;
}
async function createDist() {
  const f = distForm.value;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'imagebuilder', 'create-distribution-configuration'], { '--name': f.name.trim(),
    '--distributions': f.regions.map((r: string) => `Region=${r}`) }), `Distribution settings ${f.name} created.`);
  busy.value = false;
  if (result.ok) distForm.value = null;
}
async function removePipeline() {
  busy.value = true;
  const p = deleting.value;
  await ctx.run(cli(['aws', 'imagebuilder', 'delete-image-pipeline'], { '--image-pipeline-arn': p.arn }), `Pipeline ${p.name} deleted.`);
  busy.value = false;
  deleting.value = null;
  sel.value = [];
}
</script>

<style scoped>
.ib__yaml { min-height: 260px; }
.ib__chips { display: flex; flex-wrap: wrap; gap: 6px 16px; }
.ib__chips small { color: #656871; }
.ib__p { margin: 0; }
</style>
