<template>
  <div class="roblox-tool">
    <!-- ═══ Header ═══ -->
    <div class="roblox-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z"/></svg>
          </div>
          <div>
            <h1>Roblox Animation Studio</h1>
            <p class="header-subtitle">Create, preview & export Lua animation scripts for Roblox</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="tool-tabs-header">
            <button :class="['tool-tab-btn', { active: activeTool === 'animations' }]" @click="switchTool('animations')">🎬 Animations</button>
            <button :class="['tool-tab-btn', { active: activeTool === 'design' }]" @click="switchTool('design')">🎨 Part Designer</button>
          </div>
          <template v-if="activeTool === 'animations'">
            <button class="btn-secondary" @click="showCustomRequest = true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Custom Animation
            </button>
            <button v-if="isAdmin" class="btn-secondary admin-btn" @click="showAdminCreate = true">⚙️ Add Animation</button>
            <select v-model="selectedCharacter" class="character-select" @change="updateCharacter">
              <option v-for="char in characters" :key="char.id" :value="char.id">{{ char.name }}</option>
            </select>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ ANIMATIONS TAB ═══ -->
    <div v-show="activeTool === 'animations'" class="roblox-content">
      <div class="animations-panel">
        <div class="panel-header">
          <h2>Animations <span class="count">({{ filteredAnimations.length }})</span></h2>
          <div v-if="loadingAnimations" class="loading-bar">Loading animations...</div>
          <div class="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input v-model="searchQuery" type="text" placeholder="Search animations..." class="search-input" />
          </div>
          <div class="filter-tags">
            <button v-for="cat in dynamicCategories" :key="cat" :class="['filter-tag', { active: selectedCategory === cat }]" @click="selectedCategory = selectedCategory === cat ? '' : cat">{{ cat }}</button>
          </div>
        </div>
        <div class="animations-grid">
          <div v-for="anim in filteredAnimations" :key="anim.id" :class="['animation-card', { selected: currentAnim?.id === anim.id }]" @click="selectAnimation(anim)">
            <div class="card-preview" :style="{ background: anim.color || '#333' }"><span class="card-icon">{{ anim.icon || '🎬' }}</span></div>
            <div class="card-info">
              <h4>{{ anim.name }}</h4>
              <span class="card-category">{{ anim.category }}</span>
              <span v-if="anim.created_by !== 'system'" class="card-badge">Custom</span>
              <button v-if="isAdmin && anim.created_by !== 'system'" class="card-delete" @click.stop="deleteAnimationAdmin(anim.id)" title="Delete">✕</button>
            </div>
          </div>
          <div v-if="!loadingAnimations && filteredAnimations.length === 0" class="empty-grid"><p>No animations found</p></div>
        </div>
      </div>

      <div class="preview-panel">
        <div class="preview-section">
          <div class="preview-header">
            <h3>{{ currentAnim ? currentAnim.name : 'Select an Animation' }}</h3>
            <div class="preview-controls" v-if="currentAnim">
              <button class="ctrl-btn" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
                <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </button>
              <button class="ctrl-btn" @click="resetAnimation" title="Reset"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg></button>
              <div class="speed-control"><label>Speed:</label><input type="range" min="0.1" max="3" step="0.1" v-model.number="animationSpeed" /><span>{{ animationSpeed.toFixed(1) }}x</span></div>
            </div>
          </div>
          <div ref="threeContainer" class="three-container">
            <div v-if="!currentAnim" class="placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z"/></svg><p>Select an animation to preview</p></div>
          </div>
        </div>

        <div class="details-section" v-if="currentAnim">
          <div class="details-tabs">
            <button :class="['tab', { active: activeTab === 'info' }]" @click="activeTab = 'info'">Info</button>
            <button :class="['tab', { active: activeTab === 'code' }]" @click="activeTab = 'code'">Lua Code</button>
            <button :class="['tab', { active: activeTab === 'steps' }]" @click="activeTab = 'steps'">How to Apply</button>
          </div>
          <div v-if="activeTab === 'info'" class="tab-content">
            <div class="info-grid">
              <div class="info-item"><label>Animation</label><span>{{ currentAnim.name }}</span></div>
              <div class="info-item"><label>Category</label><span>{{ currentAnim.category }}</span></div>
              <div class="info-item"><label>Type</label><span>{{ currentAnim.looping ? 'Looping' : 'One-shot' }}</span></div>
              <div class="info-item"><label>Duration</label><span>{{ currentAnim.duration }}s</span></div>
              <div class="info-item full-width"><label>Description</label><span>{{ currentAnim.description }}</span></div>
              <div class="info-item full-width"><label>Best For</label><span>{{ currentAnim.bestFor }}</span></div>
            </div>
          </div>
          <div v-if="activeTab === 'code'" class="tab-content">
            <div class="code-header"><span class="code-lang">Lua</span><button class="copy-btn" @click="copyCode"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>{{ copySuccess ? 'Copied!' : 'Copy Code' }}</button></div>
            <pre class="code-block"><code>{{ currentAnim.luaCode }}</code></pre>
          </div>
          <div v-if="activeTab === 'steps'" class="tab-content">
            <div class="steps-list">
              <div class="step" v-for="(step, idx) in applicationSteps" :key="idx">
                <div class="step-number">{{ idx + 1 }}</div>
                <div class="step-content"><h4>{{ step.title }}</h4><p>{{ step.description }}</p>
                  <div v-if="step.code" class="step-code-wrapper"><button class="step-copy-btn" @click="copyText(step.code || '')" title="Copy"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></button><pre class="step-code"><code>{{ step.code }}</code></pre></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-details"><div class="empty-details-content"><h3>Select an Animation</h3><p>Choose from the left or create with AI.</p></div></div>
      </div>
    </div>

    <!-- ═══ DESIGN TAB ═══ -->
    <div v-show="activeTool === 'design'" class="roblox-content design-content">
      <div class="design-panel-left">
        <div class="panel-header">
          <h2>Part Designer</h2>
          <button class="btn-secondary" @click="openDesignAI">🤖 AI Generate</button>
        </div>

        <!-- Design Info -->
        <div class="design-form">
          <div class="form-group"><label>Model Name</label><input v-model="designName" type="text" placeholder="My Model" /></div>
          <div class="form-group"><label>Description</label><textarea v-model="designDescription" rows="2" placeholder="Describe..."></textarea></div>
          <div class="form-group"><label>Behavior Script (Lua)</label><textarea v-model="designLuaCode" rows="3" class="code-textarea" placeholder="-- Optional"></textarea></div>
        </div>

        <!-- Parts List -->
        <div class="parts-list-section">
          <div class="parts-list-header">
            <h3>Parts ({{ designParts.length }})</h3>
            <button class="btn-secondary btn-sm" @click="addNewPart">+ Add Part</button>
          </div>
          <div class="parts-list">
            <div v-for="(part, idx) in designParts" :key="idx" :class="['part-list-item', { active: selectedPartIdx === idx }]" @click="selectedPartIdx = idx">
              <div class="part-list-color" :style="{ background: part.color }"></div>
              <div class="part-list-info"><strong>{{ part.name }}</strong><span>{{ part.shape }} · {{ part.material }}</span></div>
              <button v-if="designParts.length > 1" class="mini-btn danger" @click.stop="removePart(idx)" title="Remove">✕</button>
            </div>
          </div>
        </div>

        <!-- Selected Part Editor -->
        <div v-if="selectedPart" class="part-editor">
          <h3>Edit: {{ selectedPart.name }}</h3>
          <div class="form-group"><label>Name</label><input v-model="selectedPart.name" type="text" /></div>
          <div class="form-row">
            <div class="form-group"><label>Shape</label><select v-model="selectedPart.shape"><option value="Block">Block</option><option value="Ball">Ball</option><option value="Cylinder">Cylinder</option><option value="Wedge">Wedge</option></select></div>
            <div class="form-group"><label>Material</label><select v-model="selectedPart.material"><option v-for="m in materials" :key="m" :value="m">{{ m }}</option></select></div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Size X</label><input v-model.number="selectedPart.size.x" type="number" min="0.1" step="0.5" /></div>
            <div class="form-group"><label>Size Y</label><input v-model.number="selectedPart.size.y" type="number" min="0.1" step="0.5" /></div>
            <div class="form-group"><label>Size Z</label><input v-model.number="selectedPart.size.z" type="number" min="0.1" step="0.5" /></div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Pos X</label><input v-model.number="selectedPart.position.x" type="number" step="0.5" /></div>
            <div class="form-group"><label>Pos Y</label><input v-model.number="selectedPart.position.y" type="number" step="0.5" /></div>
            <div class="form-group"><label>Pos Z</label><input v-model.number="selectedPart.position.z" type="number" step="0.5" /></div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Rot X°</label><input v-model.number="selectedPart.rotation.x" type="number" step="5" /></div>
            <div class="form-group"><label>Rot Y°</label><input v-model.number="selectedPart.rotation.y" type="number" step="5" /></div>
            <div class="form-group"><label>Rot Z°</label><input v-model.number="selectedPart.rotation.z" type="number" step="5" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Color</label><input v-model="selectedPart.color" type="color" /></div>
            <div class="form-group"><label>Transparency</label><input v-model.number="selectedPart.transparency" type="range" min="0" max="1" step="0.05" /><span class="range-val">{{ selectedPart.transparency.toFixed(2) }}</span></div>
          </div>
          <div class="form-row">
            <label class="checkbox-label"><input type="checkbox" v-model="selectedPart.anchored" /> Anchored</label>
            <label class="checkbox-label"><input type="checkbox" v-model="selectedPart.canCollide" /> CanCollide</label>
          </div>
        </div>

        <!-- Actions -->
        <div class="design-actions">
          <button class="btn-primary" @click="saveDesignToBackend" :disabled="savingDesign">{{ savingDesign ? 'Saving...' : '💾 Save' }}</button>
          <button v-if="currentDesignId" class="btn-secondary" @click="downloadZip">📦 ZIP</button>
          <button v-if="currentDesignId" class="btn-secondary" @click="downloadRbxm">📥 RBXM</button>
          <button v-if="currentDesignId" class="btn-secondary" @click="downloadLua">📄 Lua</button>
        </div>

        <!-- Saved Designs -->
        <div class="saved-designs" v-if="savedDesigns.length > 0">
          <h3>My Saved Designs</h3>
          <div class="design-list">
            <div v-for="d in savedDesigns" :key="d.id" :class="['design-list-item', { active: currentDesignId === d.id }]" @click="loadDesign(d)">
              <div class="design-list-info"><strong>{{ d.name }}</strong><span>{{ d.parts?.length || 0 }} parts</span></div>
              <div class="design-list-actions">
                <button class="mini-btn" @click.stop="downloadDesignById(d.id, 'rbxm')" title="RBXM">📥</button>
                <button class="mini-btn danger" @click.stop="deleteDesignById(d.id)" title="Delete">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Design 3D Preview + Code -->
      <div class="design-panel-right">
        <div class="preview-header"><h3>{{ designName || 'Preview' }} <span class="count" v-if="designParts.length">({{ designParts.length }} parts)</span></h3></div>
        <div ref="designThreeContainer" class="three-container design-three"></div>

        <div class="design-info-panel">
          <div class="details-tabs">
            <button :class="['tab', { active: designTab === 'lua' }]" @click="designTab = 'lua'">Lua Code</button>
            <button :class="['tab', { active: designTab === 'steps' }]" @click="designTab = 'steps'">How to Import</button>
          </div>

          <div v-if="designTab === 'lua'" class="tab-content">
            <div class="code-header"><span class="code-lang">Lua</span><button class="copy-btn" @click="copyDesignCode"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy</button></div>
            <pre class="code-block design-code"><code>{{ generatedDesignLua }}</code></pre>
          </div>

          <div v-if="designTab === 'steps'" class="tab-content">
            <div class="steps-list">
              <div class="step"><div class="step-number">1</div><div class="step-content"><h4>Method A: Import RBXM (Recommended)</h4><p>Save the design, click <strong>📥 RBXM</strong> to download the <code>.rbxm</code> file. In Roblox Studio, go to <strong>File → Import from File</strong> (or right-click Workspace → Insert from File) and select the downloaded <code>.rbxm</code>. The model appears in Workspace.</p></div></div>
              <div class="step"><div class="step-number">2</div><div class="step-content"><h4>Method B: Lua Script</h4><p>Click <strong>📄 Lua</strong> or copy the code from the Lua Code tab. In Roblox Studio, insert a <strong>Script</strong> into <strong>ServerScriptService</strong>, paste the code, and press <strong>F5</strong> to play. The model is created. Stop the game (Shift+F5) and delete the script.</p></div></div>
              <div class="step"><div class="step-number">3</div><div class="step-content"><h4>Method C: Download ZIP</h4><p>Click <strong>📦 ZIP</strong> to download a package with the RBXM file, Lua script, behavior script, and a README with detailed instructions.</p></div></div>
              <div class="step"><div class="step-number">4</div><div class="step-content"><h4>After Import</h4><p>Position the model where you want it. Select all parts and press <strong>Ctrl+G</strong> to group them into a Model. Save your game with <strong>Ctrl+S</strong>.</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ MODALS ═══ -->

    <!-- Custom Animation -->
    <div v-if="showCustomRequest" class="modal-overlay" @click.self="showCustomRequest = false">
      <div class="modal-content">
        <div class="modal-header"><h3>Request Custom Animation</h3><button class="close-btn" @click="showCustomRequest = false">&times;</button></div>
        <div class="modal-body">
          <p class="modal-description">Describe the animation. AI generates the Lua code and preview.</p>
          <textarea v-model="customDescription" placeholder="A part that spins while moving in a figure-8..." rows="4" class="custom-textarea"></textarea>
          <div class="custom-options">
            <label class="option-group"><span>Part:</span><select v-model="customPartType"><option value="Part">Part</option><option value="SpherePart">Sphere</option><option value="CylinderPart">Cylinder</option><option value="Model">Model</option></select></label>
            <label class="option-group"><span>Loop:</span><select v-model="customLooping"><option :value="true">Yes</option><option :value="false">No</option></select></label>
            <label class="option-group"><span>Duration:</span><input type="number" v-model.number="customDuration" min="0.5" max="30" step="0.5" /></label>
          </div>
          <div v-if="customError" class="custom-error">⚠️ {{ customError }}</div>
        </div>
        <div class="modal-footer"><button class="btn-secondary" @click="showCustomRequest = false">Cancel</button><button class="btn-primary" @click="requestCustomAnimation" :disabled="customLoading || !customDescription.trim()"><span v-if="customLoading" class="spinner"></span>{{ customLoading ? 'Generating...' : 'Generate' }}</button></div>
      </div>
    </div>

    <!-- Admin Create -->
    <div v-if="showAdminCreate" class="modal-overlay" @click.self="showAdminCreate = false">
      <div class="modal-content wide-modal">
        <div class="modal-header"><h3>⚙️ Add Animation to Library</h3><button class="close-btn" @click="showAdminCreate = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-group"><label>Name</label><input v-model="adminForm.name" type="text" /></div><div class="form-group"><label>Category</label><select v-model="adminForm.category"><option v-for="c in allCategories" :key="c" :value="c">{{ c }}</option></select></div></div>
          <div class="form-row"><div class="form-group"><label>Icon</label><input v-model="adminForm.icon" type="text" maxlength="4" /></div><div class="form-group"><label>Duration</label><input v-model.number="adminForm.duration" type="number" min="0.5" step="0.5" /></div></div>
          <div class="form-group"><label>Description</label><textarea v-model="adminForm.description" rows="2"></textarea></div>
          <div class="form-group"><label>Best For</label><input v-model="adminForm.bestFor" type="text" /></div>
          <div class="form-group"><label>Lua Code</label><textarea v-model="adminForm.luaCode" rows="8" class="code-textarea"></textarea></div>
          <div class="form-group"><label>Preview Params JSON</label><textarea v-model="adminForm.threeAnimParamsJson" rows="3" class="code-textarea" placeholder='{"posY":"Math.sin(t)*1.5+1.5"}'></textarea></div>
          <div v-if="adminError" class="custom-error">⚠️ {{ adminError }}</div>
        </div>
        <div class="modal-footer"><button class="btn-secondary" @click="showAdminCreate = false">Cancel</button><button class="btn-primary" @click="adminSaveAnimation" :disabled="adminSaving">{{ adminSaving ? 'Saving...' : 'Save' }}</button></div>
      </div>
    </div>

    <!-- AI Design -->
    <div v-if="showDesignAIModal" class="modal-overlay" @click.self="showDesignAIModal = false">
      <div class="modal-content">
        <div class="modal-header"><h3>🤖 AI Part Generator</h3><button class="close-btn" @click="showDesignAIModal = false">&times;</button></div>
        <div class="modal-body">
          <p class="modal-description">Describe what you want to build. AI will create it using multiple parts with proper shapes, sizes, positions, colors, and materials.</p>
          <textarea v-model="designAIDescription" rows="3" class="custom-textarea" placeholder="e.g. a red cowboy hat, a robot character, a medieval castle tower, a glowing sword..."></textarea>
          <div v-if="designAIError" class="custom-error">⚠️ {{ designAIError }}</div>
        </div>
        <div class="modal-footer"><button class="btn-secondary" @click="showDesignAIModal = false">Cancel</button><button class="btn-primary" @click="executeDesignAI" :disabled="designAILoading || !designAIDescription.trim()"><span v-if="designAILoading" class="spinner"></span>{{ designAILoading ? 'Generating...' : 'Generate Design' }}</button></div>
      </div>
    </div>

    <transition name="toast"><div v-if="toastMessage" class="toast" :class="toastType">{{ toastMessage }}</div></transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { robloxService, type RobloxAnimation, type RobloxDesign, type PartData } from '@/services/roblox.service';
