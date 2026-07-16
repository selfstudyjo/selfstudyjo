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
            <button :class="['tool-tab-btn',{active:activeTool==='animations'}]" @click="switchTool('animations')">🎬 Animations</button>
            <button :class="['tool-tab-btn',{active:activeTool==='design'}]" @click="switchTool('design')">🎨 Part Designer</button>
          </div>
          <template v-if="activeTool==='animations'">
            <button class="btn-secondary" @click="showCustomRequest=true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              Custom Animation
            </button>
            <button v-if="isAdmin" class="btn-secondary admin-btn" @click="showAdminCreate=true">⚙️ Add Animation</button>
            <select v-model="selectedCharacter" class="character-select" @change="updateCharacter">
              <option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ ANIMATIONS TAB ═══ -->
    <div v-show="activeTool==='animations'" class="roblox-content">
      <div class="animations-panel">
        <div class="panel-header">
          <h2>Animations <span class="count">({{ filteredSystemAnims.length + filteredMyAnims.length }})</span></h2>
          <div v-if="loadingAnimations" class="loading-bar">Loading…</div>
          <div class="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <input v-model="searchQuery" type="text" placeholder="Search…" class="search-input"/>
          </div>
          <div class="filter-tags">
            <button v-for="cat in dynamicCategories" :key="cat" :class="['filter-tag',{active:selectedCategory===cat}]" @click="selectedCategory=selectedCategory===cat?'':cat">{{ cat }}</button>
          </div>
        </div>

        <!-- My Animations -->
        <template v-if="filteredMyAnims.length">
          <div class="section-divider"><h3>🤖 My Animations</h3><span class="section-count">{{ filteredMyAnims.length }}</span></div>
          <div class="animations-grid">
            <div v-for="a in filteredMyAnims" :key="a.id" :class="['animation-card',{selected:currentAnim?.id===a.id}]" @click="selectAnimation(a)">
              <div class="card-preview" :style="{background:a.color||'#333'}"><span>{{ a.icon||'🤖' }}</span></div>
              <div class="card-info"><h4>{{ a.name }}</h4><span class="card-category">{{ a.category }}</span><span class="card-badge mine">Mine</span><button class="card-delete" @click.stop="deleteMyAnimation(a.id)">✕</button></div>
            </div>
          </div>
        </template>

        <!-- Library -->
        <div class="section-divider"><h3>📚 Library</h3><span class="section-count">{{ filteredSystemAnims.length }}</span></div>
        <div class="animations-grid">
          <div v-for="a in filteredSystemAnims" :key="a.id" :class="['animation-card',{selected:currentAnim?.id===a.id}]" @click="selectAnimation(a)">
            <div class="card-preview" :style="{background:a.color||'#333'}"><span>{{ a.icon||'🎬' }}</span></div>
            <div class="card-info"><h4>{{ a.name }}</h4><span class="card-category">{{ a.category }}</span><button v-if="isAdmin&&a.created_by!=='system'" class="card-delete" @click.stop="deleteAnimationAdmin(a.id)">✕</button></div>
          </div>
          <div v-if="!loadingAnimations&&!filteredSystemAnims.length" class="empty-grid"><p>No animations found</p></div>
        </div>
      </div>

      <!-- Preview -->
      <div class="preview-panel">
        <div class="preview-section">
          <div class="preview-header">
            <h3>{{ currentAnim?currentAnim.name:'Select an Animation' }}</h3>
            <div v-if="currentAnim" class="preview-controls">
              <button class="ctrl-btn" @click="togglePlay" :title="isPlaying?'Pause':'Play'">
                <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              </button>
              <button class="ctrl-btn" @click="resetAnimation"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg></button>
              <div class="speed-control"><label>Speed:</label><input type="range" min="0.1" max="3" step="0.1" v-model.number="animSpeed"/><span>{{ animSpeed.toFixed(1) }}x</span></div>
            </div>
          </div>
          <div ref="threeContainer" class="three-container">
            <div v-if="!currentAnim" class="placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z"/></svg><p>Select an animation to preview</p></div>
          </div>
        </div>

        <div v-if="currentAnim" class="details-section">
          <div class="details-tabs">
            <button :class="['tab',{active:activeTab==='info'}]" @click="activeTab='info'">Info</button>
            <button :class="['tab',{active:activeTab==='code'}]" @click="activeTab='code'">Lua Code</button>
            <button :class="['tab',{active:activeTab==='steps'}]" @click="activeTab='steps'">How to Apply</button>
          </div>
          <div v-if="activeTab==='info'" class="tab-content">
            <div class="info-grid">
              <div class="info-item"><label>Animation</label><span>{{ currentAnim.name }}</span></div>
              <div class="info-item"><label>Category</label><span>{{ currentAnim.category }}</span></div>
              <div class="info-item"><label>Type</label><span>{{ currentAnim.looping?'Looping':'One-shot' }}</span></div>
              <div class="info-item"><label>Duration</label><span>{{ currentAnim.duration }}s</span></div>
              <div class="info-item full-width"><label>Description</label><span>{{ currentAnim.description }}</span></div>
              <div class="info-item full-width"><label>Best For</label><span>{{ currentAnim.bestFor }}</span></div>
            </div>
          </div>
          <div v-if="activeTab==='code'" class="tab-content">
            <div class="code-header"><span class="code-lang">Lua</span><button class="copy-btn" @click="copyCode">{{ copySuccess?'Copied!':'Copy Code' }}</button></div>
            <pre class="code-block"><code>{{ currentAnim.luaCode }}</code></pre>
          </div>
          <div v-if="activeTab==='steps'" class="tab-content">
            <div class="steps-list">
              <div class="step" v-for="(s,i) in appSteps" :key="i"><div class="step-number">{{ i+1 }}</div><div class="step-content"><h4>{{ s.title }}</h4><p>{{ s.description }}</p><pre v-if="s.code" class="step-code"><code>{{ s.code }}</code></pre></div></div>
            </div>
          </div>
        </div>
        <div v-else class="empty-details"><div class="empty-details-content"><h3>Select an Animation</h3><p>Choose from the library or create with AI.</p></div></div>
      </div>
    </div>

    <!-- ═══ DESIGN TAB ═══ -->
    <div v-show="activeTool==='design'" class="roblox-content design-content">
      <div class="design-panel-left">
        <div class="panel-header"><h2>Part Designer</h2><button class="btn-secondary" @click="openDesignAI">🤖 AI Generate</button></div>

        <div class="design-form">
          <div class="form-group"><label>Model Name</label><input v-model="designName" type="text" placeholder="My Model"/></div>
          <div class="form-group"><label>Description</label><textarea v-model="designDesc" rows="2" placeholder="Describe…"></textarea></div>
          <div class="form-group"><label>Global Behavior Script (Lua)</label><textarea v-model="designLua" rows="2" class="code-textarea" placeholder="-- Optional"></textarea></div>
          <div class="form-group"><label>Model Animation Script (Lua)</label><textarea v-model="modelAnimScript" rows="2" class="code-textarea" placeholder="-- Animate the whole model"></textarea></div>

          <!-- Animation picker for model -->
          <div class="anim-picker-section">
            <label>🎬 Model Animation (from library)</label>
            <div class="anim-picker-row">
              <select v-model="modelAnimPick" @change="applyModelAnim">
                <option value="">-- None --</option>
                <optgroup label="Library"><option v-for="a in allSystemAnimations" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option></optgroup>
                <optgroup v-if="myAnimations.length" label="My Animations"><option v-for="a in myAnimations" :key="'m'+a.id" :value="'my-'+a.id">🤖 {{ a.name }}</option></optgroup>
              </select>
              <button v-if="modelAnimScript" class="anim-clear-btn" @click="modelAnimScript='';modelAnimPick=''">Clear</button>
            </div>
          </div>
        </div>

        <!-- Parts Tree -->
        <div class="parts-list-section">
          <div class="parts-list-header"><h3>Parts Tree ({{ totalPartCount }})</h3><button class="btn-secondary btn-sm" @click="addRootPart">+ Root Part</button></div>
          <div class="parts-list">
            <div v-for="fp in flatPartsList" :key="fp.part._uid"
                 :class="['part-list-item',{active:selectedUid===fp.part._uid}]"
                 :style="{paddingLeft:(12+fp.depth*20)+'px'}"
                 @click="selectedUid=fp.part._uid||''">
              <!-- Expand/collapse toggle -->
              <button v-if="fp.part.children&&fp.part.children.length" class="tree-toggle" @click.stop="fp.part._expanded=!fp.part._expanded">
                {{ fp.part._expanded ? '▼' : '▶' }}
              </button>
              <span v-else class="tree-spacer"></span>
              <div class="part-list-color" :style="{background:fp.part.color}"></div>
              <div class="part-list-info">
                <strong>{{ fp.part.name }}
                  <span v-if="fp.part.animationScript" class="part-anim-indicator">🎬</span>
                  <span v-if="fp.part.killOnTouch" class="part-kill-indicator">💀</span>
                  <span v-if="fp.part.children&&fp.part.children.length" class="part-child-count">({{ fp.part.children.length }})</span>
                </strong>
                <span>{{ fp.part.shape }} · {{ fp.part.material }}</span>
              </div>
              <div class="part-list-actions">
                <button class="mini-btn" @click.stop="addChildPart(fp.part)" title="Add child">+</button>
                <button class="mini-btn danger" @click.stop="removePart(fp.part._uid||'')" title="Remove">✕</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Selected Part Editor -->
        <div v-if="editPart" class="part-editor">
          <h3>Edit: {{ editPart.name }}</h3>
          <div class="form-group"><label>Name</label><input v-model="editPart.name" type="text"/></div>
          <div class="form-row">
            <div class="form-group"><label>Shape</label><select v-model="editPart.shape"><option v-for="s in shapes" :key="s" :value="s">{{ s }}</option></select></div>
            <div class="form-group"><label>Material</label><select v-model="editPart.material"><option v-for="m in materialList" :key="m" :value="m">{{ m }}</option></select></div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Size X</label><input v-model.number="editPart.size.x" type="number" min="0.1" step="0.5"/></div>
            <div class="form-group"><label>Size Y</label><input v-model.number="editPart.size.y" type="number" min="0.1" step="0.5"/></div>
            <div class="form-group"><label>Size Z</label><input v-model.number="editPart.size.z" type="number" min="0.1" step="0.5"/></div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Pos X</label><input v-model.number="editPart.position.x" type="number" step="0.5"/></div>
            <div class="form-group"><label>Pos Y</label><input v-model.number="editPart.position.y" type="number" step="0.5"/></div>
            <div class="form-group"><label>Pos Z</label><input v-model.number="editPart.position.z" type="number" step="0.5"/></div>
          </div>
          <div class="form-row triple">
            <div class="form-group"><label>Rot X°</label><input v-model.number="editPart.rotation.x" type="number" step="5"/></div>
            <div class="form-group"><label>Rot Y°</label><input v-model.number="editPart.rotation.y" type="number" step="5"/></div>
            <div class="form-group"><label>Rot Z°</label><input v-model.number="editPart.rotation.z" type="number" step="5"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Color</label><input v-model="editPart.color" type="color"/></div>
            <div class="form-group"><label>Transparency</label><input v-model.number="editPart.transparency" type="range" min="0" max="1" step="0.05"/><span class="range-val">{{ editPart.transparency.toFixed(2) }}</span></div>
          </div>
          <div class="form-row">
            <label class="checkbox-label"><input type="checkbox" v-model="editPart.anchored"/> Anchored</label>
            <label class="checkbox-label"><input type="checkbox" v-model="editPart.canCollide"/> CanCollide</label>
          </div>
          <div class="form-row">
            <label class="checkbox-label kill-label"><input type="checkbox" v-model="editPart.killOnTouch"/> 💀 Kill Player on Touch</label>
          </div>

          <!-- Per-part animation picker -->
          <div class="anim-picker-section">
            <label>🎬 Part Animation</label>
            <div class="anim-picker-row">
              <select v-model="partAnimPick" @change="applyPartAnim">
                <option value="">-- None --</option>
                <optgroup label="Library"><option v-for="a in allSystemAnimations" :key="a.id" :value="a.id">{{ a.icon }} {{ a.name }}</option></optgroup>
                <optgroup v-if="myAnimations.length" label="My Animations"><option v-for="a in myAnimations" :key="'m'+a.id" :value="'my-'+a.id">🤖 {{ a.name }}</option></optgroup>
              </select>
              <button v-if="editPart.animationScript" class="anim-clear-btn" @click="editPart.animationScript='';partAnimPick=''">Clear</button>
            </div>
            <details v-if="editPart.animationScript" class="anim-script-preview">
              <summary>View script</summary>
              <pre>{{ editPart.animationScript }}</pre>
            </details>
          </div>
        </div>

        <!-- Actions -->
        <div class="design-actions">
          <button class="btn-primary" @click="saveDesignToBackend" :disabled="savingDesign">{{ savingDesign?'Saving…':'💾 Save' }}</button>
          <button v-if="currentDesignId" class="btn-secondary" @click="downloadZip">📦 ZIP</button>
          <button v-if="currentDesignId" class="btn-secondary" @click="downloadRbxm">📥 RBXM</button>
          <button v-if="currentDesignId" class="btn-secondary" @click="downloadLua">📄 Lua</button>
          <button class="btn-secondary" @click="resetDesign">🔄 New</button>
        </div>

        <!-- Saved -->
        <div v-if="savedDesigns.length" class="saved-designs">
          <h3>My Saved Designs</h3>
          <div class="design-list">
            <div v-for="d in savedDesigns" :key="d.id" :class="['design-list-item',{active:currentDesignId===d.id}]" @click="loadDesign(d)">
              <div class="design-list-info"><strong>{{ d.name }}</strong><span>{{ countParts(d.parts) }} parts</span></div>
              <div class="design-list-actions">
                <button class="mini-btn" @click.stop="downloadDesignById(d.id,'rbxm')">📥</button>
                <button class="mini-btn danger" @click.stop="deleteDesignById(d.id)">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: 3D + Code -->
      <div class="design-panel-right">
        <div class="preview-header"><h3>{{ designName||'Preview' }} <span class="count">({{ totalPartCount }} parts)</span></h3></div>
        <div ref="designThreeContainer" class="three-container design-three"></div>
        <div class="design-info-panel">
          <div class="details-tabs">
            <button :class="['tab',{active:designTab==='lua'}]" @click="designTab='lua'">Lua Code</button>
            <button :class="['tab',{active:designTab==='steps'}]" @click="designTab='steps'">How to Import</button>
          </div>
          <div v-if="designTab==='lua'" class="tab-content">
            <div class="code-header"><span class="code-lang">Lua</span><button class="copy-btn" @click="copyText(generatedDesignLua)">Copy</button></div>
            <pre class="code-block design-code"><code>{{ generatedDesignLua }}</code></pre>
          </div>
          <div v-if="designTab==='steps'" class="tab-content">
            <div class="steps-list">
              <div class="step"><div class="step-number">1</div><div class="step-content"><h4>Import RBXM (Recommended)</h4><p>Save → 📥 RBXM → In Studio: File → Import from File → select .rbxm. All parts, scripts, kill zones, animations included.</p></div></div>
              <div class="step"><div class="step-number">2</div><div class="step-content"><h4>Lua Script</h4><p>📄 Lua → paste into ServerScriptService Script → F5 to create → stop, delete script, save.</p></div></div>
              <div class="step"><div class="step-number">3</div><div class="step-content"><h4>ZIP Package</h4><p>📦 ZIP → contains RBXM + Lua + README.</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ MODALS ═══ -->
    <!-- Custom Animation -->
    <div v-if="showCustomRequest" class="modal-overlay" @click.self="showCustomRequest=false">
      <div class="modal-content">
        <div class="modal-header"><h3>Custom Animation</h3><button class="close-btn" @click="showCustomRequest=false">&times;</button></div>
        <div class="modal-body">
          <p class="modal-description">Describe the animation. AI generates the Lua code and saves to your library.</p>
          <textarea v-model="customDesc" placeholder="A part that spins while bobbing up and down…" rows="4" class="custom-textarea"></textarea>
          <div class="custom-options">
            <label class="option-group"><span>Part:</span><select v-model="customPartType"><option value="Part">Part</option><option value="SpherePart">Sphere</option><option value="CylinderPart">Cylinder</option></select></label>
            <label class="option-group"><span>Loop:</span><select v-model="customLooping"><option :value="true">Yes</option><option :value="false">No</option></select></label>
            <label class="option-group"><span>Duration:</span><input type="number" v-model.number="customDuration" min="0.5" max="30" step="0.5"/></label>
          </div>
          <div v-if="customError" class="custom-error">⚠️ {{ customError }}</div>
        </div>
        <div class="modal-footer"><button class="btn-secondary" @click="showCustomRequest=false">Cancel</button><button class="btn-primary" @click="requestCustomAnim" :disabled="customLoading||!customDesc.trim()"><span v-if="customLoading" class="spinner"></span>{{ customLoading?'Generating…':'Generate' }}</button></div>
      </div>
    </div>

    <!-- Admin Create -->
    <div v-if="showAdminCreate" class="modal-overlay" @click.self="showAdminCreate=false">
      <div class="modal-content wide-modal">
        <div class="modal-header"><h3>⚙️ Add to Library</h3><button class="close-btn" @click="showAdminCreate=false">&times;</button></div>
        <div class="modal-body">
          <div class="form-row"><div class="form-group"><label>Name</label><input v-model="admF.name" type="text"/></div><div class="form-group"><label>Category</label><select v-model="admF.category"><option v-for="c in allCats" :key="c" :value="c">{{ c }}</option></select></div></div>
          <div class="form-row"><div class="form-group"><label>Icon</label><input v-model="admF.icon" type="text" maxlength="4"/></div><div class="form-group"><label>Duration</label><input v-model.number="admF.duration" type="number" min="0.5" step="0.5"/></div></div>
          <div class="form-group"><label>Description</label><textarea v-model="admF.description" rows="2"></textarea></div>
          <div class="form-group"><label>Best For</label><input v-model="admF.bestFor" type="text"/></div>
          <div class="form-group"><label>Lua Code</label><textarea v-model="admF.luaCode" rows="8" class="code-textarea"></textarea></div>
          <div class="form-group"><label>Preview Params JSON</label><textarea v-model="admF.paramsJson" rows="3" class="code-textarea" placeholder='{"type":"spin","axis":"y","speed":2}'></textarea></div>
          <div v-if="admError" class="custom-error">⚠️ {{ admError }}</div>
        </div>
        <div class="modal-footer"><button class="btn-secondary" @click="showAdminCreate=false">Cancel</button><button class="btn-primary" @click="adminSave" :disabled="admSaving">{{ admSaving?'Saving…':'Save' }}</button></div>
      </div>
    </div>

    <!-- AI Design -->
    <div v-if="showDesignAI" class="modal-overlay" @click.self="showDesignAI=false">
      <div class="modal-content">
        <div class="modal-header"><h3>🤖 AI Part Generator</h3><button class="close-btn" @click="showDesignAI=false">&times;</button></div>
        <div class="modal-body">
          <p class="modal-description">Describe what to build. AI creates it with hierarchy (root + children), proper shapes and materials. All parts anchored.</p>
          <textarea v-model="dAIDesc" rows="4" class="custom-textarea" placeholder="e.g. a red sports car with wheels, headlights, spoiler&#10;e.g. a medieval castle tower with windows&#10;e.g. a glowing sword"></textarea>
          <div v-if="dAIError" class="custom-error">⚠️ {{ dAIError }}</div>
        </div>
        <div class="modal-footer"><button class="btn-secondary" @click="showDesignAI=false">Cancel</button><button class="btn-primary" @click="execDesignAI" :disabled="dAILoading||!dAIDesc.trim()"><span v-if="dAILoading" class="spinner"></span>{{ dAILoading?'Generating…':'Generate' }}</button></div>
      </div>
    </div>

    <transition name="toast"><div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div></transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  robloxService, makeDefaultPart, assignUids, flattenParts, findPartByUid, removePartByUid, collectAllParts,
  type RobloxAnimation, type RobloxDesign, type PartData, type UserAnimation, type ThreeAnimParams, type FlatPart
} from '@/services/roblox.service';
import { useAuthStore } from '@/store/auth';

