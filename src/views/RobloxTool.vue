<template>
  <div class="roblox-tool">
    <!-- Header -->
    <div class="roblox-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z"/>
            </svg>
          </div>
          <div>
            <h1>Roblox Animation Studio</h1>
            <p class="header-subtitle">Create, preview & export Lua animation scripts for Roblox</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="tool-tabs-header">
            <button :class="['tool-tab-btn', { active: activeTool === 'animations' }]" @click="switchTool('animations')">
              🎬 Animations
            </button>
            <button :class="['tool-tab-btn', { active: activeTool === 'design' }]" @click="switchTool('design')">
              🎨 Part Designer
            </button>
          </div>
          <button v-if="activeTool === 'animations'" class="btn-secondary" @click="showCustomRequest = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Custom Animation
          </button>
          <button v-if="activeTool === 'animations' && isAdmin" class="btn-secondary admin-btn" @click="showAdminCreate = true">
            ⚙️ Add Animation
          </button>
          <select v-if="activeTool === 'animations'" v-model="selectedCharacter" class="character-select" @change="updateCharacter">
            <option v-for="char in characters" :key="char.id" :value="char.id">{{ char.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════ -->
    <!-- ANIMATIONS TOOL                         -->
    <!-- ════════════════════════════════════════ -->
    <div v-show="activeTool === 'animations'" class="roblox-content">
      <!-- Left Panel -->
      <div class="animations-panel">
        <div class="panel-header">
          <h2>Animations <span class="count">({{ filteredAnimations.length }})</span></h2>
          <div v-if="loadingAnimations" class="loading-bar">Loading animations...</div>
          <div class="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input v-model="searchQuery" type="text" placeholder="Search animations..." class="search-input" />
          </div>
          <div class="filter-tags">
            <button
              v-for="cat in dynamicCategories"
              :key="cat"
              :class="['filter-tag', { active: selectedCategory === cat }]"
              @click="selectedCategory = selectedCategory === cat ? '' : cat"
            >{{ cat }}</button>
          </div>
        </div>

        <div class="animations-grid">
          <div
            v-for="anim in filteredAnimations"
            :key="anim.id"
            :class="['animation-card', { selected: currentAnim?.id === anim.id }]"
            @click="selectAnimation(anim)"
          >
            <div class="card-preview" :style="{ background: anim.color || '#333' }">
              <span class="card-icon">{{ anim.icon || '🎬' }}</span>
            </div>
            <div class="card-info">
              <h4>{{ anim.name }}</h4>
              <span class="card-category">{{ anim.category }}</span>
              <span v-if="anim.created_by !== 'system'" class="card-badge">Custom</span>
              <button
                v-if="isAdmin && anim.created_by !== 'system'"
                class="card-delete"
                @click.stop="deleteAnimationAdmin(anim.id)"
                title="Delete"
              >✕</button>
            </div>
          </div>
          <div v-if="!loadingAnimations && filteredAnimations.length === 0" class="empty-grid">
            <p>No animations found</p>
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="preview-panel">
        <div class="preview-section">
          <div class="preview-header">
            <h3>{{ currentAnim ? currentAnim.name : 'Select an Animation' }}</h3>
            <div class="preview-controls" v-if="currentAnim">
              <button class="ctrl-btn" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
                <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </button>
              <button class="ctrl-btn" @click="resetAnimation" title="Reset">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
              </button>
              <div class="speed-control">
                <label>Speed:</label>
                <input type="range" min="0.1" max="3" step="0.1" v-model.number="animationSpeed" />
                <span>{{ animationSpeed.toFixed(1) }}x</span>
              </div>
            </div>
          </div>
          <div ref="threeContainer" class="three-container">
            <div v-if="!currentAnim" class="placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z"/></svg>
              <p>Select an animation to preview</p>
            </div>
          </div>
        </div>

        <!-- Details -->
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
              <div v-if="currentAnim.created_by !== 'system'" class="info-item full-width custom-badge-row">
                <span class="custom-badge">🤖 {{ currentAnim.created_by === 'admin' ? 'Admin' : 'AI-Generated' }} Animation</span>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'code'" class="tab-content">
            <div class="code-header">
              <span class="code-lang">Lua</span>
              <button class="copy-btn" @click="copyCode">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                {{ copySuccess ? 'Copied!' : 'Copy Code' }}
              </button>
            </div>
            <pre class="code-block"><code>{{ currentAnim.luaCode }}</code></pre>
          </div>

          <div v-if="activeTab === 'steps'" class="tab-content">
            <div class="steps-list">
              <div class="step" v-for="(step, idx) in applicationSteps" :key="idx">
                <div class="step-number">{{ idx + 1 }}</div>
                <div class="step-content">
                  <h4>{{ step.title }}</h4>
                  <p>{{ step.description }}</p>
                  <div v-if="step.code" class="step-code-wrapper">
                    <button class="step-copy-btn" @click="copyText(step.code || '')" title="Copy">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                    </button>
                    <pre class="step-code"><code>{{ step.code }}</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-details">
          <div class="empty-details-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <h3>Select an Animation</h3>
            <p>Choose an animation from the left, or create a custom one with AI.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════ -->
    <!-- DESIGN TOOL                              -->
    <!-- ════════════════════════════════════════ -->
    <div v-show="activeTool === 'design'" class="roblox-content design-content">
      <div class="design-panel-left">
        <div class="panel-header">
          <h2>Part Designer</h2>
          <button class="btn-secondary" @click="generateDesignAI">🤖 AI Generate</button>
        </div>

        <div class="design-form">
          <div class="form-group">
            <label>Part Name</label>
            <input v-model="designForm.name" type="text" placeholder="My Custom Part" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="designForm.description" rows="2" placeholder="Describe your part..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Shape</label>
              <select v-model="designForm.shape">
                <option value="Block">Block</option>
                <option value="Ball">Ball</option>
                <option value="Cylinder">Cylinder</option>
                <option value="Wedge">Wedge</option>
              </select>
            </div>
            <div class="form-group">
              <label>Material</label>
              <select v-model="designForm.material">
                <option v-for="mat in materials" :key="mat" :value="mat">{{ mat }}</option>
              </select>
            </div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Size X</label><input v-model.number="designForm.size.x" type="number" min="0.1" step="0.5" /></div>
            <div class="form-group"><label>Size Y</label><input v-model.number="designForm.size.y" type="number" min="0.1" step="0.5" /></div>
            <div class="form-group"><label>Size Z</label><input v-model.number="designForm.size.z" type="number" min="0.1" step="0.5" /></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Color</label>
              <input v-model="designForm.color" type="color" />
            </div>
            <div class="form-group">
              <label>Transparency</label>
              <input v-model.number="designForm.transparency" type="range" min="0" max="1" step="0.05" />
              <span class="range-val">{{ designForm.transparency.toFixed(2) }}</span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Reflectance</label>
              <input v-model.number="designForm.reflectance" type="range" min="0" max="1" step="0.05" />
              <span class="range-val">{{ designForm.reflectance.toFixed(2) }}</span>
            </div>
          </div>
          <div class="form-row">
            <label class="checkbox-label"><input type="checkbox" v-model="designForm.anchored" /> Anchored</label>
            <label class="checkbox-label"><input type="checkbox" v-model="designForm.canCollide" /> CanCollide</label>
          </div>
          <div class="form-group">
            <label>Behavior Script (Lua)</label>
            <textarea v-model="designForm.luaCode" rows="4" placeholder="-- Optional Lua script..." class="code-textarea"></textarea>
          </div>
          <div class="design-actions">
            <button class="btn-primary" @click="saveDesignToBackend" :disabled="savingDesign">
              {{ savingDesign ? 'Saving...' : '💾 Save Design' }}
            </button>
            <button v-if="currentDesignId" class="btn-secondary" @click="downloadCurrentDesign" :disabled="downloadingDesign">
              {{ downloadingDesign ? 'Downloading...' : '📥 Download ZIP' }}
            </button>
          </div>
        </div>

        <div class="saved-designs" v-if="savedDesigns.length > 0">
          <h3>My Saved Designs</h3>
          <div class="design-list">
            <div
              v-for="d in savedDesigns"
              :key="d.id"
              :class="['design-list-item', { active: currentDesignId === d.id }]"
              @click="loadDesign(d)"
            >
              <div class="design-list-info">
                <strong>{{ d.name }}</strong>
                <span>{{ d.shape }} · {{ d.material }}</span>
              </div>
              <div class="design-list-actions">
                <button class="mini-btn" @click.stop="downloadDesignById(d.id)" title="Download">📥</button>
                <button class="mini-btn danger" @click.stop="deleteDesignById(d.id)" title="Delete">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="design-panel-right">
        <div class="preview-header">
          <h3>{{ designForm.name || 'Part Preview' }}</h3>
        </div>
        <div ref="designThreeContainer" class="three-container design-three"></div>
        <div class="design-info-panel">
          <h4>Lua Creation Code</h4>
          <div class="code-header">
            <span class="code-lang">Lua</span>
            <button class="copy-btn" @click="copyDesignCode">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Copy
            </button>
          </div>
          <pre class="code-block design-code"><code>{{ generatedDesignLua }}</code></pre>
          <div class="design-steps">
            <h4>How to Import</h4>
            <div class="step"><div class="step-number">1</div><div class="step-content"><p>Download the ZIP file using the button above</p></div></div>
            <div class="step"><div class="step-number">2</div><div class="step-content"><p>Extract the ZIP and open the <code>.lua</code> file</p></div></div>
            <div class="step"><div class="step-number">3</div><div class="step-content"><p>In Roblox Studio, insert a <strong>Script</strong> in <strong>ServerScriptService</strong></p></div></div>
            <div class="step"><div class="step-number">4</div><div class="step-content"><p>Paste the Lua code and press <strong>F5</strong> to Play — the part appears in Workspace</p></div></div>
            <div class="step"><div class="step-number">5</div><div class="step-content"><p>Stop the game, delete the creation script — your part is ready!</p></div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════ -->
    <!-- CUSTOM ANIMATION MODAL                   -->
    <!-- ════════════════════════════════════════ -->
    <div v-if="showCustomRequest" class="modal-overlay" @click.self="showCustomRequest = false">
      <div class="modal-content">
        <div class="modal-header"><h3>Request Custom Animation</h3><button class="close-btn" @click="showCustomRequest = false">&times;</button></div>
        <div class="modal-body">
          <p class="modal-description">Describe the animation. AI will generate Lua code and a preview.</p>
          <textarea v-model="customDescription" placeholder="Example: A part that spins while moving in a figure-8 pattern..." rows="4" class="custom-textarea"></textarea>
          <div class="custom-options">
            <label class="option-group"><span>Target Part:</span>
              <select v-model="customPartType"><option value="Part">Part</option><option value="SpherePart">Sphere</option><option value="CylinderPart">Cylinder</option><option value="WedgePart">Wedge</option><option value="MeshPart">MeshPart</option><option value="Model">Model</option></select>
            </label>
            <label class="option-group"><span>Looping:</span>
              <select v-model="customLooping"><option :value="true">Yes</option><option :value="false">No</option></select>
            </label>
            <label class="option-group"><span>Duration (s):</span>
              <input type="number" v-model.number="customDuration" min="0.5" max="30" step="0.5" />
            </label>
          </div>
          <div v-if="customError" class="custom-error">⚠️ {{ customError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showCustomRequest = false">Cancel</button>
          <button class="btn-primary" @click="requestCustomAnimation" :disabled="customLoading || !customDescription.trim()">
            <span v-if="customLoading" class="spinner"></span>
            {{ customLoading ? 'Generating...' : 'Generate Animation' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════ -->
    <!-- ADMIN CREATE ANIMATION MODAL             -->
    <!-- ════════════════════════════════════════ -->
    <div v-if="showAdminCreate" class="modal-overlay" @click.self="showAdminCreate = false">
      <div class="modal-content wide-modal">
        <div class="modal-header"><h3>⚙️ Add Animation to Library</h3><button class="close-btn" @click="showAdminCreate = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Name</label><input v-model="adminForm.name" type="text" placeholder="Animation Name" /></div>
            <div class="form-group"><label>Category</label>
              <select v-model="adminForm.category">
                <option v-for="c in allCategories" :key="c" :value="c">{{ c }}</option>
                <option value="__new">+ New Category</option>
              </select>
            </div>
          </div>
          <div v-if="adminForm.category === '__new'" class="form-group">
            <label>New Category Name</label>
            <input v-model="adminForm.newCategory" type="text" placeholder="e.g. Physics" />
          </div>
          <div class="form-row">
            <div class="form-group"><label>Icon (emoji)</label><input v-model="adminForm.icon" type="text" placeholder="🎬" maxlength="4" /></div>
            <div class="form-group"><label>Duration (s)</label><input v-model.number="adminForm.duration" type="number" min="0.5" step="0.5" /></div>
            <div class="form-group"><label>Looping</label>
              <select v-model="adminForm.looping"><option :value="true">Yes</option><option :value="false">No</option></select>
            </div>
          </div>
          <div class="form-group"><label>Description</label><textarea v-model="adminForm.description" rows="2" placeholder="What does this animation do?"></textarea></div>
          <div class="form-group"><label>Best For</label><input v-model="adminForm.bestFor" type="text" placeholder="e.g. Floating platforms, coins" /></div>
          <div class="form-group"><label>Gradient Color</label><input v-model="adminForm.color" type="text" placeholder="linear-gradient(135deg, #667eea, #764ba2)" /></div>
          <div class="form-group"><label>Lua Code</label><textarea v-model="adminForm.luaCode" rows="10" class="code-textarea" placeholder="-- Paste Roblox Lua script here"></textarea></div>
          <div class="form-group">
            <label>Three.js Preview Params (JSON)</label>
            <textarea v-model="adminForm.threeAnimParamsJson" rows="3" class="code-textarea" placeholder='{"posY": "Math.sin(t) * 1.5 + 1.5", "rotY": "t"}'></textarea>
          </div>
          <div v-if="adminError" class="custom-error">⚠️ {{ adminError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showAdminCreate = false">Cancel</button>
          <button class="btn-primary" @click="adminSaveAnimation" :disabled="adminSaving">
            {{ adminSaving ? 'Saving...' : 'Save to Library' }}
          </button>
        </div>
      </div>
    </div>

    <!-- AI Design Modal -->
    <div v-if="showDesignAIModal" class="modal-overlay" @click.self="showDesignAIModal = false">
      <div class="modal-content">
        <div class="modal-header"><h3>🤖 AI Part Generator</h3><button class="close-btn" @click="showDesignAIModal = false">&times;</button></div>
        <div class="modal-body">
          <p class="modal-description">Describe the Roblox part you want to create. AI will generate the design.</p>
          <textarea v-model="designAIDescription" rows="3" class="custom-textarea" placeholder="Example: A glowing neon blue sphere with fire particles..."></textarea>
          <div v-if="designAIError" class="custom-error">⚠️ {{ designAIError }}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showDesignAIModal = false">Cancel</button>
          <button class="btn-primary" @click="executeDesignAI" :disabled="designAILoading || !designAIDescription.trim()">
            <span v-if="designAILoading" class="spinner"></span>
            {{ designAILoading ? 'Generating...' : 'Generate Design' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="toastMessage" class="toast" :class="toastType">{{ toastMessage }}</div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { robloxService, type RobloxAnimation, type RobloxDesign } from '@/services/roblox.service';
import { useAuthStore } from '@/store/auth';

interface CharacterDef { id: string; name: string; headColor: number; torsoColor: number; limbColor: number; }
interface AppStep { title: string; description: string; code?: string; }

const authStore = useAuthStore();
const isAdmin = computed(() => !!authStore.user?.is_admin);

// ─── State ───
const activeTool = ref<'animations' | 'design'>('animations');
const loadingAnimations = ref(false);
const allAnimations = ref<RobloxAnimation[]>([]);
const searchQuery = ref('');
const selectedCategory = ref('');
const currentAnim = ref<RobloxAnimation | null>(null);
const activeTab = ref('info');
const isPlaying = ref(true);
const animationSpeed = ref(1.0);
const copySuccess = ref(false);
const selectedCharacter = ref('default');
const toastMessage = ref('');
const toastType = ref('success');

// Custom animation
const showCustomRequest = ref(false);
const customDescription = ref('');
const customPartType = ref('Part');
const customLooping = ref(true);
const customDuration = ref(2);
const customLoading = ref(false);
const customError = ref('');

// Admin
const showAdminCreate = ref(false);
const adminSaving = ref(false);
const adminError = ref('');
const allCategories = ['Movement', 'Rotation', 'Scale', 'Color', 'Complex', 'Character', 'Physics', 'UI/FX'];
const adminForm = ref({
  name: '', category: 'Movement', newCategory: '', icon: '🎬', color: 'linear-gradient(135deg, #667eea, #764ba2)',
  description: '', bestFor: '', looping: true, duration: 2, luaCode: '', threeAnimParamsJson: '{}'
});

// Design tool
const designForm = ref({
  name: 'My Custom Part', description: '', partType: 'Part', shape: 'Block',
  size: { x: 4, y: 4, z: 4 }, color: '#4488ff', material: 'SmoothPlastic',
  transparency: 0, reflectance: 0, anchored: true, canCollide: true, luaCode: '', children: [] as any[], animations: [] as string[]
});
const savedDesigns = ref<RobloxDesign[]>([]);
const currentDesignId = ref<string | null>(null);
const savingDesign = ref(false);
const downloadingDesign = ref(false);
const showDesignAIModal = ref(false);
const designAIDescription = ref('');
const designAILoading = ref(false);
const designAIError = ref('');
const materials = ['SmoothPlastic', 'Brick', 'Wood', 'Metal', 'Grass', 'Ice', 'Neon', 'Glass', 'Marble', 'Concrete', 'Sand', 'Fabric', 'Pebble', 'DiamondPlate', 'ForceField'];

// Three.js – Animation scene
const threeContainer = ref<HTMLDivElement | null>(null);
let aScene: THREE.Scene | null = null;
let aCamera: THREE.PerspectiveCamera | null = null;
let aRenderer: THREE.WebGLRenderer | null = null;
let aControls: OrbitControls | null = null;
let aAnimFrame = 0;
let aClock: THREE.Clock | null = null;
let charGroup: THREE.Group | null = null;
let animSceneReady = false;
let currentAnimatorFn: ((g: THREE.Group, t: number, dt: number, s: number) => void) | null = null;

// Three.js – Design scene
const designThreeContainer = ref<HTMLDivElement | null>(null);
let dScene: THREE.Scene | null = null;
let dCamera: THREE.PerspectiveCamera | null = null;
let dRenderer: THREE.WebGLRenderer | null = null;
let dControls: OrbitControls | null = null;
let dAnimFrame = 0;
let dPartMesh: THREE.Mesh | null = null;
let designSceneReady = false;

const characters: CharacterDef[] = [
  { id: 'default', name: 'Classic Robloxian', headColor: 0xf5c542, torsoColor: 0x0057a8, limbColor: 0xf5c542 },
  { id: 'noob', name: 'Noob', headColor: 0xf5c542, torsoColor: 0x0057ff, limbColor: 0xf5c542 },
  { id: 'guest', name: 'Guest', headColor: 0xcccccc, torsoColor: 0x444444, limbColor: 0xcccccc },
  { id: 'robot', name: 'Robot', headColor: 0x888888, torsoColor: 0x555555, limbColor: 0x888888 },
  { id: 'zombie', name: 'Zombie', headColor: 0x7cba3f, torsoColor: 0x3d5c1e, limbColor: 0x7cba3f },
  { id: 'knight', name: 'Knight', headColor: 0xaaaaaa, torsoColor: 0x666666, limbColor: 0xaaaaaa },
  { id: 'alien', name: 'Alien', headColor: 0x44ff88, torsoColor: 0x227744, limbColor: 0x44ff88 },
];

// ─── Computed ───
const dynamicCategories = computed(() => {
  const cats = new Set(allAnimations.value.map(a => a.category));
  return Array.from(cats).sort();
});

const filteredAnimations = computed(() => {
  let list = allAnimations.value;
  if (selectedCategory.value) list = list.filter(a => a.category === selectedCategory.value);
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.bestFor.toLowerCase().includes(q));
  }
  return list;
});

const applicationSteps = computed<AppStep[]>(() => {
  if (!currentAnim.value) return [];
  return [
    { title: 'Open Roblox Studio', description: 'Open your game project in Roblox Studio.' },
    { title: 'Select or Create the Part', description: 'Select a Part in Explorer, or insert a new Part via Model tab → Part.' },
    { title: 'Anchor the Part', description: 'In Properties, check "Anchored".', code: '-- In Properties:\n-- Anchored = true' },
    { title: 'Insert a Script', description: 'Right-click the Part → Insert Object → Script.' },
    { title: 'Paste the Animation Code', description: 'Delete default code and paste the Lua code from the "Lua Code" tab.', code: currentAnim.value.luaCode },
    { title: 'Test the Animation', description: 'Press F5 (Play) to see the animation.' },
    { title: 'Customize (Optional)', description: 'Modify speed, distance, or colors in the script.' },
    { title: 'Stop & Save', description: 'Shift+F5 to stop, Ctrl+S to save.' }
  ];
});

const generatedDesignLua = computed(() => {
  const f = designForm.value;
  const hex = f.color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 68;
  const g = parseInt(hex.substring(2, 4), 16) || 136;
  const b = parseInt(hex.substring(4, 6), 16) || 255;
  let lua = `-- ${f.name} - Self Study Roblox Tool\nlocal part = Instance.new("Part")\npart.Name = "${f.name}"\n`;
  if (f.shape === 'Ball') lua += `part.Shape = Enum.PartType.Ball\n`;
  else if (f.shape === 'Cylinder') lua += `part.Shape = Enum.PartType.Cylinder\n`;
  lua += `part.Size = Vector3.new(${f.size.x}, ${f.size.y}, ${f.size.z})\npart.Position = Vector3.new(0, ${f.size.y / 2}, 0)\npart.Color = Color3.fromRGB(${r}, ${g}, ${b})\npart.Material = Enum.Material.${f.material}\npart.Transparency = ${f.transparency}\npart.Reflectance = ${f.reflectance}\npart.Anchored = ${f.anchored}\npart.CanCollide = ${f.canCollide}\npart.Parent = workspace\nprint("${f.name} created!")`;
  return lua;
});

// ─── Tool Switching ───
async function switchTool(tool: 'animations' | 'design') {
  activeTool.value = tool;
  await nextTick();

  if (tool === 'animations') {
    // Ensure the animation scene is properly attached and running
    ensureAnimScene();
  } else if (tool === 'design') {
    ensureDesignScene();
    await loadDesigns();
  }
}

// ─── Animation Three.js ───
function disposeAnimScene() {
  if (aAnimFrame) { cancelAnimationFrame(aAnimFrame); aAnimFrame = 0; }
  if (aRenderer) {
    aRenderer.dispose();
    if (aRenderer.domElement && aRenderer.domElement.parentNode) {
      aRenderer.domElement.parentNode.removeChild(aRenderer.domElement);
    }
    aRenderer = null;
  }
  if (aControls) { aControls.dispose(); aControls = null; }
  aScene = null;
  aCamera = null;
  charGroup = null;
  aClock = null;
  animSceneReady = false;
}

function ensureAnimScene() {
  if (!threeContainer.value) return;

  // If canvas is no longer in the container, rebuild everything
  if (aRenderer && aRenderer.domElement.parentNode !== threeContainer.value) {
    disposeAnimScene();
  }

  if (!animSceneReady) {
    initAnimScene();
  }
}

function initAnimScene() {
  if (!threeContainer.value) return;
  disposeAnimScene();

  aScene = new THREE.Scene();
  aScene.background = new THREE.Color(0x1a1a2e);

  aCamera = new THREE.PerspectiveCamera(50, threeContainer.value.clientWidth / threeContainer.value.clientHeight, 0.1, 100);
  aCamera.position.set(5, 4, 6);

  aRenderer = new THREE.WebGLRenderer({ antialias: true });
  aRenderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight);
  aRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  aRenderer.shadowMap.enabled = true;
  threeContainer.value.appendChild(aRenderer.domElement);

  aControls = new OrbitControls(aCamera, aRenderer.domElement);
  aControls.enableDamping = true;
  aControls.target.set(0, 1, 0);

  aScene.add(new THREE.AmbientLight(0x404060, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1);
  dl.position.set(5, 10, 5);
  dl.castShadow = true;
  aScene.add(dl);
  aScene.add(new THREE.PointLight(0x6366f1, 0.5, 20));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x16213e }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  aScene.add(ground);

  const grid = new THREE.GridHelper(20, 20, 0x333366, 0x222244);
  grid.position.y = 0.01;
  aScene.add(grid);

  charGroup = new THREE.Group();
  aScene.add(charGroup);
  buildCharacter(characters.find(c => c.id === selectedCharacter.value) || characters[0]);

  aClock = new THREE.Clock();
  animSceneReady = true;
  animateAnimScene();
}

function buildCharacter(c: CharacterDef) {
  if (!charGroup) return;
  while (charGroup.children.length) charGroup.remove(charGroup.children[0]);

  const hm = new THREE.MeshStandardMaterial({ color: c.headColor });
  const tm = new THREE.MeshStandardMaterial({ color: c.torsoColor });
  const lm = new THREE.MeshStandardMaterial({ color: c.limbColor });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.7), tm);
  torso.position.y = 2.2; torso.castShadow = true; charGroup.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), hm);
  head.position.y = 3.4; head.castShadow = true; charGroup.add(head);

  const eyeM = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const eyeG = new THREE.SphereGeometry(0.1, 8, 8);
  const le = new THREE.Mesh(eyeG, eyeM); le.position.set(-0.2, 3.45, 0.45); charGroup.add(le);
  const re = new THREE.Mesh(eyeG, eyeM); re.position.set(0.2, 3.45, 0.45); charGroup.add(re);

  const armG = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  const la = new THREE.Mesh(armG, lm); la.position.set(-1.05, 2.1, 0); la.castShadow = true; charGroup.add(la);
  const ra = new THREE.Mesh(armG, lm); ra.position.set(1.05, 2.1, 0); ra.castShadow = true; charGroup.add(ra);

  const legG = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  const ll = new THREE.Mesh(legG, lm); ll.position.set(-0.35, 0.8, 0); ll.castShadow = true; charGroup.add(ll);
  const rl = new THREE.Mesh(legG, lm); rl.position.set(0.35, 0.8, 0); rl.castShadow = true; charGroup.add(rl);
}

function updateCharacter() {
  const c = characters.find(x => x.id === selectedCharacter.value);
  if (c) buildCharacter(c);
}

function animateAnimScene() {
  if (!animSceneReady || !aScene || !aCamera || !aRenderer || !aClock) return;
  aAnimFrame = requestAnimationFrame(animateAnimScene);

  const dt = aClock.getDelta();
  const t = aClock.getElapsedTime();
  if (aControls) aControls.update();

  if (currentAnim.value && isPlaying.value && currentAnimatorFn && charGroup) {
    charGroup.position.set(0, 0, 0);
    charGroup.rotation.set(0, 0, 0);
    charGroup.scale.set(1, 1, 1);
    try {
      currentAnimatorFn(charGroup, t, dt, animationSpeed.value);
    } catch {
      charGroup.position.y = Math.sin(t) * 0.5 + 0.5;
    }
  }

  aRenderer.render(aScene, aCamera);
}

function resetTransforms() {
  if (!charGroup) return;
  charGroup.position.set(0, 0, 0);
  charGroup.rotation.set(0, 0, 0);
  charGroup.scale.set(1, 1, 1);
  charGroup.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m) { m.opacity = 1; m.transparent = false; }
    }
  });
}