import { useAuthStore } from '@/store/auth';

interface CharDef { id: string; name: string; hc: number; tc: number; lc: number; }
interface AppStep { title: string; description: string; code?: string; }

const authStore = useAuthStore();
const isAdmin = computed(() => !!authStore.user?.is_admin);
const materials = ['SmoothPlastic','Brick','Wood','Metal','Grass','Ice','Neon','Glass','Marble','Concrete','Sand','Fabric','Pebble','DiamondPlate','ForceField'];
const allCategories = ['Movement','Rotation','Scale','Color','Complex','Character','Physics','UI/FX'];
const characters: CharDef[] = [
  { id:'default', name:'Classic Robloxian', hc:0xf5c542, tc:0x0057a8, lc:0xf5c542 },
  { id:'noob', name:'Noob', hc:0xf5c542, tc:0x0057ff, lc:0xf5c542 },
  { id:'robot', name:'Robot', hc:0x888888, tc:0x555555, lc:0x888888 },
  { id:'zombie', name:'Zombie', hc:0x7cba3f, tc:0x3d5c1e, lc:0x7cba3f },
  { id:'knight', name:'Knight', hc:0xaaaaaa, tc:0x666666, lc:0xaaaaaa },
];

// ═══ State ═══
const activeTool = ref<'animations'|'design'>('animations');
const toastMessage = ref(''); const toastType = ref('success');

