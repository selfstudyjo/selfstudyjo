<template>
  <aside class="dh-side" aria-label="About this dataset">
    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>About</h3><span class="dh-spacer" />
        <button type="button" class="dh-side__edit" title="Edit description" aria-label="Edit description"
                @click="$emit('edit', { mode: 'docs', initial: entity.description })"><DhIcon name="pencil" :size="14" /></button>
      </div>
      <p v-if="entity.description" class="dh-side__desc">{{ entity.description }}</p>
      <button v-else type="button" class="dh-add" @click="$emit('edit', { mode: 'docs', initial: '' })"><DhIcon name="plus" :size="12" /> Add Description</button>
    </section>

    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>Owners</h3></div>
      <div class="dh-side__list">
        <div v-for="o in entity.owners" :key="o.owner" class="dh-owner">
          <span class="dh-owner__av" :style="{ background: avatarColor(o.owner) }">{{ o.owner.charAt(0).toUpperCase() }}</span>
          <span class="dh-owner__text"><b>{{ o.owner }}</b><small>{{ ownerTypeLabel(o.type) }}</small></span>
          <button type="button" class="dh-tag__x" :aria-label="'Remove owner ' + o.owner" title="Remove owner"
                  @click="removeOwner(dh, entity.urn, o.owner)"><DhIcon name="close" :size="12" /></button>
        </div>
        <span v-if="!entity.owners.length" class="dh-muted dh-small">No owners yet.</span>
      </div>
      <button type="button" class="dh-add" @click="$emit('edit', { mode: 'owner' })"><DhIcon name="plus" :size="12" /> Add Owners</button>
    </section>

    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>Tags</h3></div>
      <div class="dh-side__chips">
        <span v-for="t in entity.tags" :key="t" class="dh-tag">
          <span class="dh-tag__dot" :style="{ background: tagColor(t) }" /><span class="dh-tag__text">{{ t }}</span>
          <button type="button" class="dh-tag__x" :aria-label="'Remove tag ' + t" @click="removeTag(dh, entity.urn, t)"><DhIcon name="close" :size="10" /></button>
        </span>
        <button type="button" class="dh-add" @click="$emit('edit', { mode: 'tag' })"><DhIcon name="plus" :size="12" /> Add Tags</button>
      </div>
    </section>

    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>Glossary Terms</h3></div>
      <div class="dh-side__chips">
        <span v-for="t in entity.terms" :key="t" class="dh-tag dh-term">
          <DhIcon name="book" :size="12" /><button type="button" class="dh-tag__text dh-termlink" @click="dh.go({ page: 'glossary', name: t })">{{ t }}</button>
          <button type="button" class="dh-tag__x" :aria-label="'Remove term ' + t" @click="removeTerm(dh, entity.urn, t)"><DhIcon name="close" :size="10" /></button>
        </span>
        <button type="button" class="dh-add" @click="$emit('edit', { mode: 'term' })"><DhIcon name="plus" :size="12" /> Add Terms</button>
      </div>
    </section>

    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>Domain</h3></div>
      <div class="dh-side__chips">
        <button v-if="entity.domain" type="button" class="dh-tag dh-domain" @click="dh.go({ page: 'domains', name: entity.domain })">
          <DhIcon name="domain" :size="12" /><span class="dh-tag__text">{{ entity.domain }}</span>
        </button>
        <button v-if="entity.domain" type="button" class="dh-tag__x dh-domain-x" :aria-label="'Remove domain ' + entity.domain"
                @click="unsetDomain(dh, entity.urn, entity.domain)"><DhIcon name="close" :size="10" /></button>
        <button type="button" class="dh-add" @click="$emit('edit', { mode: 'domain', initial: entity.domain })">
          <DhIcon :name="entity.domain ? 'pencil' : 'plus'" :size="12" /> {{ entity.domain ? 'Change Domain' : 'Set Domain' }}
        </button>
      </div>
    </section>

    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>Data Contract</h3></div>
      <div v-if="entity.contract" class="dh-side__line">
        <DhIcon name="contract" /><button type="button" class="dh-link" @click="tab('Contract')">{{ entity.contract.name }} v{{ entity.contract.version }}</button>
      </div>
      <button v-else type="button" class="dh-add" @click="tab('Contract')"><DhIcon name="plus" :size="12" /> Publish a contract</button>
    </section>

    <section class="dh-side__sec">
      <div class="dh-side__head"><h3>Health</h3></div>
      <div class="dh-side__line">
        <DhIcon :name="entity.assertions ? (entity.assertions.status === 'passing' ? 'check-circle' : 'x-circle') : 'quality'"
                :class="entity.assertions ? (entity.assertions.status === 'passing' ? 'is-ok' : 'is-bad') : ''" />
        <button type="button" class="dh-link" @click="tab('Quality')">
          {{ entity.assertions ? (entity.assertions.status === 'passing' ? 'All assertions passing' : entity.assertions.failed + ' assertion(s) failing') : 'No assertions run yet' }}
        </button>
      </div>
      <div class="dh-side__line">
        <DhIcon name="incident" :class="openCount ? 'is-bad' : ''" />
        <button type="button" class="dh-link" @click="tab('Incidents')">{{ openCount }} active incident{{ openCount === 1 ? '' : 's' }}</button>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DhIcon from './DhIcon.vue';
