<template>
  <aside class="ns-palette">
    <div class="ns-palette-head">
      <div class="ns-search">
        <DeviceIcon name="search" :size="15" />
        <input
          v-model="query"
          type="text"
          :placeholder="$t('Search 60+ devices…')"
          spellcheck="false"
          @keydown.escape="query = ''"
        />
        <button v-if="query" class="ns-search-clear" :title="$t('Clear')" @click="query = ''">
          <DeviceIcon name="close" :size="13" />
        </button>
      </div>
      <p class="ns-palette-hint">{{ $t('Drag onto the canvas, or click to drop it in the centre.') }}</p>
    </div>

    <div class="ns-palette-body">
      <template v-if="query">
        <div class="ns-palette-group open">
          <div class="ns-group-head static">
            <span class="ns-group-title">{{ $t('{v0} match{v1}', { v0: results.length, v1: results.length === 1 ? '' : 'es' }) }}</span>
          </div>
          <div class="ns-device-list">
            <button
              v-for="t in results"
              :key="t.id"
              class="ns-device-chip"
              draggable="true"
              :title="t.blurb"
              @dragstart="onDragStart($event, t.id)"
              @click="emit('add', t.id)"
            >
              <span class="ns-chip-icon" :style="{ color: t.accent }"><DeviceIcon :name="t.icon" :size="20" /></span>
              <span class="ns-chip-text">
                <span class="ns-chip-name">{{ t.name }}</span>
                <span class="ns-chip-meta">L{{ t.layer }} · {{ t.role }} · {{ t.year }}</span>
              </span>
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="ns-palette-group"
          :class="{ open: openGroups.has(cat.id) }"
        >
          <button class="ns-group-head" @click="toggle(cat.id)">
            <span class="ns-group-icon" :style="{ color: cat.accent }"><DeviceIcon :name="cat.icon" :size="17" /></span>
            <span class="ns-group-title">{{ cat.label }}</span>
            <span class="ns-group-count">{{ byCategory(cat.id).length }}</span>
            <span class="ns-group-chevron"><DeviceIcon name="chevron" :size="14" /></span>
          </button>
          <div v-show="openGroups.has(cat.id)" class="ns-group-content">
            <p class="ns-group-blurb">{{ cat.blurb }}</p>
            <div class="ns-device-list">
              <button
                v-for="t in byCategory(cat.id)"
                :key="t.id"
                class="ns-device-chip"
                draggable="true"
                :title="t.blurb"
                @dragstart="onDragStart($event, t.id)"
                @click="emit('add', t.id)"
              >
                <span class="ns-chip-icon" :style="{ color: t.accent }"><DeviceIcon :name="t.icon" :size="20" /></span>
                <span class="ns-chip-text">
                  <span class="ns-chip-name">{{ t.name }}</span>
                  <span class="ns-chip-meta">L{{ t.layer }} · {{ portSummary(t) }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="ns-palette-foot">
      <button class="ns-btn ghost block" @click="emit('open-templates')">
        <DeviceIcon name="grid" :size="15" /> {{ $t('Template library') }}
      </button>
      <button class="ns-btn ghost block" @click="emit('open-encyclopedia')">
        <DeviceIcon name="book" :size="15" /> {{ $t('Device encyclopedia') }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import DeviceIcon from './DeviceIcon.vue';
import { DEVICE_CATEGORIES, deviceTypesByCategory, searchDeviceTypes } from '@/netsim/devices';
import type { DeviceTypeDef, DeviceCategory } from '@/netsim/types';

const emit = defineEmits<{
    (e: 'add', typeId: string): void;
    (e: 'open-templates'): void;
    (e: 'open-encyclopedia'): void;
}>();

const query = ref('');
const categories = DEVICE_CATEGORIES;
const openGroups = ref<Set<string>>(new Set(['end-device', 'switching', 'routing']));

function toggle(id: string) {
    const s = new Set(openGroups.value);
    s.has(id) ? s.delete(id) : s.add(id);
    openGroups.value = s;
}

function byCategory(id: DeviceCategory): DeviceTypeDef[] {
    return deviceTypesByCategory(id);
}

const results = computed(() => searchDeviceTypes(query.value).slice(0, 40));

function portSummary(t: DeviceTypeDef): string {
    const total = t.ports.reduce((n, p) => n + p.count, 0);
    const fastest = Math.max(...t.ports.map(p => p.speedMbps));
    const speed = fastest >= 100000 ? `${fastest / 1000}G` : fastest >= 1000 ? `${fastest / 1000}G` : `${fastest}M`;
    return `${total} port${total === 1 ? '' : 's'} · ${speed}`;
}

function onDragStart(ev: DragEvent, typeId: string) {
    ev.dataTransfer?.setData('application/x-netsim-device', typeId);
    ev.dataTransfer?.setData('text/plain', typeId);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
}
</script>