interface CharDef { id:string; name:string; hc:number; tc:number; lc:number }

const authStore = useAuthStore();
const isAdmin = computed(() => !!authStore.user?.is_admin);
const shapes = ['Block','Ball','Cylinder','Wedge'];
const materialList = ['SmoothPlastic','Brick','Wood','Metal','Grass','Ice','Neon','Glass','Marble','Concrete','Sand','Fabric','Pebble','DiamondPlate','ForceField','Slate','Granite','WoodPlanks','Cobblestone'];
const allCats = ['Movement','Rotation','Scale','Color','Complex','Character','Physics','UI/FX','Custom'];
const characters: CharDef[] = [
  {id:'default',name:'Classic Robloxian',hc:0xf5c542,tc:0x0057a8,lc:0xf5c542},
  {id:'noob',name:'Noob',hc:0xf5c542,tc:0x0057ff,lc:0xf5c542},
  {id:'robot',name:'Robot',hc:0x888888,tc:0x555555,lc:0x888888},
  {id:'zombie',name:'Zombie',hc:0x7cba3f,tc:0x3d5c1e,lc:0x7cba3f},
  {id:'knight',name:'Knight',hc:0xaaaaaa,tc:0x666666,lc:0xaaaaaa},
];

// State
const activeTool = ref<'animations'|'design'>('animations');
const toastMsg = ref(''); const toastType = ref('success');
const loadingAnimations = ref(false);
const allSystemAnimations = ref<RobloxAnimation[]>([]);
const myAnimations = ref<UserAnimation[]>([]);
const searchQuery = ref(''); const selectedCategory = ref('');
const currentAnim = ref<(RobloxAnimation|UserAnimation)|null>(null);
const activeTab = ref('info'); const isPlaying = ref(true); const animSpeed = ref(1.0);
const copySuccess = ref(false); const selectedCharacter = ref('default');
const showCustomRequest = ref(false); const customDesc = ref(''); const customPartType = ref('Part');
const customLooping = ref(true); const customDuration = ref(2); const customLoading = ref(false); const customError = ref('');
const showAdminCreate = ref(false); const admSaving = ref(false); const admError = ref('');
const admF = ref({name:'',category:'Movement',icon:'🎬',description:'',bestFor:'',looping:true,duration:2,luaCode:'',paramsJson:'{}'});