function togglePlay() { isPlaying.value = !isPlaying.value; if (isPlaying.value && aClock) aClock.start(); }
function resetAnimation() { aClock = new THREE.Clock(); isPlaying.value = true; resetTransforms(); }

// ─── Design Three.js ───
function disposeDesignScene() {
  if (dAnimFrame) { cancelAnimationFrame(dAnimFrame); dAnimFrame = 0; }
  if (dRenderer) {
    dRenderer.dispose();
    if (dRenderer.domElement && dRenderer.domElement.parentNode) {
      dRenderer.domElement.parentNode.removeChild(dRenderer.domElement);
    }
    dRenderer = null;
  }
  if (dControls) { dControls.dispose(); dControls = null; }
  dScene = null;
  dCamera = null;
  dPartMesh = null;
  designSceneReady = false;
}

function ensureDesignScene() {
  if (!designThreeContainer.value) return;
  if (dRenderer && dRenderer.domElement.parentNode !== designThreeContainer.value) {
    disposeDesignScene();
  }
  if (!designSceneReady) {
    initDesignScene();
  }
}

function initDesignScene() {
  if (!designThreeContainer.value) return;
  disposeDesignScene();

  dScene = new THREE.Scene();
  dScene.background = new THREE.Color(0x1a1a2e);

  dCamera = new THREE.PerspectiveCamera(50, designThreeContainer.value.clientWidth / designThreeContainer.value.clientHeight, 0.1, 100);
  dCamera.position.set(6, 5, 6);

  dRenderer = new THREE.WebGLRenderer({ antialias: true });
  dRenderer.setSize(designThreeContainer.value.clientWidth, designThreeContainer.value.clientHeight);
  dRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  designThreeContainer.value.appendChild(dRenderer.domElement);

  dControls = new OrbitControls(dCamera, dRenderer.domElement);
  dControls.enableDamping = true;
  dControls.target.set(0, 2, 0);

  dScene.add(new THREE.AmbientLight(0x404060, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 1);
  dl.position.set(5, 10, 5);
  dScene.add(dl);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x16213e }));
  ground.rotation.x = -Math.PI / 2;
  dScene.add(ground);

  const grid = new THREE.GridHelper(20, 20, 0x333366, 0x222244);
  grid.position.y = 0.01;
  dScene.add(grid);

  designSceneReady = true;
  updateDesignPreview();
  animateDesignScene();
}

