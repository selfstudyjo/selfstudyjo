<template>
  <div>
    <CsHeader title="Create database" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Choose a database creation method" :level="2" /></div>
      <div class="cs-container__body"><div class="cs-tiles">
        <label class="cs-tile is-checked"><input type="radio" checked /><span><strong>Standard create</strong><small>You set all of the configuration options, including ones for availability, security, backups, and maintenance.</small></span></label>
        <label class="cs-tile rc__off"><input type="radio" disabled /><span><strong>Easy create</strong><small>Use recommended best-practice configurations. Some configuration options can be changed after the database is created.</small></span></label>
      </div></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Engine options" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <span class="cs-label">Engine type <a class="cs-link rc__info">Info</a></span>
        <div class="rc__engines">
          <label class="cs-tile rc__off"><input type="radio" disabled /><span><strong>Aurora (MySQL Compatible)</strong></span></label>
          <label class="cs-tile rc__off"><input type="radio" disabled /><span><strong>Aurora (PostgreSQL Compatible)</strong></span></label>
          <label v-for="e in engines" :key="e.engine" class="cs-tile" :class="{ 'is-checked': engine === e.engine }">
            <input v-model="engine" type="radio" :value="e.engine" @change="onEngine" /><span><strong>{{ engineLabel(e.engine) }}</strong></span></label>
        </div>
        <div class="cs-field"><label class="cs-label" for="rc-ver">Engine version</label>
          <select id="rc-ver" v-model="version" class="cs-select"><option :value="defaultVersion">{{ engineLabel(engine) }} {{ defaultVersion }}</option></select></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Templates" :level="2" description="Choose a sample template to meet your use case." /></div>
      <div class="cs-container__body"><div class="cs-tiles">
        <label v-for="t in templates" :key="t.id" class="cs-tile" :class="{ 'is-checked': template === t.id }">
          <input v-model="template" type="radio" :value="t.id" @change="onTemplate" /><span><strong>{{ t.title }}</strong><small>{{ t.text }}</small></span></label>
      </div></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Settings" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="rc-id">DB instance identifier <a class="cs-link rc__info">Info</a></label>
          <div class="cs-desc">Type a name for your DB instance. The name must be unique across all DB instances owned by your AWS account in the current AWS Region.</div>
          <input id="rc-id" v-model.trim="identifier" class="cs-input" :class="{ 'is-invalid': tried && idError }" />
          <span v-if="tried && idError" class="cs-error-text">{{ idError }}</span>
          <span class="cs-constraint">The DB instance identifier is case-insensitive, but is stored as all lowercase (as in "mydbinstance"). Constraints: 1 to 60 alphanumeric characters or hyphens. First character must be a letter. Can't contain two consecutive hyphens. Can't end with a hyphen.</span></div>
        <div class="cs-field"><label class="cs-label" for="rc-user">Master username <a class="cs-link rc__info">Info</a></label>
          <div class="cs-desc">Type a login ID for the master user of your DB instance.</div>
          <input id="rc-user" v-model.trim="username" class="cs-input" :class="{ 'is-invalid': tried && !/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(username) }" />
          <span class="cs-constraint">1 to 16 alphanumeric characters. The first character must be a letter.</span></div>
        <div class="cs-field"><span class="cs-label">Credentials management</span>
          <label class="cs-radio"><input v-model="credMode" type="radio" value="secrets" /> Managed in AWS Secrets Manager - <em>most secure</em><small>RDS generates a password for you and manages it throughout its lifecycle using AWS Secrets Manager.</small></label>
          <label class="cs-radio"><input v-model="credMode" type="radio" value="self" /> Self managed<small>Create your own password or have RDS create a password that you manage.</small></label></div>
        <template v-if="credMode === 'self'">
          <div class="cs-field"><label class="cs-label" for="rc-pw">Master password <a class="cs-link rc__info">Info</a></label>
            <input id="rc-pw" v-model="password" type="password" class="cs-input" :class="{ 'is-invalid': tried && pwError }" autocomplete="new-password" />
            <span v-if="tried && pwError" class="cs-error-text">{{ pwError }}</span>
            <span class="cs-constraint">Minimum constraints: At least 8 printable ASCII characters. Can't contain any of the following symbols: / ' " @</span></div>
          <div class="cs-field"><label class="cs-label" for="rc-pw2">Confirm master password <a class="cs-link rc__info">Info</a></label>
            <input id="rc-pw2" v-model="password2" type="password" class="cs-input" :class="{ 'is-invalid': tried && password2 !== password }" autocomplete="new-password" />
            <span v-if="tried && password2 !== password" class="cs-error-text">Passwords must match.</span></div>
        </template>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Instance configuration" :level="2"
        description="The DB instance configuration options below are limited to those supported by the engine that you selected above." /></div>
      <div class="cs-container__body"><div class="cs-field"><label class="cs-label" for="rc-class">DB instance class <a class="cs-link rc__info">Info</a></label>
        <select id="rc-class" v-model="dbClass" class="cs-select"><option v-for="c in classes" :key="c" :value="c">{{ c }}</option></select></div></div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Storage" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><span class="cs-label">Storage type</span><select class="cs-select" disabled><option>General Purpose SSD (gp3)</option></select></div>
        <div class="cs-field"><label class="cs-label" for="rc-st">Allocated storage <a class="cs-link rc__info">Info</a></label>
          <div class="cs-row"><input id="rc-st" v-model.number="storage" type="number" min="20" max="6144" class="cs-input rc__num" :class="{ 'is-invalid': storageError }" /> GiB</div>
          <span v-if="storageError" class="cs-error-text">{{ storageError }}</span>
          <span class="cs-constraint">The minimum value is 20 GiB and the maximum value is 6,144 GiB.</span></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Availability and durability" :level="2" :info="false" /></div>
      <div class="cs-container__body cs-stack">
        <span class="cs-label">Deployment options <a class="cs-link rc__info">Info</a></span>
        <label class="cs-radio"><input v-model="multiAz" type="radio" :value="true" :disabled="template === 'free'" /> Multi-AZ DB instance deployment (2 instances)<small>Creates a primary DB instance and a standby DB instance in a different AZ.</small></label>
        <label class="cs-radio"><input v-model="multiAz" type="radio" :value="false" /> Single-AZ DB instance deployment (1 instance)<small>Creates a single DB instance with no standby DB instances.</small></label>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Connectivity" :level="2" /></div>
      <div class="cs-container__body cs-stack">
        <span class="cs-label">Public access <a class="cs-link rc__info">Info</a></span>
        <label class="cs-radio"><input v-model="publicAccess" type="radio" :value="true" /> Yes<small>RDS assigns a public IP address to the database. Amazon EC2 instances and other resources outside of the VPC can connect to your database.</small></label>
        <label class="cs-radio"><input v-model="publicAccess" type="radio" :value="false" /> No<small>RDS doesn't assign a public IP address to the database. Only Amazon EC2 instances and other resources inside the VPC can connect to your database.</small></label>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Estimated monthly costs" :level="2" :info="false" /></div>
      <div class="cs-container__body"><p class="rc__p">This lab is simulated - nothing is billed. On AWS, {{ dbClass }} with {{ storage }} GiB {{ multiAz ? 'in two AZs ' : '' }}is billed per hour.</p></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('rds', 'databases')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create database</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, pick, rows } from '@/utils/portalKit';