// Anim state
const loadingAnimations = ref(false);
const allAnimations = ref<RobloxAnimation[]>([]);
const searchQuery = ref(''); const selectedCategory = ref('');
const currentAnim = ref<RobloxAnimation|null>(null);
const activeTab = ref('info'); const isPlaying = ref(true); const animationSpeed = ref(1.0);
const copySuccess = ref(false); const selectedCharacter = ref('default');
const showCustomRequest = ref(false); const customDescription = ref(''); const customPartType = ref('Part');
const customLooping = ref(true); const customDuration = ref(2); const customLoading = ref(false); const customError = ref('');
const showAdminCreate = ref(false); const adminSaving = ref(false); const adminError = ref('');
const adminForm = ref({ name:'', category:'Movement', icon:'🎬', description:'', bestFor:'', looping:true, duration:2, luaCode:'', threeAnimParamsJson:'{}' });

// Design state
const designName = ref('My Model');
const designDescription = ref('');
const designLuaCode = ref('');
const designParts = ref<PartData[]>([makeDefaultPart()]);
const selectedPartIdx = ref(0);
const currentDesignId = ref<string|null>(null);
const savedDesigns = ref<RobloxDesign[]>([]);
const savingDesign = ref(false);
const designTab = ref('lua');
const showDesignAIModal = ref(false);
const designAIDescription = ref(''); const designAILoading = ref(false); const designAIError = ref('');