function updateDesignPreview() {
  if (!dScene) return;
  if (dPartMesh) {
    dScene.remove(dPartMesh);
    dPartMesh.geometry.dispose();
    (dPartMesh.material as THREE.Material).dispose();
    dPartMesh = null;
  }
  const f = designForm.value;
  let geo: THREE.BufferGeometry;
  if (f.shape === 'Ball') geo = new THREE.SphereGeometry(Math.max(f.size.x, f.size.y, f.size.z) / 2, 32, 32);
  else if (f.shape === 'Cylinder') geo = new THREE.CylinderGeometry(f.size.x / 2, f.size.x / 2, f.size.y, 32);
  else geo = new THREE.BoxGeometry(f.size.x, f.size.y, f.size.z);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(f.color), opacity: 1 - f.transparency, transparent: f.transparency > 0,
    roughness: f.material === 'Glass' ? 0.1 : f.material === 'Metal' ? 0.3 : 0.6,
    metalness: f.material === 'Metal' || f.material === 'DiamondPlate' ? 0.8 : 0.1,
  });
  if (f.material === 'Neon') { mat.emissive = new THREE.Color(f.color); mat.emissiveIntensity = 0.5; }
  dPartMesh = new THREE.Mesh(geo, mat);
  dPartMesh.position.y = f.size.y / 2 + 0.01;
  dPartMesh.castShadow = true;
  dScene.add(dPartMesh);
}