// Design
const designName = ref('My Model'); const designDesc = ref(''); const designLua = ref('');
const modelAnimScript = ref(''); const modelAnimPick = ref('');
const designParts = ref<PartData[]>([makeDefaultPart()]);
const selectedUid = ref('');
const currentDesignId = ref<string|null>(null);
const savedDesigns = ref<RobloxDesign[]>([]);
const savingDesign = ref(false); const designTab = ref('lua');
const showDesignAI = ref(false); const dAIDesc = ref(''); const dAILoading = ref(false); const dAIError = ref('');
const partAnimPick = ref('');

// Computed
const editPart = computed(() => selectedUid.value ? findPartByUid(designParts.value, selectedUid.value) : null);
const flatPartsList = computed<FlatPart[]>(() => flattenParts(designParts.value));
const totalPartCount = computed(() => collectAllParts(designParts.value).length);
const dynamicCategories = computed(() => {
  const s = new Set<string>();
  allSystemAnimations.value.forEach(a => s.add(a.category));
  myAnimations.value.forEach(a => s.add(a.category));
  return Array.from(s).sort();
});
const filteredSystemAnims = computed(() => {
  let l = allSystemAnimations.value;
  if (selectedCategory.value) l = l.filter(a => a.category === selectedCategory.value);
  if (searchQuery.value.trim()) { const q = searchQuery.value.toLowerCase(); l = l.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || (a.bestFor||'').toLowerCase().includes(q)); }
  return l;
});
const filteredMyAnims = computed(() => {
  let l = myAnimations.value as (RobloxAnimation|UserAnimation)[];
  if (selectedCategory.value) l = l.filter(a => a.category === selectedCategory.value);
  if (searchQuery.value.trim()) { const q = searchQuery.value.toLowerCase(); l = l.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)); }
  return l;
});
const appSteps = computed(() => {
  if (!currentAnim.value) return [];
  return [
    {title:'Open Roblox Studio',description:'Open your game.'},
    {title:'Select Part',description:'Select or insert a Part.'},
    {title:'Insert Script',description:'Right-click Part → Insert Object → Script.'},
    {title:'Paste Code',description:'Replace default code with the Lua from Code tab.',code:currentAnim.value.luaCode},
    {title:'Test (F5)',description:'Press F5 to play.'},
    {title:'Save',description:'Shift+F5, Ctrl+S.'},
  ];
});