const selectedPart = computed(() => designParts.value[selectedPartIdx.value] || null);

// Three.js anim
const threeContainer = ref<HTMLDivElement|null>(null);
let aScene: THREE.Scene|null=null, aCamera: THREE.PerspectiveCamera|null=null, aRenderer: THREE.WebGLRenderer|null=null, aControls: OrbitControls|null=null;
let aFrame=0, aClock: THREE.Clock|null=null, charGroup: THREE.Group|null=null, animReady=false;
let currentAnimFn: ((g:THREE.Group,t:number,dt:number,s:number)=>void)|null=null;

// Three.js design
const designThreeContainer = ref<HTMLDivElement|null>(null);
let dScene: THREE.Scene|null=null, dCamera: THREE.PerspectiveCamera|null=null, dRenderer: THREE.WebGLRenderer|null=null, dControls: OrbitControls|null=null;
let dFrame=0, designReady=false;
let dModelGroup: THREE.Group|null=null;

// ═══ Helpers ═══
function makeDefaultPart(o?: Partial<PartData>): PartData {
  return { name:'Part', partType:'Part', shape:'Block', size:{x:4,y:4,z:4}, position:{x:0,y:2,z:0}, rotation:{x:0,y:0,z:0}, color:'#4488ff', material:'SmoothPlastic', transparency:0, reflectance:0, anchored:true, canCollide:true, effects:[], ...o };
}
function showToast(m:string, t='success') { toastMessage.value=m; toastType.value=t; setTimeout(()=>{toastMessage.value='';},3000); }
async function copyText(t:string) { try{await navigator.clipboard.writeText(t); showToast('Copied!');}catch{showToast('Copy failed','error');} }
function hexToThreeColor(hex:string):THREE.Color { return new THREE.Color(hex); }
function degToRad(d:number):number { return d * Math.PI / 180; }