function animateDesignScene() {
  if (!designSceneReady || !dScene || !dCamera || !dRenderer) return;
  dAnimFrame = requestAnimationFrame(animateDesignScene);
  if (dControls) dControls.update();
  if (dPartMesh) dPartMesh.rotation.y += 0.005;
  dRenderer.render(dScene, dCamera);
}

// ─── Load Data ───
async function loadAnimations() {
  loadingAnimations.value = true;
  try {
    allAnimations.value = await robloxService.getAnimations();
  } catch (e: any) {
    console.error('Failed to load animations:', e);
    showToast('Failed to load animations: ' + (e.message || 'Network error'), 'error');
  } finally {
    loadingAnimations.value = false;
  }
}

async function loadDesigns() {
  if (!authStore.user?.id) return;
  try {
    savedDesigns.value = await robloxService.getDesigns(authStore.user.id);
  } catch (e) { console.warn('Failed to load designs:', e); }
}

// ─── Animation Selection ───
function selectAnimation(anim: RobloxAnimation) {
  currentAnim.value = anim;
  activeTab.value = 'info';
  isPlaying.value = true;
  currentAnimatorFn = buildAnimator(anim.threeAnimParams || {});
  resetTransforms();
}

function buildAnimator(params: Record<string, string>): (g: THREE.Group, t: number, dt: number, s: number) => void {
  if (!params || Object.keys(params).length === 0) {
    return (g, t, _dt, s) => { g.position.y = Math.sin(t * s) * 1.5 + 1.5; g.rotation.y = t * s; };
  }
  const fns: Record<string, ((t: number, M: Math) => number) | null> = {};
  for (const key of ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scaleX', 'scaleY', 'scaleZ', 'colorHue']) {
    if (params[key]) {
      try {
        fns[key] = new Function('t', 'Math', `"use strict"; try { return (${params[key]}); } catch(e) { return 0; }`) as any;
      } catch { fns[key] = null; }
    }
  }
  return (g, t, _dt, s) => {
    const ts = t * s;
    try {
      if (fns.posX) g.position.x = (fns.posX as any)(ts, Math) || 0;
      if (fns.posY) g.position.y = (fns.posY as any)(ts, Math) || 0;
      if (fns.posZ) g.position.z = (fns.posZ as any)(ts, Math) || 0;
      if (fns.rotX) g.rotation.x = (fns.rotX as any)(ts, Math) || 0;
      if (fns.rotY) g.rotation.y = (fns.rotY as any)(ts, Math) || 0;
      if (fns.rotZ) g.rotation.z = (fns.rotZ as any)(ts, Math) || 0;
      if (fns.scaleX) {
        const sx = Math.max(0.01, (fns.scaleX as any)(ts, Math) || 1);
        const sy = fns.scaleY ? Math.max(0.01, (fns.scaleY as any)(ts, Math) || sx) : sx;
        const sz = fns.scaleZ ? Math.max(0.01, (fns.scaleZ as any)(ts, Math) || sx) : sx;
        g.scale.set(sx, sy, sz);
      }
      if (fns.colorHue) {
        const hue = Math.abs(((fns.colorHue as any)(ts, Math) || 0) % 1);
        const color = new THREE.Color().setHSL(hue, 1, 0.5);
        g.traverse((c) => { if ((c as THREE.Mesh).isMesh) { ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).color = color; } });
      }
    } catch { g.position.y = Math.sin(ts) * 1 + 1; g.rotation.y = ts * 0.5; }
  };
}

