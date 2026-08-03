<template>
  <div class="netsim-hub">
    <!-- ════════════ hero ════════════ -->
    <header class="ns-hero">
      <div class="ns-hero-text">
        <span class="ns-hero-eyebrow">
          <DeviceIcon name="layers" :size="14" /> Lab feature · Network Simulator
        </span>
        <h1>Build a network. Run it. Watch every layer.</h1>
        <p>
          Drag real devices onto the canvas, cable them, configure them with real CLI syntax, then send a packet and
          follow it hop by hop — MAC rewrites, VLAN tags, TTL, NAT, ACLs and all seven layers of encapsulation.
          The AI tutor sees the same network you do.
        </p>
        <div class="ns-hero-actions">
          <button class="ns-btn primary lg" @click="startBlank">
            <DeviceIcon name="plus" :size="17" /> New network
          </button>
          <router-link class="ns-btn ghost lg" to="/network-simulator/learn">
            <DeviceIcon name="book" :size="17" /> Learn by doing
          </router-link>
          <button class="ns-btn ghost lg" @click="scrollTo('templates')">
            <DeviceIcon name="grid" :size="17" /> Templates
          </button>
        </div>
      </div>

      <div class="ns-hero-stats">
        <div class="ns-hero-stat"><strong>{{ DEVICE_TYPES.length }}</strong><span>device types</span></div>
        <div class="ns-hero-stat"><strong>{{ TOTAL_LESSONS }}</strong><span>lessons</span></div>
        <div class="ns-hero-stat"><strong>7</strong><span>OSI layers simulated</span></div>
        <div class="ns-hero-stat"><strong>{{ TOPOLOGY_TEMPLATES.length }}</strong><span>templates</span></div>
      </div>
    </header>

    <!-- ════════════ storage banner ════════════ -->
    <div v-if="!storage.configured || storage.lastError" class="ns-banner" :class="{ warn: !storage.configured, err: !!storage.lastError }">
      <DeviceIcon name="alert" :size="16" />
      <div>
        <strong v-if="!storage.configured">Projects are saving to this browser only</strong>
        <strong v-else>The data repository is not reachable</strong>
        <p v-if="!storage.configured">
          Add <code>VITE_NETSIM_GITHUB_TOKEN</code> to <code>selfstudyjo/.env</code> to sync your projects to
          <code>{{ storage.repo }}</code>. Everything works without it — your work simply stays on this device.
        </p>
        <p v-else>{{ storage.lastError }} — your work is still safe in this browser and will sync on the next successful save.</p>
      </div>
      <button class="ns-btn ghost sm" @click="testStorage">{{ testing ? 'Testing…' : 'Test connection' }}</button>
    </div>
    <p v-if="storageTestMessage" class="ns-banner-note">{{ storageTestMessage }}</p>

    <!-- ════════════ progress ════════════ -->
    <section v-if="progress" class="ns-section">
      <div class="ns-section-head">
        <h2>Your progress</h2>
        <router-link class="ns-link" to="/network-simulator/learn">Open the curriculum →</router-link>
      </div>
      <div class="ns-progress-row">
        <div class="ns-progress-card">
          <div class="ns-ring" :style="{ '--pct': completionPct }">
            <span>{{ completionPct }}%</span>
          </div>
          <div>
            <strong>{{ progress.completedLessons.length }} / {{ TOTAL_LESSONS }} lessons</strong>
            <p>{{ progress.xp }} XP · {{ progress.badges.length }} badge{{ progress.badges.length === 1 ? '' : 's' }}</p>
          </div>
        </div>
        <div class="ns-badge-strip">
          <span
            v-for="b in BADGES" :key="b.id"
            class="ns-badge-chip" :class="{ earned: progress.badges.includes(b.id) }"
            :title="b.description"
          >
            <DeviceIcon :name="b.icon" :size="14" /> {{ b.title }}
          </span>
        </div>
      </div>
    </section>

    <!-- ════════════ my projects ════════════ -->
    <section class="ns-section">
      <div class="ns-section-head">
        <h2>My networks <span class="ns-count">{{ store.projects.length }}</span></h2>
        <div class="ns-section-actions">
          <div class="ns-search inline">
            <DeviceIcon name="search" :size="14" />
            <input v-model="search" placeholder="Search my networks…" spellcheck="false" />
          </div>
          <button class="ns-btn primary sm" @click="showNew = true"><DeviceIcon name="plus" :size="14" /> New</button>
        </div>
      </div>

      <div v-if="store.loading" class="ns-loading"><span class="ns-spinner"></span> Loading your projects…</div>

      <div v-else-if="!filteredProjects.length" class="ns-empty-card">
        <DeviceIcon name="folder" :size="34" />
        <h3>{{ search ? 'No matches' : 'No networks yet' }}</h3>
        <p v-if="!search">Start from a blank canvas, load a template, or let the AI generate one for you.</p>
        <div class="ns-btn-row">
          <button class="ns-btn primary sm" @click="startBlank">Blank canvas</button>
          <button class="ns-btn ghost sm" @click="scrollTo('templates')">Browse templates</button>
        </div>
      </div>

      <div v-else class="ns-project-grid">
        <article v-for="p in filteredProjects" :key="p.id" class="ns-project-card">
          <header @click="open(p.id)">
            <h3>{{ p.name }}</h3>
            <span class="ns-diff" :class="p.difficulty">{{ p.difficulty }}</span>
          </header>
          <p class="ns-project-desc" @click="open(p.id)">{{ p.description || 'No description.' }}</p>
          <div class="ns-project-meta">
            <span><DeviceIcon name="layers" :size="12" /> {{ p.deviceCount }} devices</span>
            <span><DeviceIcon name="cable" :size="12" /> {{ p.linkCount }} links</span>
            <span v-if="p.shared" class="shared"><DeviceIcon name="share" :size="12" /> shared</span>
          </div>
          <footer>
            <span class="ns-muted sm">{{ relTime(p.updatedAt) }}</span>
            <div class="ns-card-actions">
              <button class="ns-icon-btn" title="Open" @click="open(p.id)"><DeviceIcon name="play" :size="13" /></button>
              <button class="ns-icon-btn" title="Duplicate" @click="store.duplicateProject(p.id)"><DeviceIcon name="copy" :size="13" /></button>
              <button class="ns-icon-btn danger" title="Delete" @click="confirmDelete(p.id, p.name)"><DeviceIcon name="trash" :size="13" /></button>
            </div>
          </footer>
        </article>
      </div>
    </section>

    <!-- ════════════ templates ════════════ -->
    <section id="templates" class="ns-section">
      <div class="ns-section-head">
        <h2>Start from a working network</h2>
        <p class="ns-section-sub">Every template is correct and runnable. Load one, run it, then break it deliberately.</p>
      </div>
      <div class="ns-template-grid">
        <button v-for="t in TOPOLOGY_TEMPLATES" :key="t.id" class="ns-template-card" @click="startFromTemplate(t.id)">
          <span class="ns-template-icon"><DeviceIcon :name="t.icon" :size="24" /></span>
          <strong>{{ t.name }}</strong>
          <p>{{ t.description }}</p>
          <span class="ns-template-tags">
            <em class="ns-diff" :class="t.difficulty">{{ t.difficulty }}</em>
            <em v-for="tag in t.tags.slice(0, 3)" :key="tag">{{ tag }}</em>
          </span>
        </button>
      </div>
    </section>

    <!-- ════════════ community ════════════ -->
    <section class="ns-section">
      <div class="ns-section-head">
        <h2>Community networks <span class="ns-count">{{ store.sharedProjects.length }}</span></h2>
        <button class="ns-btn ghost sm" @click="store.loadSharedProjects()">Refresh</button>
      </div>
      <div v-if="!store.sharedProjects.length" class="ns-empty-card small">
        <p>Nothing shared yet. Open one of your networks and press <strong>Share</strong> to publish it for other students.</p>
      </div>
      <div v-else class="ns-project-grid">
        <article v-for="p in store.sharedProjects" :key="p.id" class="ns-project-card shared">
          <header><h3>{{ p.name }}</h3><span class="ns-diff" :class="p.difficulty">{{ p.difficulty }}</span></header>
          <p class="ns-project-desc">{{ p.description || 'No description.' }}</p>
          <div class="ns-project-meta">
            <span>by {{ p.owner }}</span>
            <span>{{ p.deviceCount }} devices</span>
          </div>
          <footer>
            <span class="ns-muted sm">{{ relTime(p.updatedAt) }}</span>
            <button class="ns-btn ghost sm" @click="store.cloneShared(p.id)">Copy to my networks</button>
          </footer>
        </article>
      </div>
    </section>

    <!-- ════════════ what it simulates ════════════ -->
    <section class="ns-section">
      <div class="ns-section-head"><h2>What this simulator actually models</h2></div>
      <div class="ns-feature-grid">
        <div v-for="l in OSI_LAYERS" :key="l.id" class="ns-layer-card" :style="{ '--layer-color': l.color }">
          <span class="ns-layer-num">L{{ l.id }}</span>
          <strong>{{ l.name }}</strong>
          <p>{{ l.blurb }}</p>
          <div class="ns-layer-examples"><em v-for="e in l.examples" :key="e">{{ e }}</em></div>
        </div>
      </div>
    </section>

    <!-- ════════════ new project modal ════════════ -->
    <div v-if="showNew" class="ns-modal-backdrop" @click.self="showNew = false">
      <div class="ns-modal">
        <header>
          <h3>New network</h3>
          <button class="ns-icon-btn" @click="showNew = false"><DeviceIcon name="close" :size="16" /></button>
        </header>
        <label class="ns-field block">Name
          <input v-model="newName" placeholder="Branch office network" @keydown.enter="createProject" />
        </label>
        <label class="ns-field block">Description (optional)
          <textarea v-model="newDesc" rows="2" placeholder="What are you building, and why?"></textarea>
        </label>
        <label class="ns-field block">Start from
          <select v-model="newTemplate">
            <option value="">Blank canvas</option>
            <option v-for="t in TOPOLOGY_TEMPLATES" :key="t.id" :value="t.id">{{ t.name }} ({{ t.difficulty }})</option>
          </select>
        </label>
        <div class="ns-btn-row">
          <button class="ns-btn primary" :disabled="!newName.trim() || store.loading" @click="createProject">Create and open</button>
          <button class="ns-btn ghost" @click="showNew = false">Cancel</button>
        </div>
      </div>
    </div>

    <div class="ns-toasts">
      <div v-for="t in store.toasts" :key="t.id" class="ns-toast" :class="t.kind" @click="store.dismissToast(t.id)">
        <DeviceIcon :name="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'" :size="15" />
        <div><strong>{{ t.title }}</strong><p v-if="t.message">{{ t.message }}</p></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import DeviceIcon from '@/components/netsim/DeviceIcon.vue';
