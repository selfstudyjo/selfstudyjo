<template>
  <div v-if="creating">
    <CsHeader title="Create key pair" />
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Key pair" :level="2"
        description="A key pair, consisting of a private key and a public key, is a set of security credentials that you use to prove your identity when connecting to an instance." /></div>
      <div class="cs-container__body cs-stack">
        <div class="cs-field"><label class="cs-label" for="kp-name">Name</label>
          <input id="kp-name" v-model="name" class="cs-input" :class="{ 'is-invalid': tried && nameError }" placeholder="Enter key pair name" />
          <span v-if="tried && nameError" class="cs-error-text">{{ nameError }}</span>
          <span class="cs-constraint">The name can include up to 255 ASCII characters. It can't include leading or trailing spaces.</span></div>
        <div class="cs-field"><span class="cs-label">Key pair type <a class="cs-link kp__info">Info</a></span>
          <label class="cs-radio"><input v-model="type" type="radio" value="rsa" /> RSA</label>
          <label class="cs-radio"><input v-model="type" type="radio" value="ed25519" /> ED25519</label></div>
        <div class="cs-field"><span class="cs-label">Private key file format</span>
          <label class="cs-radio"><input v-model="format" type="radio" value="pem" /> .pem <small>For use with OpenSSH</small></label>
          <label class="cs-radio"><input v-model="format" type="radio" value="ppk" /> .ppk <small>For use with PuTTY</small></label></div>
      </div>
    </section>
    <section class="cs-container">
      <div class="cs-container__head"><CsHeader title="Tags - optional" :level="2" :info="false" /></div>
      <div class="cs-container__body"><TagEditor v-model="tags" /></div>
    </section>
    <div class="cs-form-actions">
      <button type="button" class="cs-btn cs-btn--link" @click="ctx.to('ec2', 'keys')">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy" @click="create">Create key pair</button>
    </div>
  </div>
  <div v-else>
    <CsTable v-model:selected="selected" title="Key pairs" variant="full-page" :items="keys" :columns="columns"
             track-by="name" selection-type="multi" filter-placeholder="Find Key Pair by attribute or tag"
             empty-title="No key pairs to display">
      <template #actions>
        <button type="button" class="cs-btn cs-btn--icon" aria-label="Refresh" @click="ctx.api.notify('info', 'Key pairs refreshed')"><CsIcon name="refresh" /></button>
        <CsDropdown :items="actions" :disabled="!selected.length" @select="deleting = true" />
        <button type="button" class="cs-btn" disabled>Import key pair</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="ctx.to('ec2', 'key-create')">Create key pair</button>
      </template>
      <template #empty><button type="button" class="cs-btn" @click="ctx.to('ec2', 'key-create')">Create key pair</button></template>
    </CsTable>
    <CsDelete v-if="deleting" :title="`Delete ${selected.length === 1 ? selected[0] : selected.length + ' key pairs'}?`" word="Delete"
              :busy="busy" @close="deleting = false" @confirm="remove">
      <p class="kp__p">Are you sure that you want to delete these key pairs? Instances launched with them keep running, but you lose the key in the console.</p>
      <ul class="kp__ids"><li v-for="name in selected" :key="name">{{ name }}</li></ul>
    </CsDelete>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../CsDelete.vue';
import CsDropdown from '../CsDropdown.vue';
import CsHeader from '../CsHeader.vue';
import CsIcon from '../CsIcon.vue';
import CsTable, { type Column } from '../CsTable.vue';
import TagEditor, { type Tag } from '../TagEditor.vue';
import { awsDate, useAws } from '../ctx';

const ctx = useAws();
const creating = computed(() => ctx.route.value.page === 'key-create');
const keys = computed(() => rows(ctx.view.value, 'ec2.key_pairs'));
const selected = ref<string[]>([]);
const deleting = ref(false);
const busy = ref(false);
const name = ref('');
const type = ref('rsa');
const format = ref('pem');
const tags = ref<Tag[]>([]);
const tried = ref(false);

const columns: Column[] = [
  { id: 'name', header: 'Name', sortKey: 'name' },
  { id: 'type', header: 'Type', sortKey: 'type' },
  { id: 'created', header: 'Created', sortKey: 'created', cell: r => awsDate(r.created) },
  { id: 'fingerprint', header: 'Fingerprint' },
  { id: 'id', header: 'ID', sortKey: 'id' },
];
const actions = [{ id: 'delete', text: 'Delete' }, { id: 'tags', text: 'Manage tags', disabled: true }];

const nameError = computed(() => {
  if (!name.value) return 'Key pair name is required.';
  if (name.value !== name.value.trim()) return 'The name can\'t include leading or trailing spaces.';
  if (name.value.length > 255 || /[^\x20-\x7e]/.test(name.value)) return 'The name can include up to 255 ASCII characters.';
  if (keys.value.some(k => k.name === name.value)) return `Key pair with name '${name.value}' already exists.`;
  return '';
});

async function create() {
  tried.value = true;
  if (nameError.value) return;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'ec2', 'create-key-pair'], { '--key-name': name.value, '--key-type': type.value }),
    `Successfully created key pair ${name.value}. The private key file (${name.value}.${format.value}) was downloaded.`);
  busy.value = false;
  if (result.ok) ctx.to('ec2', 'keys');
}
async function remove() {
  busy.value = true;
  for (const key of selected.value) {
    await ctx.run(cli(['aws', 'ec2', 'delete-key-pair'], { '--key-name': key }));
  }
  ctx.api.notify('success', `Successfully deleted ${selected.value.join(', ')}`);
  busy.value = false;
  deleting.value = false;
  selected.value = [];
}
</script>

<style scoped>
.kp__info { font-size: 12px; font-weight: 700; margin-left: 4px; }
.kp__p { margin: 0 0 8px; }
.kp__ids { margin: 0; padding-left: 18px; }
</style>