// ─── Custom AI Animation ───
async function requestCustomAnimation() {
  if (!customDescription.value.trim()) return;
  customLoading.value = true;
  customError.value = '';
  try {
    const result = await robloxService.generateAnimation({
      description: customDescription.value, partType: customPartType.value, looping: customLooping.value, duration: customDuration.value
    });
    if (!result || !result.luaCode) { customError.value = 'AI returned incomplete result'; return; }
    const newAnim: RobloxAnimation = {
      id: 'custom-' + Date.now(), name: result.name || 'Custom Animation', category: 'Custom', icon: '🤖',
      color: 'linear-gradient(135deg, #6366f1, #a855f7)', description: result.description || customDescription.value,
      bestFor: 'Custom animation', looping: customLooping.value, duration: customDuration.value,
      luaCode: result.luaCode, threeAnimParams: result.threeAnimParams || {},
      created_by: 'ai', created_at: new Date().toISOString()
    };
    if (isAdmin.value) {
      try {
        const resp = await robloxService.createAnimation({ ...newAnim, created_by: 'admin', created_by_username: authStore.user?.username || '' } as any);
        newAnim.id = resp.animation.id;
        allAnimations.value.push(resp.animation);
      } catch { allAnimations.value.push(newAnim); }
    } else {
      allAnimations.value.push(newAnim);
    }
    selectAnimation(newAnim);
    showCustomRequest.value = false;
    customDescription.value = '';
    showToast('Custom animation generated!', 'success');
  } catch (e: any) { customError.value = e.message || 'Failed to generate'; }
  finally { customLoading.value = false; }
}