function countParts(parts: any[]): number {
  if (!parts) return 0;
  let c = parts.length;
  for (const p of parts) { if (p.children) c += countParts(p.children); }
  return c;
}

const generatedDesignLua = computed(() => {
  const parts = designParts.value;
  const name = designName.value || 'Model';
  const lines: string[] = [`-- ${name} Creation Script`, ''];
  lines.push('local model = Instance.new("Model")');
  lines.push(`model.Name = "${name}"`);
  lines.push('');
  let counter = 0;
  function genPart(p: PartData, parentVar: string) {
    counter++;
    const v = `p${counter}`;
    const hex = p.color.replace('#','');
    const r = parseInt(hex.substring(0,2),16)||128, g = parseInt(hex.substring(2,4),16)||128, b = parseInt(hex.substring(4,6),16)||128;
    lines.push(`local ${v} = Instance.new("${p.shape==='Wedge'?'WedgePart':'Part'}")`);
    lines.push(`${v}.Name = "${p.name}"`);
    lines.push(`${v}.Size = Vector3.new(${p.size.x},${p.size.y},${p.size.z})`);
    if (p.rotation.x||p.rotation.y||p.rotation.z) lines.push(`${v}.CFrame = CFrame.new(${p.position.x},${p.position.y},${p.position.z})*CFrame.Angles(math.rad(${p.rotation.x}),math.rad(${p.rotation.y}),math.rad(${p.rotation.z}))`);
    else lines.push(`${v}.Position = Vector3.new(${p.position.x},${p.position.y},${p.position.z})`);
    if (p.shape==='Ball') lines.push(`${v}.Shape = Enum.PartType.Ball`);
    else if (p.shape==='Cylinder') lines.push(`${v}.Shape = Enum.PartType.Cylinder`);
    lines.push(`${v}.Color = Color3.fromRGB(${r},${g},${b})`);
    lines.push(`${v}.Material = Enum.Material.${p.material}`);
    if (p.transparency>0) lines.push(`${v}.Transparency = ${p.transparency}`);
    lines.push(`${v}.Anchored = ${p.anchored}`);
    lines.push(`${v}.CanCollide = ${p.canCollide}`);
    lines.push(`${v}.Parent = ${parentVar}`);
    lines.push('');
    for (const ch of (p.children||[])) genPart(ch, v);
  }
  for (const p of parts) genPart(p, 'model');
  lines.push('model.Parent = workspace');
  if (counter > 0) lines.push('model.PrimaryPart = p1');
  lines.push(`print("${name} created!")`);
  return lines.join('\n');
});

// Helpers
function showToast(m:string,t='success'){toastMsg.value=m;toastType.value=t;setTimeout(()=>{toastMsg.value=''},3000)}
async function copyText(t:string){try{await navigator.clipboard.writeText(t);showToast('Copied!')}catch{showToast('Copy failed','error')}}
function hexToThreeColor(h:string):THREE.Color{return new THREE.Color(h)}
function degToRad(d:number):number{return d*Math.PI/180}

// ═══ Three.js Animation Preview ═══
const threeContainer = ref<HTMLDivElement|null>(null);
let aScene:THREE.Scene|null=null,aCamera:THREE.PerspectiveCamera|null=null,aRenderer:THREE.WebGLRenderer|null=null,aControls:OrbitControls|null=null;
let aFrame=0,aClock:THREE.Clock|null=null,charGroup:THREE.Group|null=null,animReady=false;
let currentAnimFn:((g:THREE.Group,t:number,dt:number,s:number)=>void)|null=null;