// ═══ Computed ═══
const dynamicCategories = computed(() => Array.from(new Set(allAnimations.value.map(a=>a.category))).sort());
const filteredAnimations = computed(() => {
  let l = allAnimations.value;
  if (selectedCategory.value) l = l.filter(a=>a.category===selectedCategory.value);
  if (searchQuery.value.trim()) { const q=searchQuery.value.toLowerCase(); l=l.filter(a=>a.name.toLowerCase().includes(q)||a.description.toLowerCase().includes(q)||a.bestFor.toLowerCase().includes(q)); }
  return l;
});
const applicationSteps = computed<AppStep[]>(() => {
  if (!currentAnim.value) return [];
  return [
    {title:'Open Roblox Studio',description:'Open your game project.'},
    {title:'Select the Part',description:'Select a Part in Explorer or insert a new one.'},
    {title:'Anchor it',description:'In Properties, check "Anchored".',code:'-- Anchored = true'},
    {title:'Insert a Script',description:'Right-click Part → Insert Object → Script.'},
    {title:'Paste the Code',description:'Delete default code, paste the Lua from the Code tab.',code:currentAnim.value.luaCode},
    {title:'Test (F5)',description:'Press F5 to play and see the animation.'},
    {title:'Stop & Save',description:'Shift+F5 to stop, Ctrl+S to save.'},
  ];
});
const generatedDesignLua = computed(() => {
  const parts = designParts.value;
  const name = designName.value || 'Model';
  const lines: string[] = [`-- ${name} Creation Script`,`-- Generated by Self Study Roblox Tool`,''];
  if (parts.length > 1) { lines.push(`local model = Instance.new("Model")`); lines.push(`model.Name = "${name}"`); lines.push(''); }
  parts.forEach((p, i) => {
    const v = parts.length > 1 ? `part${i}` : 'part';
    const hex = p.color.replace('#','');
    const r=parseInt(hex.substring(0,2),16)||128, g=parseInt(hex.substring(2,4),16)||128, b=parseInt(hex.substring(4,6),16)||128;
    if (p.shape === 'Wedge') lines.push(`local ${v} = Instance.new("WedgePart")`);
    else lines.push(`local ${v} = Instance.new("Part")`);
    lines.push(`${v}.Name = "${p.name}"`);
    lines.push(`${v}.Size = Vector3.new(${p.size.x}, ${p.size.y}, ${p.size.z})`);
    if (p.rotation.x||p.rotation.y||p.rotation.z) lines.push(`${v}.CFrame = CFrame.new(${p.position.x}, ${p.position.y}, ${p.position.z}) * CFrame.Angles(math.rad(${p.rotation.x}), math.rad(${p.rotation.y}), math.rad(${p.rotation.z}))`);
    else lines.push(`${v}.Position = Vector3.new(${p.position.x}, ${p.position.y}, ${p.position.z})`);
    if (p.shape==='Ball') lines.push(`${v}.Shape = Enum.PartType.Ball`);
    else if (p.shape==='Cylinder') lines.push(`${v}.Shape = Enum.PartType.Cylinder`);
    lines.push(`${v}.Color = Color3.fromRGB(${r}, ${g}, ${b})`);
    lines.push(`${v}.Material = Enum.Material.${p.material}`);
    if (p.transparency>0) lines.push(`${v}.Transparency = ${p.transparency}`);
    lines.push(`${v}.Anchored = ${p.anchored}`);
    lines.push(`${v}.CanCollide = ${p.canCollide}`);
    lines.push(`${v}.Parent = ${parts.length>1?'model':'workspace'}`);
    lines.push('');
  });
  if (parts.length>1) { lines.push('model.Parent = workspace'); lines.push(`model.PrimaryPart = part0`); }
  lines.push(`print("${name} created!")`);
  return lines.join('\n');
});

// ═══ Tool Switch ═══
async function switchTool(tool: 'animations'|'design') {
  activeTool.value = tool;
  await nextTick();
  if (tool === 'animations') ensureAnimScene();
  else { ensureDesignScene(); await loadDesigns(); }
}

// ═══ Anim Three.js ═══
function disposeAnimScene() { if(aFrame){cancelAnimationFrame(aFrame);aFrame=0;} if(aRenderer){aRenderer.dispose();aRenderer.domElement?.parentNode?.removeChild(aRenderer.domElement);aRenderer=null;} if(aControls){aControls.dispose();aControls=null;} aScene=null;aCamera=null;charGroup=null;aClock=null;animReady=false; }
function ensureAnimScene() { if(!threeContainer.value)return; if(aRenderer&&aRenderer.domElement.parentNode!==threeContainer.value)disposeAnimScene(); if(!animReady)initAnimScene(); }
function initAnimScene() {
  if(!threeContainer.value)return; disposeAnimScene();
  aScene=new THREE.Scene(); aScene.background=new THREE.Color(0x1a1a2e);
  aCamera=new THREE.PerspectiveCamera(50,threeContainer.value.clientWidth/threeContainer.value.clientHeight,0.1,100); aCamera.position.set(5,4,6);
  aRenderer=new THREE.WebGLRenderer({antialias:true}); aRenderer.setSize(threeContainer.value.clientWidth,threeContainer.value.clientHeight); aRenderer.setPixelRatio(Math.min(devicePixelRatio,2)); aRenderer.shadowMap.enabled=true; threeContainer.value.appendChild(aRenderer.domElement);
  aControls=new OrbitControls(aCamera,aRenderer.domElement); aControls.enableDamping=true; aControls.target.set(0,1,0);
  aScene.add(new THREE.AmbientLight(0x404060,0.6)); const dl=new THREE.DirectionalLight(0xffffff,1); dl.position.set(5,10,5); dl.castShadow=true; aScene.add(dl);
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x16213e})); gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; aScene.add(gnd);
  const grid=new THREE.GridHelper(20,20,0x333366,0x222244); grid.position.y=0.01; aScene.add(grid);
  charGroup=new THREE.Group(); aScene.add(charGroup); buildChar(characters.find(c=>c.id===selectedCharacter.value)||characters[0]);
  aClock=new THREE.Clock(); animReady=true; loopAnim();
}
function buildChar(c:CharDef) { if(!charGroup)return; while(charGroup.children.length)charGroup.remove(charGroup.children[0]); const h=new THREE.MeshStandardMaterial({color:c.hc}),t=new THREE.MeshStandardMaterial({color:c.tc}),l=new THREE.MeshStandardMaterial({color:c.lc}); const torso=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.4,0.7),t);torso.position.y=2.2;torso.castShadow=true;charGroup.add(torso); const head=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),h);head.position.y=3.4;head.castShadow=true;charGroup.add(head); const eM=new THREE.MeshStandardMaterial({color:0x111111}),eG=new THREE.SphereGeometry(0.1,8,8); charGroup.add(new THREE.Mesh(eG,eM).translateX(-0.2).translateY(3.45).translateZ(0.45)); charGroup.add(new THREE.Mesh(eG,eM).translateX(0.2).translateY(3.45).translateZ(0.45)); const aG=new THREE.BoxGeometry(0.5,1.2,0.5); const la=new THREE.Mesh(aG,l);la.position.set(-1.05,2.1,0);la.castShadow=true;charGroup.add(la); const ra=new THREE.Mesh(aG,l);ra.position.set(1.05,2.1,0);ra.castShadow=true;charGroup.add(ra); const lG=new THREE.BoxGeometry(0.5,1.2,0.5); const ll=new THREE.Mesh(lG,l);ll.position.set(-0.35,0.8,0);ll.castShadow=true;charGroup.add(ll); const rl=new THREE.Mesh(lG,l);rl.position.set(0.35,0.8,0);rl.castShadow=true;charGroup.add(rl); }
function updateCharacter() { buildChar(characters.find(c=>c.id===selectedCharacter.value)||characters[0]); }
function loopAnim() { if(!animReady||!aScene||!aCamera||!aRenderer||!aClock)return; aFrame=requestAnimationFrame(loopAnim); const dt=aClock.getDelta(),t=aClock.getElapsedTime(); aControls?.update(); if(currentAnim.value&&isPlaying.value&&currentAnimFn&&charGroup){ charGroup.position.set(0,0,0);charGroup.rotation.set(0,0,0);charGroup.scale.set(1,1,1); try{currentAnimFn(charGroup,t,dt,animationSpeed.value);}catch{charGroup.position.y=Math.sin(t)*0.5+0.5;}} aRenderer.render(aScene,aCamera); }
function resetTransforms() { if(!charGroup)return; charGroup.position.set(0,0,0);charGroup.rotation.set(0,0,0);charGroup.scale.set(1,1,1); charGroup.traverse(c=>{if((c as THREE.Mesh).isMesh){const m=(c as THREE.Mesh).material as THREE.MeshStandardMaterial;if(m){m.opacity=1;m.transparent=false;}}}); }
function togglePlay() { isPlaying.value=!isPlaying.value; if(isPlaying.value&&aClock)aClock.start(); }
function resetAnimation() { aClock=new THREE.Clock(); isPlaying.value=true; resetTransforms(); }