// ─── Admin CRUD ───
async function adminSaveAnimation() {
  const f = adminForm.value;
  if (!f.name || !f.luaCode) { adminError.value = 'Name and Lua code are required'; return; }
  adminSaving.value = true;
  adminError.value = '';
  const category = f.category === '__new' ? (f.newCategory || 'Custom') : f.category;
  let params = {};
  try { params = JSON.parse(f.threeAnimParamsJson || '{}'); } catch { adminError.value = 'Invalid JSON for preview params'; adminSaving.value = false; return; }
  try {
    const resp = await robloxService.createAnimation({
      name: f.name, category, icon: f.icon || '🎬', color: f.color, description: f.description,
      bestFor: f.bestFor, looping: f.looping, duration: f.duration, luaCode: f.luaCode,
      threeAnimParams: params, created_by: 'admin', created_by_username: authStore.user?.username || ''
    } as any);
    allAnimations.value.push(resp.animation);
    showAdminCreate.value = false;
    showToast('Animation added to library!', 'success');
    adminForm.value = { name: '', category: 'Movement', newCategory: '', icon: '🎬', color: 'linear-gradient(135deg, #667eea, #764ba2)', description: '', bestFor: '', looping: true, duration: 2, luaCode: '', threeAnimParamsJson: '{}' };
  } catch (e: any) { adminError.value = e.message || 'Failed to save'; }
  finally { adminSaving.value = false; }
}