function disposeAnimScene(){if(aFrame){cancelAnimationFrame(aFrame);aFrame=0}if(aRenderer){aRenderer.dispose();aRenderer.domElement?.parentNode?.removeChild(aRenderer.domElement);aRenderer=null}aControls?.dispose();aControls=null;aScene=null;aCamera=null;charGroup=null;aClock=null;animReady=false}
function ensureAnimScene(){if(!threeContainer.value)return;if(aRenderer&&aRenderer.domElement.parentNode!==threeContainer.value)disposeAnimScene();if(!animReady)initAnimScene()}
function initAnimScene(){
  if(!threeContainer.value)return;disposeAnimScene();
  aScene=new THREE.Scene();aScene.background=new THREE.Color(0x1a1a2e);
  aCamera=new THREE.PerspectiveCamera(50,threeContainer.value.clientWidth/threeContainer.value.clientHeight,0.1,100);aCamera.position.set(5,4,6);
  aRenderer=new THREE.WebGLRenderer({antialias:true});aRenderer.setSize(threeContainer.value.clientWidth,threeContainer.value.clientHeight);aRenderer.setPixelRatio(Math.min(devicePixelRatio,2));aRenderer.shadowMap.enabled=true;threeContainer.value.appendChild(aRenderer.domElement);
  aControls=new OrbitControls(aCamera,aRenderer.domElement);aControls.enableDamping=true;aControls.target.set(0,1,0);
  aScene.add(new THREE.AmbientLight(0x404060,0.6));const dl=new THREE.DirectionalLight(0xffffff,1);dl.position.set(5,10,5);dl.castShadow=true;aScene.add(dl);
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x16213e}));gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;aScene.add(gnd);
  aScene.add(new THREE.GridHelper(20,20,0x333366,0x222244).translateY(0.01));
  charGroup=new THREE.Group();aScene.add(charGroup);buildChar(characters.find(c=>c.id===selectedCharacter.value)||characters[0]);
  aClock=new THREE.Clock();animReady=true;loopAnim();
}
function buildChar(c:CharDef){if(!charGroup)return;while(charGroup.children.length)charGroup.remove(charGroup.children[0]);const hM=new THREE.MeshStandardMaterial({color:c.hc}),tM=new THREE.MeshStandardMaterial({color:c.tc}),lM=new THREE.MeshStandardMaterial({color:c.lc});const torso=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.4,0.7),tM);torso.position.y=2.2;torso.castShadow=true;charGroup.add(torso);const head=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),hM);head.position.y=3.4;head.castShadow=true;charGroup.add(head);const eM=new THREE.MeshStandardMaterial({color:0x111111});charGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),eM).translateX(-0.2).translateY(3.45).translateZ(0.45));charGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.1,8,8),eM).translateX(0.2).translateY(3.45).translateZ(0.45));const aG=new THREE.BoxGeometry(0.5,1.2,0.5);charGroup.add(Object.assign(new THREE.Mesh(aG,lM),{castShadow:true}).translateX(-1.05).translateY(2.1));charGroup.add(Object.assign(new THREE.Mesh(aG,lM),{castShadow:true}).translateX(1.05).translateY(2.1));const lgG=new THREE.BoxGeometry(0.5,1.2,0.5);charGroup.add(Object.assign(new THREE.Mesh(lgG,lM),{castShadow:true}).translateX(-0.35).translateY(0.8));charGroup.add(Object.assign(new THREE.Mesh(lgG,lM),{castShadow:true}).translateX(0.35).translateY(0.8))}
function updateCharacter(){buildChar(characters.find(c=>c.id===selectedCharacter.value)||characters[0])}
function loopAnim(){if(!animReady||!aScene||!aCamera||!aRenderer||!aClock)return;aFrame=requestAnimationFrame(loopAnim);const dt=aClock.getDelta(),t=aClock.getElapsedTime();aControls?.update();if(currentAnim.value&&isPlaying.value&&currentAnimFn&&charGroup){charGroup.position.set(0,0,0);charGroup.rotation.set(0,0,0);charGroup.scale.set(1,1,1);try{currentAnimFn(charGroup,t,dt,animSpeed.value)}catch{charGroup.position.y=Math.sin(t)*0.5+0.5}}aRenderer.render(aScene,aCamera)}
function togglePlay(){isPlaying.value=!isPlaying.value;if(isPlaying.value&&aClock)aClock.start()}
function resetAnimation(){aClock=new THREE.Clock();isPlaying.value=true;if(charGroup){charGroup.position.set(0,0,0);charGroup.rotation.set(0,0,0);charGroup.scale.set(1,1,1)}}

/** Build animation function from structured threeAnimParams — matches Roblox directions */
function buildAnimator(params: any) {
  if (!params) return defaultAnim;
  // New structured format
  const tp = params.type || '';
  if (tp === 'spin') {
    const axis = params.axis || 'y';
    const speed = params.speed || 2;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const a = t*s*speed;
      if (axis==='x') g.rotation.x=a;
      else if (axis==='z') g.rotation.z=a;
      else g.rotation.y=a;
    };
  }
  if (tp === 'tween') {
    const axis = params.axis || 'x';
    const dist = params.distance || 3;
    const dur = params.duration || 2;
    const rev = params.reverses !== false;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const ts = t*s;
      let phase: number;
      if (rev) {
        // Sine-based back-and-forth matching TweenService Sine InOut reversal
        phase = Math.sin((ts / dur) * Math.PI) * dist;
      } else {
        phase = ((ts / dur) % 1) * dist;
      }
      if (axis==='x') g.position.x = phase;
      else if (axis==='z') g.position.z = phase;
      else g.position.y = phase;
    };
  }
  if (tp === 'sine') {
    const axis = params.axis || 'y';
    const amp = params.amplitude || 1.5;
    const freq = params.frequency || 1.5;
    const off = params.offset || 0;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const v = Math.sin(t*s*freq)*amp + off;
      if (axis==='x') g.position.x=v;
      else if (axis==='z') g.position.z=v;
      else g.position.y=v;
    };
  }
  if (tp === 'sine_rot') {
    const axis = params.axis || 'z';
    const amp = params.amplitude || 0.4;
    const freq = params.frequency || 2;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const v = Math.sin(t*s*freq)*amp;
      if (axis==='x') g.rotation.x=v;
      else if (axis==='y') g.rotation.y=v;
      else g.rotation.z=v;
    };
  }
  if (tp === 'pulse') {
    const amp = params.amplitude || 0.2;
    const freq = params.frequency || 4;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const sc = 1 + Math.sin(t*s*freq)*amp;
      g.scale.set(sc,sc,sc);
    };
  }
  if (tp === 'bounce') {
    const h = params.height || 4;
    const dec = params.decay || 0.5;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const ts = t*s;
      g.position.y = Math.abs(Math.sin((ts%3)*Math.PI))*Math.exp(-(ts%3)*dec)*h;
    };
  }
  if (tp === 'shake') {
    const intensity = params.intensity || 0.3;
    return (g:THREE.Group) => {
      g.position.x = (Math.random()-0.5)*intensity*2;
      g.position.y = (Math.random()-0.5)*intensity;
      g.position.z = (Math.random()-0.5)*intensity*2;
    };
  }
  if (tp === 'color_cycle') {
    const spd = params.speed || 0.3;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const h = (t*s*spd)%1;
      const c = new THREE.Color().setHSL(h,1,0.5);
      g.traverse(ch => {if((ch as THREE.Mesh).isMesh)((ch as THREE.Mesh).material as THREE.MeshStandardMaterial).color=c});
    };
  }
  if (tp === 'flash') {
    const spd = params.speed || 4;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const vis = Math.floor((t*s*spd)%2)===0;
      g.traverse(ch => {if((ch as THREE.Mesh).isMesh){const m=(ch as THREE.Mesh).material as THREE.MeshStandardMaterial;m.opacity=vis?1:0.2;m.transparent=true}});
    };
  }
  if (tp === 'fade') {
    const dur = params.duration || 1.5;
    return (g:THREE.Group,t:number,_dt:number,s:number) => {
      const opacity = (Math.sin(t*s/dur*Math.PI)+1)/2;
      g.traverse(ch => {if((ch as THREE.Mesh).isMesh){const m=(ch as THREE.Mesh).material as THREE.MeshStandardMaterial;m.opacity=opacity;m.transparent=true}});
    };
  }
  if (tp === 'multi' && params.expressions) {
    return buildExprAnimator(params.expressions);
  }
  // Legacy: raw expressions object (backward compat)
  if (params.posX || params.posY || params.posZ || params.rotX || params.rotY || params.rotZ || params.scaleX || params.colorHue) {
    return buildExprAnimator(params);
  }
  return defaultAnim;
}