import CsHeader from '../CsHeader.vue';
import { useAws } from '../ctx';
import { DEFAULT_USER, engineLabel } from './rdsKit';

const ctx = useAws();
const engines = computed(() => pick<any[]>(ctx.view.value, 'db_engines', [{ engine: 'postgres', version: '16.4' }]));
const classes = computed(() => pick<string[]>(ctx.view.value, 'db_classes', ['db.t3.micro']));
const engine = ref('postgres');
const defaultVersion = computed(() => engines.value.find(e => e.engine === engine.value)?.version || '');
const version = ref(defaultVersion.value);
const template = ref('free');
const identifier = ref(`database-${rows(ctx.view.value, 'rds').length + 1}`);
const username = ref('postgres');
const credMode = ref('self');
const password = ref('');
const password2 = ref('');
const dbClass = ref('db.t3.micro');
const storage = ref(20);
const multiAz = ref(false);
const publicAccess = ref(false);
const tried = ref(false);
const busy = ref(false);

const templates = [
  { id: 'production', title: 'Production', text: 'Use defaults for high availability and fast, consistent performance.' },
  { id: 'dev', title: 'Dev/Test', text: 'This instance is intended for development use outside of a production environment.' },
  { id: 'free', title: 'Free tier', text: 'Use RDS Free Tier to develop new applications, test existing applications, or gain hands-on experience with Amazon RDS.' },
];

const idError = computed(() => {
  const value = identifier.value;
  if (!/^[A-Za-z][A-Za-z0-9-]{0,59}$/.test(value) || value.endsWith('-') || value.includes('--')) {
    return 'The DB instance identifier is invalid. 1 to 60 alphanumeric characters or hyphens, starting with a letter.';
  }
  if (rows(ctx.view.value, 'rds').some(d => d.id === value.toLowerCase())) return `DB instance ${value} already exists.`;
  return '';
});
const pwError = computed(() => {
  if (password.value.length < 8) return 'Master password must be at least 8 characters.';
  if (/[/'"@]/.test(password.value)) return 'Master password can\'t contain / \' " or @.';
  return '';
});
const storageError = computed(() => (storage.value >= 20 && storage.value <= 6144 ? '' : 'Allocated storage must be between 20 and 6144 GiB.'));

function onEngine() {
  version.value = defaultVersion.value;
  username.value = DEFAULT_USER[engine.value] || 'admin';
}
function onTemplate() {
  if (template.value === 'free') { multiAz.value = false; dbClass.value = 'db.t3.micro'; }
  if (template.value === 'production') { multiAz.value = true; dbClass.value = 'db.m5.large'; }
}
async function create() {
  tried.value = true;
  if (idError.value || storageError.value || !/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(username.value)) return;
  if (credMode.value === 'self' && (pwError.value || password.value !== password2.value)) return;
  busy.value = true;
  const id = identifier.value.toLowerCase();
  const result = await ctx.run(cli(['aws', 'rds', 'create-db-instance'], {
    '--db-instance-identifier': id, '--engine': engine.value, '--engine-version': version.value,
    '--db-instance-class': dbClass.value, '--allocated-storage': storage.value,
    '--master-username': username.value,
    '--master-user-password': credMode.value === 'self' ? password.value : '',
    '--manage-master-user-password': credMode.value === 'secrets',
    '--multi-az': multiAz.value, '--no-multi-az': !multiAz.value,
    '--publicly-accessible': publicAccess.value, '--no-publicly-accessible': !publicAccess.value,
  }), `Creating database ${id}. Your database might take a few minutes to launch.`);
  busy.value = false;
  if (result.ok) ctx.to('rds', 'databases');
}
</script>

<style scoped>
.rc__off { opacity: .55; cursor: default; }
.rc__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
.rc__engines { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.rc__num { width: 140px; }
.rc__p { margin: 0; color: #424650; }
</style>