async function deleteAnimationAdmin(id: string) {
  if (!confirm('Delete this animation from the library?')) return;
  try {
    await robloxService.deleteAnimation(id);
    allAnimations.value = allAnimations.value.filter(a => a.id !== id);
    if (currentAnim.value?.id === id) currentAnim.value = null;
    showToast('Animation deleted', 'success');
  } catch (e: any) { showToast('Failed to delete: ' + e.message, 'error'); }
}

// ─── Design Tool ───
async function saveDesignToBackend() {
  if (!authStore.user?.id) { showToast('Please log in', 'error'); return; }
  savingDesign.value = true;
  try {
    const payload = { ...designForm.value, user_id: authStore.user.id, username: authStore.user.username || '' };
    if (currentDesignId.value) {
      await robloxService.updateDesign(currentDesignId.value, payload, authStore.user.id);
      showToast('Design updated!', 'success');
    } else {
      const resp = await robloxService.saveDesign(payload as any);
      currentDesignId.value = resp.id;
      showToast('Design saved!', 'success');
    }
    await loadDesigns();
  } catch (e: any) { showToast('Failed to save: ' + e.message, 'error'); }
  finally { savingDesign.value = false; }
}

function loadDesign(d: RobloxDesign) {
  currentDesignId.value = d.id;
  designForm.value = {
    name: d.name, description: d.description, partType: d.partType, shape: d.shape,
    size: { ...d.size }, color: d.color, material: d.material, transparency: d.transparency,
    reflectance: d.reflectance, anchored: d.anchored, canCollide: d.canCollide,
    luaCode: d.luaCode, children: [...d.children], animations: [...d.animations]
  };
  updateDesignPreview();
}