function buildExprAnimator(exprs: Record<string, string>) {
  const fns: Record<string, Function|null> = {};
  for (const k of ['posX','posY','posZ','rotX','rotY','rotZ','scaleX','scaleY','scaleZ','colorHue']) {
    if (exprs[k]) { try { fns[k] = new Function('t','Math',`"use strict";try{return(${exprs[k]})}catch{return 0}`); } catch { fns[k]=null } }
  }
  return (g:THREE.Group,t:number,_dt:number,s:number) => {
    const ts=t*s;
    try {
      if(fns.posX) g.position.x = (fns.posX as any)(ts,Math)||0;
      if(fns.posY) g.position.y = (fns.posY as any)(ts,Math)||0;
      if(fns.posZ) g.position.z = (fns.posZ as any)(ts,Math)||0;
      if(fns.rotX) g.rotation.x = (fns.rotX as any)(ts,Math)||0;
      if(fns.rotY) g.rotation.y = (fns.rotY as any)(ts,Math)||0;
      if(fns.rotZ) g.rotation.z = (fns.rotZ as any)(ts,Math)||0;
      if(fns.scaleX){const sx=Math.max(0.01,(fns.scaleX as any)(ts,Math)||1);g.scale.set(sx,fns.scaleY?Math.max(0.01,(fns.scaleY as any)(ts,Math)||sx):sx,fns.scaleZ?Math.max(0.01,(fns.scaleZ as any)(ts,Math)||sx):sx)}
      if(fns.colorHue){const h=Math.abs(((fns.colorHue as any)(ts,Math)||0)%1);const c=new THREE.Color().setHSL(h,1,0.5);g.traverse(ch=>{if((ch as THREE.Mesh).isMesh)((ch as THREE.Mesh).material as THREE.MeshStandardMaterial).color=c})}
    } catch { g.position.y = Math.sin(ts)+1; g.rotation.y = ts*0.5 }
  };
}

function defaultAnim(g:THREE.Group,t:number,_dt:number,s:number){g.position.y=Math.sin(t*s)*1.5+1.5;g.rotation.y=t*s}

// ═══ Design Three.js ═══
const designThreeContainer = ref<HTMLDivElement|null>(null);
let dScene:THREE.Scene|null=null,dCamera:THREE.PerspectiveCamera|null=null,dRenderer:THREE.WebGLRenderer|null=null,dControls:OrbitControls|null=null;
let dFrame=0,designReady=false,dModelGroup:THREE.Group|null=null,dClock:THREE.Clock|null=null;
let dPartAnimFns: Map<string, {mesh:THREE.Object3D,fn:(m:THREE.Object3D,t:number)=>void,basePos:THREE.Vector3,baseRot:THREE.Euler}> = new Map();

function disposeDesignScene(){if(dFrame){cancelAnimationFrame(dFrame);dFrame=0}dRenderer?.dispose();dRenderer?.domElement?.parentNode?.removeChild(dRenderer!.domElement);dRenderer=null;dControls?.dispose();dControls=null;dScene=null;dCamera=null;dModelGroup=null;dClock=null;designReady=false;dPartAnimFns.clear()}
function ensureDesignScene(){if(!designThreeContainer.value)return;if(dRenderer&&dRenderer.domElement.parentNode!==designThreeContainer.value)disposeDesignScene();if(!designReady)initDesignScene()}
function initDesignScene(){
  if(!designThreeContainer.value)return;disposeDesignScene();
  dScene=new THREE.Scene();dScene.background=new THREE.Color(0x1a1a2e);
  dCamera=new THREE.PerspectiveCamera(50,designThreeContainer.value.clientWidth/designThreeContainer.value.clientHeight,0.1,200);dCamera.position.set(8,8,12);
  dRenderer=new THREE.WebGLRenderer({antialias:true});dRenderer.setSize(designThreeContainer.value.clientWidth,designThreeContainer.value.clientHeight);dRenderer.setPixelRatio(Math.min(devicePixelRatio,2));dRenderer.shadowMap.enabled=true;designThreeContainer.value.appendChild(dRenderer.domElement);
  dControls=new OrbitControls(dCamera,dRenderer.domElement);dControls.enableDamping=true;dControls.target.set(0,3,0);
  dScene.add(new THREE.AmbientLight(0x606080,0.7));const dl=new THREE.DirectionalLight(0xffffff,1.2);dl.position.set(8,15,8);dl.castShadow=true;dScene.add(dl);
  const gnd=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0x16213e}));gnd.rotation.x=-Math.PI/2;gnd.receiveShadow=true;dScene.add(gnd);
  dScene.add(new THREE.GridHelper(30,30,0x333366,0x222244).translateY(0.01));
  dModelGroup=new THREE.Group();dScene.add(dModelGroup);
  dClock=new THREE.Clock();designReady=true;rebuildDesignPreview();loopDesign();
}

function buildPartMesh(p:PartData):THREE.Mesh{
  let geo:THREE.BufferGeometry;
  const sx=Math.max(0.1,p.size.x),sy=Math.max(0.1,p.size.y),sz=Math.max(0.1,p.size.z);
  switch(p.shape){
    case 'Ball':geo=new THREE.SphereGeometry(Math.max(sx,sy,sz)/2,24,24);break;
    case 'Cylinder':geo=new THREE.CylinderGeometry(sx/2,sx/2,sy,24);break;
    case 'Wedge':{geo=new THREE.BufferGeometry();const hw=sx/2,hh=sy/2,hd=sz/2;const v=new Float32Array([-hw,-hh,-hd,hw,-hh,-hd,hw,hh,-hd,-hw,-hh,hd,hw,-hh,hd,hw,hh,hd,-hw,-hh,-hd,-hw,-hh,hd,hw,hh,hd,hw,hh,-hd,-hw,-hh,-hd,hw,-hh,-hd,-hw,-hh,hd,hw,-hh,hd,hw,-hh,-hd,-hw,-hh,-hd,hw,-hh,hd,hw,hh,hd,hw,hh,-hd,hw,-hh,-hd]);geo.setAttribute('position',new THREE.BufferAttribute(v,3));geo.computeVertexNormals();break}
    default:geo=new THREE.BoxGeometry(sx,sy,sz);
  }
  const isNeon=p.material==='Neon',isGlass=p.material==='Glass',isMetal=p.material==='Metal'||p.material==='DiamondPlate';
  const mat=new THREE.MeshStandardMaterial({color:hexToThreeColor(p.color),opacity:1-p.transparency,transparent:p.transparency>0,roughness:isGlass?0.05:isMetal?0.2:isNeon?0.3:0.6,metalness:isMetal?0.9:isNeon?0.1:0.05});
  if(isNeon){mat.emissive=hexToThreeColor(p.color);mat.emissiveIntensity=0.6}
  if(isGlass){mat.opacity=0.35;mat.transparent=true}
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(p.position.x,p.position.y,p.position.z);
  if(p.rotation.x||p.rotation.y||p.rotation.z)mesh.rotation.set(degToRad(p.rotation.x),degToRad(p.rotation.y),degToRad(p.rotation.z));
  mesh.castShadow=true;mesh.receiveShadow=true;
  return mesh;
}

