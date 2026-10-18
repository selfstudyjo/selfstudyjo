<template>
  <CsTable v-if="page === 'zones'" variant="full-page" title="Hosted zones" :items="zones" :columns="zoneCols" track-by="id" filter-placeholder="Filter hosted zones by property or value" empty-title="No hosted zones">
    <template #cell-name="{ row }"><a href="#" class="cs-link" @click.prevent="ctx.to('route53', 'zone', { id: row.id })">{{ row.name }}</a></template>
  </CsTable>

  <div v-else-if="page === 'zone' && zone">
    <CsHeader :title="zone.name" :description="`${zone.private ? 'Private' : 'Public'} hosted zone ${zone.id}`" />
    <CsTable title="Records" :items="records" :columns="recCols" track-by="key" selection-type="single" v-model:selected="sel" filter-placeholder="Filter records by property or value">
      <template #actions>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="deleting = selected">Delete record</button>
        <button type="button" class="cs-btn" :disabled="!sel.length" @click="openForm(selected)">Edit record</button>
        <button type="button" class="cs-btn cs-btn--primary" @click="openForm(null)">Create record</button>
      </template>
    </CsTable>
    <section v-if="zone.private" class="cs-container r53__space">
      <div class="cs-container__head"><CsHeader title="VPCs to associate with the hosted zone" :level="2" :info="false">
        <template #actions><select v-model="vpc" class="cs-select r53__vpc"><option value="">Choose a VPC</option><option v-for="v in otherVpcs" :key="v.id" :value="v.id">{{ v.id }} ({{ v.name }})</option></select>
          <button type="button" class="cs-btn" :disabled="!vpc || busy" @click="associate">Associate VPC</button></template></CsHeader></div>
      <div class="cs-container__body"><ul class="r53__list"><li v-for="v in zone.vpcs" :key="v" class="cs-mono">{{ v }} - {{ ctx.home.value }}</li></ul></div>
    </section>
  </div>

  <CsModal v-if="form" :title="form.existing ? 'Edit record' : 'Create record'" @close="form = null">
    <div class="cs-stack">
      <div class="cs-field"><label class="cs-label">Record name</label>
        <div class="cs-row"><input v-model="form.sub" class="cs-input" :disabled="form.existing" placeholder="subdomain" /><span>.{{ zone.name }}</span></div></div>
      <div class="cs-field"><label class="cs-label">Record type</label><select v-model="form.type" class="cs-select" :disabled="form.existing"><option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option></select></div>
      <div class="cs-field"><label class="cs-label">Value</label><input v-model="form.value" class="cs-input cs-mono" placeholder="10.20.0.10" /></div>
      <div class="cs-field"><label class="cs-label">TTL (seconds)</label><input v-model="form.ttl" class="cs-input" inputmode="numeric" /></div>
    </div>
    <template #footer>
      <button type="button" class="cs-btn cs-btn--link" @click="form = null">Cancel</button>
      <button type="button" class="cs-btn cs-btn--primary" :disabled="busy || !form.value.trim()" @click="save">{{ form.existing ? 'Save' : 'Create records' }}</button>
    </template>
  </CsModal>

  <CsDelete v-if="deleting" title="Delete record" :busy="busy" @close="deleting = null" @confirm="remove">
    <p class="r53__p">Delete <span class="cs-mono">{{ deleting.name }}</span> ({{ deleting.type }})? Anything resolving it gets NXDOMAIN.</p>
  </CsDelete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { cli, rows } from '@/utils/portalKit';
import CsDelete from '../../aws/CsDelete.vue';
import CsHeader from '../../aws/CsHeader.vue';
import CsModal from '../../aws/CsModal.vue';
import CsTable from '../../aws/CsTable.vue';
import { useOps } from '../ctx';

const TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX'];
const ctx = useOps();
const page = computed(() => ctx.route.value.page);
const sel = ref<string[]>([]);
const busy = ref(false);
const vpc = ref('');
const form = ref<any>(null);
const deleting = ref<any>(null);
const zones = computed(() => rows<any>(ctx.c.value, 'net.zones').map(z => ({ ...z, kind: z.private ? 'Private' : 'Public', count: z.records.length })));
const zone = computed<any>(() => zones.value.find(z => z.id === ctx.route.value.params?.id) || null);
const records = computed(() => (zone.value?.records || []).map((r: any) => ({ ...r, key: `${r.name}|${r.type}` })));
const selected = computed<any>(() => records.value.find((r: any) => r.key === sel.value[0]) || null);
const otherVpcs = computed(() => rows<any>(ctx.c.value, 'net.vpcs').filter(v => !zone.value?.vpcs.includes(v.id)));
const zoneCols = [{ id: 'name', header: 'Hosted zone name', sortKey: 'name' }, { id: 'kind', header: 'Type' }, { id: 'count', header: 'Record count' }, { id: 'id', header: 'Hosted zone ID' }];
const recCols = [{ id: 'name', header: 'Record name', sortKey: 'name' }, { id: 'type', header: 'Type' }, { id: 'policy', header: 'Routing policy', cell: () => 'Simple' },
  { id: 'value', header: 'Value/Route traffic to' }, { id: 'ttl', header: 'TTL (seconds)', cell: () => '300' }];

function openForm(row: any) {
  form.value = row ? { existing: true, sub: row.name.slice(0, -zone.value.name.length - 1), type: row.type, value: row.value, ttl: '300' }
    : { existing: false, sub: '', type: 'A', value: '', ttl: '300' };
}
function batch(action: string, name: string, type: string, value: string, ttl: string) {
  return JSON.stringify({ Changes: [{ Action: action, ResourceRecordSet: { Name: name, Type: type, TTL: Number(ttl) || 300, ResourceRecords: [{ Value: value }] } }] });
}
async function save() {
  const f = form.value;
  const name = f.sub.trim() ? `${f.sub.trim()}.${zone.value.name}` : zone.value.name;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'route53', 'change-resource-record-sets'], { '--hosted-zone-id': zone.value.id,
    '--change-batch': batch(f.existing ? 'UPSERT' : 'CREATE', name, f.type, f.value.trim(), f.ttl) }), `Record for ${name} was successfully ${f.existing ? 'updated' : 'created'}.`);
  busy.value = false;
  if (result.ok) form.value = null;
}
async function remove() {
  const r = deleting.value;
  busy.value = true;
  const result = await ctx.run(cli(['aws', 'route53', 'change-resource-record-sets'], { '--hosted-zone-id': zone.value.id,
    '--change-batch': batch('DELETE', r.name, r.type, r.value, '300') }), `Record ${r.name} deleted.`);
  busy.value = false;
  deleting.value = null;
  if (result.ok) sel.value = [];
}
async function associate() {
  busy.value = true;
  await ctx.run(cli(['aws', 'route53', 'associate-vpc-with-hosted-zone'], { '--hosted-zone-id': zone.value.id, '--vpc': `VPCRegion=${ctx.home.value},VPCId=${vpc.value}` }), `VPC ${vpc.value} associated.`);
  busy.value = false;
  vpc.value = '';
}
</script>

<style scoped>
.r53__space { margin-top: 20px; }
.r53__vpc { width: 280px; max-width: 100%; }
.r53__list { margin: 0; padding-left: 18px; }
.r53__p { margin: 0; }
</style>