async function downloadCurrentDesign() {
  if (!currentDesignId.value) return;
  downloadingDesign.value = true;
  try { await robloxService.downloadDesign(currentDesignId.value); showToast('Download started!', 'success'); }
  catch (e: any) { showToast('Download failed: ' + e.message, 'error'); }
  finally { downloadingDesign.value = false; }
}

async function downloadDesignById(id: string) {
  try { await robloxService.downloadDesign(id); } catch { showToast('Download failed', 'error'); }
}

async function deleteDesignById(id: string) {
  if (!confirm('Delete this design?')) return;
  try {
    await robloxService.deleteDesign(id, authStore.user?.id);
    savedDesigns.value = savedDesigns.value.filter(d => d.id !== id);
    if (currentDesignId.value === id) currentDesignId.value = null;
    showToast('Design deleted', 'success');
  } catch (e: any) { showToast('Failed: ' + e.message, 'error'); }
}

function generateDesignAI() { showDesignAIModal.value = true; designAIDescription.value = ''; designAIError.value = ''; }

async function executeDesignAI() {
  if (!designAIDescription.value.trim()) return;
  designAILoading.value = true;
  designAIError.value = '';
  try {
    const result = await robloxService.generateDesign({ description: designAIDescription.value });
    if (result) {
      designForm.value = {
        name: result.name || 'AI Part', description: result.description || designAIDescription.value,
        partType: result.partType || 'Part', shape: result.shape || 'Block',
        size: result.size || { x: 4, y: 4, z: 4 }, color: result.color || '#4488ff',
        material: result.material || 'SmoothPlastic', transparency: result.transparency || 0,
        reflectance: result.reflectance || 0, anchored: result.anchored !== false, canCollide: result.canCollide !== false,
        luaCode: result.luaCode || '', children: result.children || [], animations: []
      };
      currentDesignId.value = null;
      updateDesignPreview();
      showDesignAIModal.value = false;
      showToast('Design generated!', 'success');
    }
  } catch (e: any) { designAIError.value = e.message || 'Failed'; }
  finally { designAILoading.value = false; }
}

// ─── Utils ───
async function copyCode() {
  if (!currentAnim.value) return;
  try { await navigator.clipboard.writeText(currentAnim.value.luaCode); copySuccess.value = true; showToast('Lua code copied!', 'success'); setTimeout(() => { copySuccess.value = false; }, 2000); } catch { showToast('Copy failed', 'error'); }
}
async function copyText(text: string) { try { await navigator.clipboard.writeText(text); showToast('Copied!', 'success'); } catch { showToast('Copy failed', 'error'); } }
async function copyDesignCode() { try { await navigator.clipboard.writeText(generatedDesignLua.value); showToast('Design code copied!', 'success'); } catch { showToast('Copy failed', 'error'); } }
function showToast(msg: string, type: string = 'success') { toastMessage.value = msg; toastType.value = type; setTimeout(() => { toastMessage.value = ''; }, 3000); }

function onResize() {
  if (threeContainer.value && aRenderer && aCamera) {
    aCamera.aspect = threeContainer.value.clientWidth / threeContainer.value.clientHeight;
    aCamera.updateProjectionMatrix();
    aRenderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight);
  }
  if (designThreeContainer.value && dRenderer && dCamera) {
    dCamera.aspect = designThreeContainer.value.clientWidth / designThreeContainer.value.clientHeight;
    dCamera.updateProjectionMatrix();
    dRenderer.setSize(designThreeContainer.value.clientWidth, designThreeContainer.value.clientHeight);
  }
}

// ─── Watchers ───
watch(() => designForm.value, () => { if (designSceneReady) updateDesignPreview(); }, { deep: true });

// ─── Lifecycle ───
onMounted(async () => {
  await nextTick();
  initAnimScene();
  await loadAnimations();
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  disposeAnimScene();
  disposeDesignScene();
});
</script>

<style src="@/assets/css/roblox-tool.css"></style>