function buildDesignAnimFn(script:string):((m:THREE.Object3D,t:number)=>void)|null{
  if(!script||script.trim().length<10) return null;
  const l=script.toLowerCase();
  if(l.includes('cframe.angles')&&(l.includes('speed*dt')||l.includes('speed * dt'))){
    if(l.includes('0, speed*dt, 0')||l.includes('0,speed*dt,0'))return(m,t)=>{m.rotation.y=t*2};
    if(l.includes('speed*dt, 0, 0')||l.includes('speed*dt,0,0'))return(m,t)=>{m.rotation.x=t*2};
    if(l.includes('0, 0, speed*dt')||l.includes('0,0,speed*dt'))return(m,t)=>{m.rotation.z=t*2};
  }
  if(l.includes('math.sin')&&l.includes('position')){
    return(m,t)=>{const b=(m.userData as any)?.baseY??m.position.y;if(!(m.userData as any)?.baseY)(m.userData as any)={baseY:m.position.y};m.position.y=b+Math.sin(t*2)*1.5};
  }
  if(l.includes('tweenservice')&&l.includes('position')){
    return(m,t)=>{const b=(m.userData as any)?.baseX??m.position.x;if(!(m.userData as any)?.baseX)(m.userData as any)={baseX:m.position.x};m.position.x=b+Math.sin(t)*3};
  }
  if(l.includes('color3.fromhsv')){
    return(m,t)=>{const mat=(m as THREE.Mesh).material as THREE.MeshStandardMaterial;if(mat)mat.color.setHSL((t*0.3)%1,1,0.5)};
  }
  return(m,t)=>{m.rotation.y=t*1.5};
}

function rebuildDesignPreview(){
  if(!dModelGroup)return;dPartAnimFns.clear();
  while(dModelGroup.children.length){const c=dModelGroup.children[0];(c as THREE.Mesh).geometry?.dispose();const m=(c as THREE.Mesh).material;if(m){if(Array.isArray(m))m.forEach(x=>x.dispose());else(m as THREE.Material).dispose()}dModelGroup.remove(c)}
  function addParts(parts:PartData[],parent:THREE.Object3D){
    for(const p of parts){
      const mesh=buildPartMesh(p);
      parent.add(mesh);
      if(p.animationScript){
        const fn=buildDesignAnimFn(p.animationScript);
        if(fn)dPartAnimFns.set(p._uid||'',{mesh,fn,basePos:mesh.position.clone(),baseRot:mesh.rotation.clone()});
      }
      if(p.children?.length)addParts(p.children,mesh);
    }
  }
  addParts(designParts.value,dModelGroup);
  if(designParts.value.length>0&&dCamera&&dControls){
    const box=new THREE.Box3().setFromObject(dModelGroup);
    const center=box.getCenter(new THREE.Vector3());
    const size=box.getSize(new THREE.Vector3());
    const maxDim=Math.max(size.x,size.y,size.z,3);
    dControls.target.copy(center);
    dCamera.position.set(center.x+maxDim*1.5,center.y+maxDim,center.z+maxDim*1.5);
  }
}
function loopDesign(){if(!designReady||!dScene||!dCamera||!dRenderer)return;dFrame=requestAnimationFrame(loopDesign);dControls?.update();const t=dClock?dClock.getElapsedTime():0;dPartAnimFns.forEach(d=>{try{d.fn(d.mesh,t)}catch{}});dRenderer.render(dScene,dCamera)}

// ═══ Data ═══
async function loadAnimations(){loadingAnimations.value=true;try{allSystemAnimations.value=await robloxService.getAnimations()}catch(e:any){showToast('Load failed: '+e.message,'error')}if(authStore.user?.id){try{myAnimations.value=await robloxService.getUserAnimations(authStore.user.id)}catch{}}loadingAnimations.value=false}
async function loadDesigns(){if(!authStore.user?.id)return;try{savedDesigns.value=await robloxService.getDesigns(authStore.user.id)}catch{}}

function selectAnimation(a:RobloxAnimation|UserAnimation){currentAnim.value=a;activeTab.value='info';isPlaying.value=true;currentAnimFn=buildAnimator((a as any).threeAnimParams);if(charGroup){charGroup.position.set(0,0,0);charGroup.rotation.set(0,0,0);charGroup.scale.set(1,1,1)}}

// ═══ Custom AI Animation ═══
async function requestCustomAnim(){
  if(!customDesc.value.trim()||!authStore.user?.id)return;customLoading.value=true;customError.value='';
  try{
    const r=await robloxService.generateAnimation({description:customDesc.value,partType:customPartType.value,looping:customLooping.value,duration:customDuration.value});
    if(!r?.luaCode){customError.value='AI returned incomplete result';return}
    const resp=await robloxService.createUserAnimation({user_id:authStore.user!.id,username:authStore.user!.username||'',name:r.name||'Custom',category:'Custom',icon:'🤖',color:'linear-gradient(135deg,#6366f1,#a855f7)',description:r.description||customDesc.value,bestFor:'Custom',looping:customLooping.value,duration:customDuration.value,luaCode:r.luaCode,threeAnimParams:r.threeAnimParams||{}});
    myAnimations.value.push(resp.animation);selectAnimation(resp.animation);showCustomRequest.value=false;customDesc.value='';showToast('Generated & saved!')
  }catch(e:any){customError.value=e.message||'Failed'}finally{customLoading.value=false}
}
async function deleteMyAnimation(id:string){if(!confirm('Delete?')||!authStore.user?.id)return;try{await robloxService.deleteUserAnimation(id,authStore.user.id);myAnimations.value=myAnimations.value.filter(a=>a.id!==id);if(currentAnim.value&&(currentAnim.value as any).id===id)currentAnim.value=null;showToast('Deleted')}catch(e:any){showToast(e.message,'error')}}

// ═══ Admin ═══
async function adminSave(){
  const f=admF.value;if(!f.name||!f.luaCode){admError.value='Name+code required';return}admSaving.value=true;admError.value='';
  let params={};try{params=JSON.parse(f.paramsJson||'{}')}catch{admError.value='Invalid JSON';admSaving.value=false;return}
  try{const resp=await robloxService.createAnimation({name:f.name,category:f.category,icon:f.icon,color:'linear-gradient(135deg,#667eea,#764ba2)',description:f.description,bestFor:f.bestFor,looping:f.looping,duration:f.duration,luaCode:f.luaCode,threeAnimParams:params,created_by:'admin',created_by_username:authStore.user?.username||''} as any);allSystemAnimations.value.push(resp.animation);showAdminCreate.value=false;showToast('Added!')}catch(e:any){admError.value=e.message}finally{admSaving.value=false}
}
async function deleteAnimationAdmin(id:string){if(!confirm('Delete?'))return;try{await robloxService.deleteAnimation(id);allSystemAnimations.value=allSystemAnimations.value.filter(a=>a.id!==id);if(currentAnim.value&&(currentAnim.value as any).id===id)currentAnim.value=null;showToast('Deleted')}catch(e:any){showToast(e.message,'error')}}

