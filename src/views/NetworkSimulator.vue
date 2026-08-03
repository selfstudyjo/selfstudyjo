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
    <div v-if="isAdmin && storage.settled && (storage.mode === 'local' || storage.lastError)" class="ns-banner" :class="{ warn: storage.mode === 'local', err: !!storage.lastError }">
      <DeviceIcon name="alert" :size="16" />
      <div>
        <strong v-if="storage.mode === 'local'">Projects are saving to this browser only</strong>
        <strong v-else>The data repository is not reachable</strong>
        <p v-if="storage.mode === 'local'">
          Everything works — your networks, lessons and progress are all kept in this browser. Cross-device sync needs the
          <code>/api/netsim/*</code> storage endpoints deployed on the Self Study AI backend; the frontend finds them through
          the registry automatically. Until then, you can sync just this device from Storage settings.
        </p>
        <p v-else>{{ storage.lastError }} — your work is still safe in this browser and will sync on the next successful save.</p>
      </div>
      <button class="ns-btn ghost sm" @click="showStorage = true">Connect storage</button>
    </div>

    <div v-else-if="isAdmin && storage.settled && storage.mode !== 'local'" class="ns-banner ok">
      <DeviceIcon name="check" :size="16" />
      <div>
        <strong>Syncing to {{ storage.repo }}</strong>
        <p>
          {{ storage.mode === 'proxy' ? `Through the backend proxy at ${storage.proxy}.` : 'Using the token stored on this device.' }}
          {{ storage.lastSyncAt ? `Last sync ${relTime(storage.lastSyncAt)}.` : '' }}
        </p>
      </div>
      <button class="ns-btn ghost sm" @click="showStorage = true">Storage settings</button>
    </div>
    <p v-if="isAdmin && storageTestMessage" class="ns-banner-note">{{ storageTestMessage }}</p>

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

    <!-- ════════════ storage settings modal ════════════ -->
    <div v-if="showStorage && isAdmin" class="ns-modal-backdrop" @click.self="showStorage = false">
      <div class="ns-modal">
        <header>
          <h3>Storage settings</h3>
          <button class="ns-icon-btn" @click="showStorage = false"><DeviceIcon name="close" :size="16" /></button>
        </header>

        <div class="ns-info-rows">
          <div><span>Mode</span><strong>{{ storageModeLabel }}</strong></div>
          <div><span>Repository</span><strong>{{ storage.repo }} ({{ storage.branch }})</strong></div>
          <div v-if="storage.proxy"><span>Proxy</span><strong>{{ storage.proxy }}</strong></div>
          <div><span>Last sync</span><strong>{{ storage.lastSyncAt ? relTime(storage.lastSyncAt) : 'never' }}</strong></div>
        </div>

        <div class="ns-btn-row tight">
          <button class="ns-btn ghost sm" @click="testStorage">{{ testing ? 'Testing…' : 'Test connection' }}</button>
        </div>
        <p v-if="storageTestMessage" class="ns-note-block">{{ storageTestMessage }}</p>

        <template v-if="storage.mode !== 'proxy'">
          <div class="ns-sub-block">
            <h5>Connect this device with a GitHub token</h5>
            <p class="ns-muted sm">
              The token is stored in this browser only. It is never part of the deployed site, so it cannot leak to
              visitors — but it also only works on this device. For real multi-user sync, point
              <code>VITE_NETSIM_STORAGE_PROXY</code> at a backend that holds the token server-side.
            </p>
            <label class="ns-field block">Fine-grained personal access token
              <input
                v-model="tokenInput"
                type="password"
                spellcheck="false"
                autocomplete="off"
                :placeholder="storage.mode === 'token' ? `currently loaded: ${tokenHint}` : 'github_pat_… (Contents: Read and write on that repo only)'"
                @keydown.enter="saveToken"
              />
            </label>
            <div class="ns-btn-row tight">
              <button class="ns-btn primary sm" :disabled="!tokenInput.trim()" @click="saveToken">Save and test</button>
              <button v-if="storage.mode === 'token'" class="ns-btn danger sm" @click="forgetToken">Forget token</button>
            </div>
          </div>
        </template>

        <div class="ns-note-block">
          <strong>Why there is no build-time token:</strong> anything in a <code>VITE_*</code> variable is compiled into the
          published JavaScript. GitHub's push protection blocks a deploy that contains one, which is the right outcome —
          a write-capable token in a public bundle can be extracted by anyone who loads the page.
        </div>
      </div>
    </div>

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
import { useAuthStore } from '@/store/auth';
import { netsimService } from '@/services/netsim.service';
import { netsimStorage } from '@/services/netsim-storage.service';
import { TOPOLOGY_TEMPLATES } from '@/netsim/topology';
import { DEVICE_TYPES } from '@/netsim/devices';
import { TOTAL_LESSONS, BADGES } from '@/netsim/lessons';
import { OSI_LAYERS } from '@/netsim/types';

const store = useNetSimStore();
const router = useRouter();
const authStore = useAuthStore();

/**
 * Storage is infrastructure, not something a student can act on. Their work is
 * saved either way, so only an operator sees where it goes.
 */
const isAdmin = computed(() => authStore.isAdmin);

const search = ref('');
const showNew = ref(false);
const newName = ref('');
const newDesc = ref('');
const newTemplate = ref('');
const testing = ref(false);
const storageTestMessage = ref('');
const showStorage = ref(false);
const tokenInput = ref('');
const storageVersion = ref(0);

// storageVersion is bumped after any storage change so this recomputes.
const storage = computed(() => { void storageVersion.value; return store.storageStatus; });
const tokenHint = computed(() => { void storageVersion.value; return netsimStorage.tokenHint(); });

const storageModeLabel = computed(() => {
    switch (storage.value.mode) {
        case 'proxy': return 'Backend proxy (recommended — token stays server-side)';
        case 'token': return 'Token stored on this device';
        default: return 'This browser only (no sync)';
    }
});
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
    // The banner should reflect the mode discovery actually settled on.
    storageVersion.value++;
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
        storageVersion.value++;
    }
}

async function saveToken() {
    const t = tokenInput.value.trim();
    if (!t) return;
    netsimStorage.setToken(t);
    tokenInput.value = '';
    storageVersion.value++;
    await testStorage();
    if (storage.value.online) {
        store.toast('success', 'Storage connected', 'Your projects will sync to the data repository from this device.');
        await store.loadProjects();
        await store.loadSharedProjects();
    }
}

function forgetToken() {
    netsimStorage.clearToken();
    storageVersion.value++;
    storageTestMessage.value = 'Token removed from this device. Projects now stay in this browser only.';
    store.toast('info', 'Token forgotten');
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