// ═══ Design Three.js ═══
function disposeDesignScene() { if(dFrame){cancelAnimationFrame(dFrame);dFrame=0;} if(dRenderer){dRenderer.dispose();dRenderer.domElement?.parentNode?.removeChild(dRenderer.domElement);dRenderer=null;} if(dControls){dControls.dispose();dControls=null;} dScene=null;dCamera=null;dModelGroup=null;designReady=false; }
function ensureDesignScene() { if(!designThreeContainer.value)return; if(dRenderer&&dRenderer.domElement.parentNode!==designThreeContainer.value)disposeDesignScene(); if(!designReady)initDesignScene(); }
function initDesignScene() {
  if(!designThreeContainer.value)return; disposeDesignScene();
  dScene=new THREE.Scene(); dScene.background=new THREE.Color(0x1a1a2e);
  dCamera=new THREE.PerspectiveCamera(50,designThreeContainer.value.clientWidth/designThreeContainer.value.clientHeight,0.1,200); dCamera.position.set(8,8,12);
  dRenderer=new THREE.WebGLRenderer({antialias:true}); dRenderer.setSize(designThreeContainer.value.clientWidth,designThreeContainer.value.clientHeight); dRenderer.setPixelRatio(Math.min(devicePixelRatio,2)); dRenderer.shadowMap.enabled=true; designThreeContainer.value.appendChild(dRenderer.domElement);
  dControls=new OrbitControls(dCamera,dRenderer.domElement); dControls.enableDamping=true; dControls.target.set(0,3,0);
  dScene.add(new THREE.AmbientLight(0x606080,0.7)); const dl=new THREE.DirectionalLight(0xffffff,1.2); dl.position.set(8,15,8); dl.castShadow=true; dScene.add(dl); dScene.add(new THREE.PointLight(0x6366f1,0.4,30));
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x16213e})); gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; dScene.add(gnd);
  const grid=new THREE.GridHelper(30,30,0x333366,0x222244); grid.position.y=0.01; dScene.add(grid);
  dModelGroup=new THREE.Group(); dScene.add(dModelGroup);
  designReady=true; rebuildDesignPreview(); loopDesign();
}
function buildPartMesh(p: PartData): THREE.Mesh {
  let geo: THREE.BufferGeometry;
  const sx=Math.max(0.1,p.size.x), sy=Math.max(0.1,p.size.y), sz=Math.max(0.1,p.size.z);
  switch(p.shape) {
    case 'Ball': geo=new THREE.SphereGeometry(Math.max(sx,sy,sz)/2,24,24); break;
    case 'Cylinder': geo=new THREE.CylinderGeometry(sx/2,sx/2,sy,24); break;
    case 'Wedge': { geo=new THREE.BufferGeometry(); const hw=sx/2,hh=sy/2,hd=sz/2; const verts=new Float32Array([-hw,-hh,-hd, hw,-hh,-hd, hw,hh,-hd, -hw,-hh,hd, hw,-hh,hd, hw,hh,hd, -hw,-hh,-hd, -hw,-hh,hd, hw,hh,hd, hw,hh,-hd, -hw,-hh,-hd, hw,-hh,-hd, -hw,-hh,hd, hw,-hh,hd, hw,-hh,-hd, -hw,-hh,-hd, hw,-hh,hd, hw,hh,hd, hw,hh,-hd, hw,-hh,-hd]); geo.setAttribute('position',new THREE.BufferAttribute(verts,3)); geo.computeVertexNormals(); break; }
    default: geo=new THREE.BoxGeometry(sx,sy,sz);
  }
  const isNeon=p.material==='Neon', isGlass=p.material==='Glass', isMetal=p.material==='Metal'||p.material==='DiamondPlate';
  const mat=new THREE.MeshStandardMaterial({ color:hexToThreeColor(p.color), opacity:1-p.transparency, transparent:p.transparency>0, roughness:isGlass?0.05:isMetal?0.2:isNeon?0.3:0.6, metalness:isMetal?0.9:isNeon?0.1:0.05 });
  if(isNeon){mat.emissive=hexToThreeColor(p.color);mat.emissiveIntensity=0.6;}
  if(isGlass){mat.opacity=0.35;mat.transparent=true;}
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(p.position.x, p.position.y, p.position.z);
  if(p.rotation.x||p.rotation.y||p.rotation.z) mesh.rotation.set(degToRad(p.rotation.x), degToRad(p.rotation.y), degToRad(p.rotation.z));
  mesh.castShadow=true; mesh.receiveShadow=true;
  return mesh;
}
function rebuildDesignPreview() {
  if(!dModelGroup||!dScene)return;
  // Clear old meshes
  while(dModelGroup.children.length) {
    const c=dModelGroup.children[0];
    if((c as THREE.Mesh).geometry)(c as THREE.Mesh).geometry.dispose();
    if((c as THREE.Mesh).material) {
      const m=(c as THREE.Mesh).material;
      if(Array.isArray(m)) m.forEach(x=>x.dispose()); else (m as THREE.Material).dispose();
    }
    dModelGroup.remove(c);
  }
  // Build each part
  for(const p of designParts.value) {
    const mesh = buildPartMesh(p);
    dModelGroup.add(mesh);
  }
  // Auto-center camera on the model
  if(designParts.value.length>0 && dCamera && dControls) {
    const box = new THREE.Box3().setFromObject(dModelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 3);
    dControls.target.copy(center);
    dCamera.position.set(center.x + maxDim*1.5, center.y + maxDim, center.z + maxDim*1.5);
    dCamera.lookAt(center);
  }
}
function loopDesign() { if(!designReady||!dScene||!dCamera||!dRenderer)return; dFrame=requestAnimationFrame(loopDesign); dControls?.update(); dRenderer.render(dScene,dCamera); }