import { ownerTypeLabel, sameDataset, tagColor, useDh, type DhDataset } from './dhContext';
import { removeOwner, removeTag, removeTerm, unsetDomain } from './edits';

const props = defineProps<{ entity: DhDataset }>();
defineEmits<{ (event: 'edit', value: { mode: 'tag' | 'term' | 'owner' | 'domain' | 'docs'; initial?: string }): void }>();
const dh = useDh();

const openCount = computed(() => dh.incidents.value.filter(i => i.status !== 'resolved' && sameDataset(i.dataset, props.entity.urn)).length);

function tab(name: string) {
  dh.route.value = { ...dh.route.value, tab: name };
}

function avatarColor(name: string) {
  const palette = ['#1677ff', '#722ed1', '#13a8a8', '#d46b08', '#389e0d', '#c41d7f'];
  let h = 0;
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length] as string;
}
</script>

<style scoped src="./dh.css"></style>
<style scoped>
.dh-side { flex: none; width: 340px; box-sizing: border-box; background: #fff; border-left: 1px solid var(--dh-border); padding: 8px 20px 24px; }
.dh-side__sec { padding: 14px 0; border-bottom: 1px solid var(--dh-border); display: flex; flex-direction: column; gap: 8px; }
.dh-side__sec:last-child { border-bottom: 0; }
.dh-side__head { display: flex; align-items: center; }
.dh-side__head h3 { margin: 0; font-size: 14px; font-weight: 700; }
.dh-side__edit { border: 0; background: none; color: #595959; cursor: pointer; padding: 4px; border-radius: 4px; }
.dh-side__edit:hover { background: var(--dh-hover); color: var(--dh-primary); }
.dh-side__desc { margin: 0; color: var(--dh-text); overflow-wrap: anywhere; white-space: pre-wrap; }
.dh-side__list { display: flex; flex-direction: column; gap: 6px; }
.dh-side__chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dh-side__chips .dh-add { align-self: flex-start; }
.dh-side__sec > .dh-add { align-self: flex-start; }
.dh-owner { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dh-owner .dh-tag__x { width: 24px; height: 24px; }
.dh-owner__av { width: 26px; height: 26px; border-radius: 50%; color: #fff; display: grid; place-items: center; font-size: 12px; font-weight: 700; flex: none; }
.dh-owner__text { display: flex; flex-direction: column; flex: 1; min-width: 0; line-height: 18px; }
.dh-owner__text b { font-weight: 600; overflow-wrap: anywhere; }
.dh-owner__text small { color: var(--dh-text-2); font-size: 12px; }
.dh-small { font-size: 13px; }
.dh-termlink { border: 0; background: none; padding: 0; font: inherit; font-size: 12px; color: var(--dh-text); cursor: pointer; }
.dh-termlink:hover { text-decoration: underline; }
.dh-domain { cursor: pointer; font: inherit; font-size: 12px; }
.dh-domain:hover { border-color: var(--dh-primary); }
.dh-domain-x { border: 0; background: none; color: var(--dh-text-2); cursor: pointer; padding: 2px; margin-left: -6px; }
.dh-domain-x:hover { color: var(--dh-danger); }
.dh-side__line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dh-side__line > .dh-ico { color: var(--dh-text-2); }
.dh-side__line > .dh-ico.is-ok { color: #52c41a; }
.dh-side__line > .dh-ico.is-bad { color: #ff4d4f; }
@container sl-portal (max-width: 1000px) {
  .dh-side { width: auto; border-left: 0; border-top: 1px solid var(--dh-border); }
}
</style>