import { useNetSimStore } from '@/store/netsim';
import { netsimService } from '@/services/netsim.service';
import { TOPOLOGY_TEMPLATES } from '@/netsim/topology';
import { DEVICE_TYPES } from '@/netsim/devices';
import { TOTAL_LESSONS, BADGES } from '@/netsim/lessons';
import { OSI_LAYERS } from '@/netsim/types';

const store = useNetSimStore();
const router = useRouter();

const search = ref('');
const showNew = ref(false);
const newName = ref('');
const newDesc = ref('');
const newTemplate = ref('');
const testing = ref(false);
const storageTestMessage = ref('');

const storage = computed(() => store.storageStatus);
const progress = computed(() => store.progress);

const completionPct = computed(() => {
    if (!progress.value) return 0;
    return Math.round((progress.value.completedLessons.length / Math.max(1, TOTAL_LESSONS)) * 100);
});

const filteredProjects = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return store.projects;
    return store.projects.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)));
});

onMounted(async () => {
    await store.loadProfileAndProgress();
    await store.loadProjects();
    await store.loadSharedProjects();
});

function open(id: string) {
    router.push(`/network-simulator/studio/${id}`);
}

function startBlank() {
    newName.value = 'Untitled network';
    newTemplate.value = '';
    showNew.value = true;
}

function startFromTemplate(id: string) {
    const t = TOPOLOGY_TEMPLATES.find(x => x.id === id);
    newName.value = t?.name || 'New network';
    newDesc.value = t?.description || '';
    newTemplate.value = id;
    showNew.value = true;
}

async function createProject() {
    if (!newName.value.trim()) return;
    const p = await store.newProject(newName.value.trim(), newDesc.value.trim(), newTemplate.value || undefined);
    showNew.value = false;
    newName.value = '';
    newDesc.value = '';
    newTemplate.value = '';
    if (p) router.push(`/network-simulator/studio/${p.id}`);
}

function confirmDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This removes the JSON file from the data repository and cannot be undone.`)) {
        void store.deleteProject(id);
    }
}

async function testStorage() {
    testing.value = true;
    storageTestMessage.value = '';
    try {
        const res = await netsimService.testStorage();
        storageTestMessage.value = res.message;
    } catch (err: any) {
        storageTestMessage.value = err?.message || 'The connection test could not run.';
    } finally {
        testing.value = false;
    }
}

function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} d ago`;
    return new Date(iso).toLocaleDateString();
}
</script>

<style src="@/assets/css/netsim.css"></style>