// ═══ Data Loading ═══
async function loadAnimations() { loadingAnimations.value=true; try{allAnimations.value=await robloxService.getAnimations();}catch(e:any){showToast('Load failed: '+e.message,'error');}finally{loadingAnimations.value=false;} }
async function loadDesigns() { if(!authStore.user?.id)return; try{savedDesigns.value=await robloxService.getDesigns(authStore.user.id);}catch{} }

// ═══ Animation Selection ═══
function selectAnimation(a:RobloxAnimation) { currentAnim.value=a; activeTab.value='info'; isPlaying.value=true; currentAnimFn=buildAnimator(a.threeAnimParams||{}); resetTransforms(); }
function buildAnimator(params:Record<string,string>) {
  if(!params||!Object.keys(params).length) return (g:THREE.Group,t:number,_:number,s:number)=>{g.position.y=Math.sin(t*s)*1.5+1.5;g.rotation.y=t*s;};
  const fns:Record<string,Function|null>={};
  for(const k of ['posX','posY','posZ','rotX','rotY','rotZ','scaleX','scaleY','scaleZ','colorHue']) { if(params[k]){try{fns[k]=new Function('t','Math',`"use strict";try{return(${params[k]});}catch{return 0;}`);}catch{fns[k]=null;}} }
  return (g:THREE.Group,t:number,_:number,s:number)=>{const ts=t*s;try{ if(fns.posX)g.position.x=(fns.posX as any)(ts,Math)||0; if(fns.posY)g.position.y=(fns.posY as any)(ts,Math)||0; if(fns.posZ)g.position.z=(fns.posZ as any)(ts,Math)||0; if(fns.rotX)g.rotation.x=(fns.rotX as any)(ts,Math)||0; if(fns.rotY)g.rotation.y=(fns.rotY as any)(ts,Math)||0; if(fns.rotZ)g.rotation.z=(fns.rotZ as any)(ts,Math)||0; if(fns.scaleX){const sx=Math.max(0.01,(fns.scaleX as any)(ts,Math)||1);g.scale.set(sx,fns.scaleY?Math.max(0.01,(fns.scaleY as any)(ts,Math)||sx):sx,fns.scaleZ?Math.max(0.01,(fns.scaleZ as any)(ts,Math)||sx):sx);} if(fns.colorHue){const h=Math.abs(((fns.colorHue as any)(ts,Math)||0)%1);const c=new THREE.Color().setHSL(h,1,0.5);g.traverse(ch=>{if((ch as THREE.Mesh).isMesh)((ch as THREE.Mesh).material as THREE.MeshStandardMaterial).color=c;});} }catch{g.position.y=Math.sin(ts)+1;g.rotation.y=ts*0.5;}};
}

// ═══ Custom AI Animation ═══
async function requestCustomAnimation() {
  if(!customDescription.value.trim())return; customLoading.value=true; customError.value='';
  try{
    const r=await robloxService.generateAnimation({description:customDescription.value,partType:customPartType.value,looping:customLooping.value,duration:customDuration.value});
    if(!r?.luaCode){customError.value='AI returned incomplete result';return;}
    const na:RobloxAnimation={id:'custom-'+Date.now(),name:r.name||'Custom',category:'Custom',icon:'🤖',color:'linear-gradient(135deg,#6366f1,#a855f7)',description:r.description||customDescription.value,bestFor:'Custom',looping:customLooping.value,duration:customDuration.value,luaCode:r.luaCode,threeAnimParams:r.threeAnimParams||{},created_by:'ai',created_at:new Date().toISOString()};
    if(isAdmin.value){try{const resp=await robloxService.createAnimation({...na,created_by:'admin',created_by_username:authStore.user?.username||''} as any);na.id=resp.animation.id;allAnimations.value.push(resp.animation);}catch{allAnimations.value.push(na);}}else{allAnimations.value.push(na);}
    selectAnimation(na); showCustomRequest.value=false; customDescription.value=''; showToast('Animation generated!');
  }catch(e:any){customError.value=e.message||'Failed';}finally{customLoading.value=false;}
}

// ═══ Admin ═══
async function adminSaveAnimation() {
  const f=adminForm.value; if(!f.name||!f.luaCode){adminError.value='Name and code required';return;} adminSaving.value=true;adminError.value='';
  let params={}; try{params=JSON.parse(f.threeAnimParamsJson||'{}');}catch{adminError.value='Invalid JSON';adminSaving.value=false;return;}
  try{const resp=await robloxService.createAnimation({name:f.name,category:f.category,icon:f.icon,color:'linear-gradient(135deg,#667eea,#764ba2)',description:f.description,bestFor:f.bestFor,looping:f.looping,duration:f.duration,luaCode:f.luaCode,threeAnimParams:params,created_by:'admin',created_by_username:authStore.user?.username||''} as any);allAnimations.value.push(resp.animation);showAdminCreate.value=false;showToast('Added!');adminForm.value={name:'',category:'Movement',icon:'🎬',description:'',bestFor:'',looping:true,duration:2,luaCode:'',threeAnimParamsJson:'{}'};
  }catch(e:any){adminError.value=e.message;}finally{adminSaving.value=false;}
}
async function deleteAnimationAdmin(id:string) { if(!confirm('Delete?'))return; try{await robloxService.deleteAnimation(id);allAnimations.value=allAnimations.value.filter(a=>a.id!==id);if(currentAnim.value?.id===id)currentAnim.value=null;showToast('Deleted');}catch(e:any){showToast(e.message,'error');} }