// ═══ Design ═══
function addRootPart(){designParts.value.push(makeDefaultPart({name:`Part${totalPartCount.value}`,position:{x:0,y:totalPartCount.value*2+2,z:0}}));selectedUid.value=designParts.value[designParts.value.length-1]._uid||'';rebuildDesignPreview()}
function addChildPart(parent:PartData){if(!parent.children)parent.children=[];const child=makeDefaultPart({name:`${parent.name}_child${parent.children.length}`,position:{x:0,y:parent.size.y/2+1,z:0}});parent.children.push(child);parent._expanded=true;selectedUid.value=child._uid||'';rebuildDesignPreview()}
function removePart(uid:string){if(collectAllParts(designParts.value).length<=1){showToast('Need at least 1 part','error');return}removePartByUid(designParts.value,uid);if(selectedUid.value===uid)selectedUid.value='';rebuildDesignPreview()}
function resetDesign(){designName.value='My Model';designDesc.value='';designLua.value='';modelAnimScript.value='';modelAnimPick.value='';designParts.value=[makeDefaultPart()];selectedUid.value='';currentDesignId.value=null;partAnimPick.value='';rebuildDesignPreview()}

// Animation pickers
function findAnimById(val:string):(RobloxAnimation|UserAnimation)|undefined{if(val.startsWith('my-'))return myAnimations.value.find(a=>a.id===val.replace('my-',''));return allSystemAnimations.value.find(a=>a.id===val)}
function applyModelAnim(){const a=findAnimById(modelAnimPick.value);modelAnimScript.value=a?a.luaCode:''}
function applyPartAnim(){if(!editPart.value)return;const a=findAnimById(partAnimPick.value);editPart.value.animationScript=a?a.luaCode:'';rebuildDesignPreview()}

watch(selectedUid,()=>{
  if(editPart.value?.animationScript){
    const code=editPart.value.animationScript;
    const sm=allSystemAnimations.value.find(a=>a.luaCode===code);
    const mm=myAnimations.value.find(a=>a.luaCode===code);
    partAnimPick.value=sm?sm.id:mm?'my-'+mm.id:'';
  }else partAnimPick.value='';
});

async function saveDesignToBackend(){
  if(!authStore.user?.id){showToast('Log in first','error');return}savingDesign.value=true;
  const payload:Partial<RobloxDesign>={user_id:authStore.user.id,username:authStore.user.username||'',name:designName.value,description:designDesc.value,parts:designParts.value,luaCode:designLua.value,modelAnimationScript:modelAnimScript.value};
  try{
    if(currentDesignId.value){await robloxService.updateDesign(currentDesignId.value,payload,authStore.user.id);showToast('Updated!')}
    else{const r=await robloxService.saveDesign(payload);currentDesignId.value=r.id;showToast('Saved!')}
    await loadDesigns();
  }catch(e:any){showToast(e.message,'error')}finally{savingDesign.value=false}
}
function loadDesign(d:RobloxDesign){
  currentDesignId.value=d.id;designName.value=d.name;designDesc.value=d.description;designLua.value=d.luaCode||'';
  modelAnimScript.value=(d as any).modelAnimationScript||'';modelAnimPick.value='';
  designParts.value=(d.parts||[]).map(p=>makeDefaultPart(p));
  assignUids(designParts.value);
  if(!designParts.value.length)designParts.value=[makeDefaultPart()];
  selectedUid.value='';partAnimPick.value='';rebuildDesignPreview();
}
async function downloadZip(){if(!currentDesignId.value)return;try{await robloxService.downloadDesign(currentDesignId.value,'zip');showToast('Downloaded!')}catch(e:any){showToast(e.message,'error')}}
async function downloadRbxm(){if(!currentDesignId.value)return;try{await robloxService.downloadDesign(currentDesignId.value,'rbxm');showToast('RBXM downloaded!')}catch(e:any){showToast(e.message,'error')}}
async function downloadLua(){if(!currentDesignId.value)return;try{await robloxService.downloadDesign(currentDesignId.value,'lua');showToast('Lua downloaded!')}catch(e:any){showToast(e.message,'error')}}
async function downloadDesignById(id:string,fmt:'zip'|'rbxm'|'lua'='rbxm'){try{await robloxService.downloadDesign(id,fmt)}catch{showToast('Download failed','error')}}
async function deleteDesignById(id:string){if(!confirm('Delete?'))return;try{await robloxService.deleteDesign(id,authStore.user?.id);savedDesigns.value=savedDesigns.value.filter(d=>d.id!==id);if(currentDesignId.value===id)currentDesignId.value=null;showToast('Deleted')}catch(e:any){showToast(e.message,'error')}}

function openDesignAI(){showDesignAI.value=true;dAIDesc.value='';dAIError.value=''}
async function execDesignAI(){
  if(!dAIDesc.value.trim())return;dAILoading.value=true;dAIError.value='';
  try{
    const result=await robloxService.generateDesign({description:dAIDesc.value});
    if(result?.parts?.length){
      designName.value=result.name||'AI Design';designDesc.value=result.description||dAIDesc.value;designLua.value=result.luaCode||'';
      modelAnimScript.value=result.modelAnimationScript||'';modelAnimPick.value='';
      designParts.value=result.parts;assignUids(designParts.value);
      selectedUid.value='';currentDesignId.value=null;partAnimPick.value='';
      rebuildDesignPreview();showDesignAI.value=false;showToast(`Design generated with ${collectAllParts(result.parts).length} parts!`);
    }else dAIError.value='AI returned no parts. Try more specific description.';
  }catch(e:any){dAIError.value=e.message||'Failed'}finally{dAILoading.value=false}
}

async function copyCode(){if(!currentAnim.value)return;try{await navigator.clipboard.writeText(currentAnim.value.luaCode);copySuccess.value=true;showToast('Copied!');setTimeout(()=>{copySuccess.value=false},2000)}catch{showToast('Failed','error')}}

async function switchTool(t:'animations'|'design'){activeTool.value=t;await nextTick();if(t==='animations')ensureAnimScene();else{ensureDesignScene();await loadDesigns()}}

function onResize(){
  if(threeContainer.value&&aRenderer&&aCamera){aCamera.aspect=threeContainer.value.clientWidth/threeContainer.value.clientHeight;aCamera.updateProjectionMatrix();aRenderer.setSize(threeContainer.value.clientWidth,threeContainer.value.clientHeight)}
  if(designThreeContainer.value&&dRenderer&&dCamera){dCamera.aspect=designThreeContainer.value.clientWidth/designThreeContainer.value.clientHeight;dCamera.updateProjectionMatrix();dRenderer.setSize(designThreeContainer.value.clientWidth,designThreeContainer.value.clientHeight)}
}

watch(designParts,()=>{if(designReady)rebuildDesignPreview()},{deep:true});

onMounted(async()=>{await nextTick();initAnimScene();await loadAnimations();window.addEventListener('resize',onResize)});
onUnmounted(()=>{window.removeEventListener('resize',onResize);disposeAnimScene();disposeDesignScene()});
</script>

<style src="@/assets/css/roblox-tool.css"></style>