// ═══ Design Tool ═══
function addNewPart() { designParts.value.push(makeDefaultPart({name:`Part${designParts.value.length}`,position:{x:0,y:designParts.value.length*2+2,z:0}})); selectedPartIdx.value=designParts.value.length-1; rebuildDesignPreview(); }
function removePart(i:number) { designParts.value.splice(i,1); if(selectedPartIdx.value>=designParts.value.length)selectedPartIdx.value=Math.max(0,designParts.value.length-1); rebuildDesignPreview(); }

async function saveDesignToBackend() {
  if(!authStore.user?.id){showToast('Log in first','error');return;} savingDesign.value=true;
  const payload:Partial<RobloxDesign>={user_id:authStore.user.id,username:authStore.user.username||'',name:designName.value,description:designDescription.value,parts:designParts.value,luaCode:designLuaCode.value};
  try{
    if(currentDesignId.value){await robloxService.updateDesign(currentDesignId.value,payload,authStore.user.id);showToast('Updated!');}
    else{const r=await robloxService.saveDesign(payload);currentDesignId.value=r.id;showToast('Saved!');}
    await loadDesigns();
  }catch(e:any){showToast(e.message,'error');}finally{savingDesign.value=false;}
}
function loadDesign(d:RobloxDesign) {
  currentDesignId.value=d.id; designName.value=d.name; designDescription.value=d.description; designLuaCode.value=d.luaCode||'';
  designParts.value=(d.parts||[]).map(p=>makeDefaultPart(p));
  if(designParts.value.length===0)designParts.value=[makeDefaultPart()];
  selectedPartIdx.value=0; rebuildDesignPreview();
}
async function downloadZip() { if(!currentDesignId.value)return; try{await robloxService.downloadDesign(currentDesignId.value,'zip');showToast('Downloaded!');}catch(e:any){showToast(e.message,'error');} }
async function downloadRbxm() { if(!currentDesignId.value)return; try{await robloxService.downloadDesign(currentDesignId.value,'rbxm');showToast('RBXM downloaded!');}catch(e:any){showToast(e.message,'error');} }
async function downloadLua() { if(!currentDesignId.value)return; try{await robloxService.downloadDesign(currentDesignId.value,'lua');showToast('Lua downloaded!');}catch(e:any){showToast(e.message,'error');} }
async function downloadDesignById(id:string, fmt:'zip'|'rbxm'|'lua'='rbxm') { try{await robloxService.downloadDesign(id,fmt);}catch{showToast('Download failed','error');} }
async function deleteDesignById(id:string) { if(!confirm('Delete?'))return; try{await robloxService.deleteDesign(id,authStore.user?.id);savedDesigns.value=savedDesigns.value.filter(d=>d.id!==id);if(currentDesignId.value===id)currentDesignId.value=null;showToast('Deleted');}catch(e:any){showToast(e.message,'error');} }

function openDesignAI() { showDesignAIModal.value=true; designAIDescription.value=''; designAIError.value=''; }
async function executeDesignAI() {
  if(!designAIDescription.value.trim())return; designAILoading.value=true; designAIError.value='';
  try{
    const result = await robloxService.generateDesign({description:designAIDescription.value});
    console.log('AI Design result:', result);
    if(result && result.parts && result.parts.length > 0) {
      designName.value = result.name || 'AI Design';
      designDescription.value = result.description || designAIDescription.value;
      designLuaCode.value = result.luaCode || '';
      designParts.value = result.parts.map(p => makeDefaultPart(p));
      selectedPartIdx.value = 0;
      currentDesignId.value = null;
      rebuildDesignPreview();
      showDesignAIModal.value = false;
      showToast(`Design generated with ${result.parts.length} parts!`);
    } else {
      designAIError.value = 'AI returned no parts. Try a more specific description.';
    }
  }catch(e:any){designAIError.value=e.message||'Generation failed';}finally{designAILoading.value=false;}
}

async function copyCode() { if(!currentAnim.value)return; try{await navigator.clipboard.writeText(currentAnim.value.luaCode);copySuccess.value=true;showToast('Copied!');setTimeout(()=>{copySuccess.value=false;},2000);}catch{showToast('Failed','error');} }
async function copyDesignCode() { await copyText(generatedDesignLua.value); }

function onResize() {
  if(threeContainer.value&&aRenderer&&aCamera){aCamera.aspect=threeContainer.value.clientWidth/threeContainer.value.clientHeight;aCamera.updateProjectionMatrix();aRenderer.setSize(threeContainer.value.clientWidth,threeContainer.value.clientHeight);}
  if(designThreeContainer.value&&dRenderer&&dCamera){dCamera.aspect=designThreeContainer.value.clientWidth/designThreeContainer.value.clientHeight;dCamera.updateProjectionMatrix();dRenderer.setSize(designThreeContainer.value.clientWidth,designThreeContainer.value.clientHeight);}
}

// ═══ Watchers ═══
watch(designParts, () => { if(designReady) rebuildDesignPreview(); }, { deep: true });

// ═══ Lifecycle ═══
onMounted(async () => { await nextTick(); initAnimScene(); await loadAnimations(); window.addEventListener('resize',onResize); });
onUnmounted(() => { window.removeEventListener('resize',onResize); disposeAnimScene(); disposeDesignScene(); });
</script>

<style src="@/assets/css/roblox-tool.css"></style>