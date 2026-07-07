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
          <button class="btn-secondary" @click="showCustomRequest = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Custom Animation
          </button>
          <select v-model="selectedCharacter" class="character-select" @change="updateCharacter">
            <option v-for="char in characters" :key="char.id" :value="char.id">{{ char.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="roblox-content">
      <!-- Left Panel: Animation List -->
      <div class="animations-panel">
        <div class="panel-header">
          <h2>Animations <span class="count">({{ filteredAnimations.length }})</span></h2>
          <div class="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search animations..."
              class="search-input"
            />
          </div>
          <div class="filter-tags">
            <button
              v-for="cat in categories"
              :key="cat"
              :class="['filter-tag', { active: selectedCategory === cat }]"
              @click="selectedCategory = selectedCategory === cat ? '' : cat"
            >
              {{ cat }}
            </button>
          </div>
        </div>
        <div class="animations-grid">
          <div
            v-for="anim in filteredAnimations"
            :key="anim.id"
            :class="['animation-card', { selected: selectedAnimation?.id === anim.id }]"
            @click="selectAnimation(anim)"
          >
            <div class="card-preview" :style="{ background: anim.color }">
              <span class="card-icon">{{ anim.icon }}</span>
            </div>
            <div class="card-info">
              <h4>{{ anim.name }}</h4>
              <span class="card-category">{{ anim.category }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Preview & Details -->
      <div class="preview-panel">
        <!-- 3D Preview -->
        <div class="preview-section">
          <div class="preview-header">
            <h3>{{ selectedAnimation ? selectedAnimation.name : 'Select an Animation' }}</h3>
            <div class="preview-controls" v-if="selectedAnimation">
              <button class="ctrl-btn" @click="togglePlay" :title="isPlaying ? 'Pause' : 'Play'">
                <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              </button>
              <button class="ctrl-btn" @click="resetAnimation" title="Reset">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
              </button>
              <div class="speed-control">
                <label>Speed:</label>
                <input type="range" min="0.1" max="3" step="0.1" v-model.number="animationSpeed" />
                <span>{{ animationSpeed.toFixed(1) }}x</span>
              </div>
            </div>
          </div>
          <div ref="threeContainer" class="three-container">
            <div v-if="!selectedAnimation && !customPreviewAnimation" class="placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm3 3h6v6H9V9z"/>
              </svg>
              <p>Select an animation to preview</p>
            </div>
          </div>
        </div>

        <!-- Details Section -->
        <div class="details-section" v-if="selectedAnimation || customPreviewAnimation">
          <div class="details-tabs">
            <button :class="['tab', { active: activeTab === 'info' }]" @click="activeTab = 'info'">Info</button>
            <button :class="['tab', { active: activeTab === 'code' }]" @click="activeTab = 'code'">Lua Code</button>
            <button :class="['tab', { active: activeTab === 'steps' }]" @click="activeTab = 'steps'">How to Apply</button>
          </div>

          <!-- Info Tab -->
          <div v-if="activeTab === 'info'" class="tab-content">
            <div class="info-grid">
              <div class="info-item">
                <label>Animation</label>
                <span>{{ currentAnim.name }}</span>
              </div>
              <div class="info-item">
                <label>Category</label>
                <span>{{ currentAnim.category }}</span>
              </div>
              <div class="info-item">
                <label>Type</label>
                <span>{{ currentAnim.looping ? 'Looping' : 'One-shot' }}</span>
              </div>
              <div class="info-item">
                <label>Duration</label>
                <span>{{ currentAnim.duration }}s</span>
              </div>
              <div class="info-item full-width">
                <label>Description</label>
                <span>{{ currentAnim.description }}</span>
              </div>
              <div class="info-item full-width">
                <label>Best For</label>
                <span>{{ currentAnim.bestFor }}</span>
              </div>
            </div>
          </div>

          <!-- Code Tab -->
          <div v-if="activeTab === 'code'" class="tab-content">
            <div class="code-header">
              <span class="code-lang">Lua</span>
              <button class="copy-btn" @click="copyCode">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                {{ copySuccess ? 'Copied!' : 'Copy Code' }}
              </button>
            </div>
            <pre class="code-block"><code>{{ currentLuaCode }}</code></pre>
          </div>

          <!-- Steps Tab -->
          <div v-if="activeTab === 'steps'" class="tab-content">
            <div class="steps-list">
              <div class="step" v-for="(step, idx) in applicationSteps" :key="idx">
                <div class="step-number">{{ idx + 1 }}</div>
                <div class="step-content">
                  <h4>{{ step.title }}</h4>
                  <p>{{ step.description }}</p>
                  <pre v-if="step.code" class="step-code"><code>{{ step.code }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Animation Request Modal -->
    <div v-if="showCustomRequest" class="modal-overlay" @click.self="showCustomRequest = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Request Custom Animation</h3>
          <button class="close-btn" @click="showCustomRequest = false">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">
            Describe the animation you want. Our AI will generate the Lua code and a Three.js preview.
          </p>
          <textarea
            v-model="customDescription"
            placeholder="Example: A part that spins while moving in a figure-8 pattern, gradually changing color from red to blue..."
            rows="4"
            class="custom-textarea"
          ></textarea>
          <div class="custom-options">
            <label class="option-group">
              <span>Target Part:</span>
              <select v-model="customPartType">
                <option value="Part">Part (Block)</option>
                <option value="SpherePart">Sphere</option>
                <option value="CylinderPart">Cylinder</option>
                <option value="WedgePart">Wedge</option>
                <option value="MeshPart">MeshPart</option>
                <option value="Model">Model</option>
              </select>
            </label>
            <label class="option-group">
              <span>Looping:</span>
              <select v-model="customLooping">
                <option :value="true">Yes (Loop)</option>
                <option :value="false">No (One-shot)</option>
              </select>
            </label>
            <label class="option-group">
              <span>Duration (s):</span>
              <input type="number" v-model.number="customDuration" min="0.5" max="30" step="0.5" />
            </label>
          </div>
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

    <!-- Toast Notification -->
    <transition name="toast">
      <div v-if="toastMessage" class="toast" :class="toastType">
        {{ toastMessage }}
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useRobloxAI } from '@/services/roblox.service';

// ─── Types ───
interface RobloxAnimation {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  bestFor: string;
  looping: boolean;
  duration: number;
  luaCode: string;
  threeAnimator: (part: THREE.Group, t: number, dt: number, speed: number) => void;
}

interface ApplicationStep {
  title: string;
  description: string;
  code?: string;
}

interface CharacterDef {
  id: string;
  name: string;
  headColor: number;
  torsoColor: number;
  limbColor: number;
}

// ─── Service ───
const robloxAI = useRobloxAI();

// ─── State ───
const searchQuery = ref('');
const selectedCategory = ref('');
const selectedAnimation = ref<RobloxAnimation | null>(null);
const customPreviewAnimation = ref<RobloxAnimation | null>(null);
const activeTab = ref('info');
const isPlaying = ref(true);
const animationSpeed = ref(1.0);
const copySuccess = ref(false);
const showCustomRequest = ref(false);
const customDescription = ref('');
const customPartType = ref('Part');
const customLooping = ref(true);
const customDuration = ref(2);
const customLoading = ref(false);
const toastMessage = ref('');
const toastType = ref('success');
const selectedCharacter = ref('default');

// Three.js refs
const threeContainer = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationFrame: number;
let clock: THREE.Clock;
let characterGroup: THREE.Group;
let partGroup: THREE.Group;
let gridHelper: THREE.GridHelper;

// ─── Characters ───
const characters: CharacterDef[] = [
  { id: 'default', name: 'Classic Robloxian', headColor: 0xf5c542, torsoColor: 0x0057a8, limbColor: 0xf5c542 },
  { id: 'noob', name: 'Noob', headColor: 0xf5c542, torsoColor: 0x0057ff, limbColor: 0xf5c542 },
  { id: 'guest', name: 'Guest', headColor: 0xcccccc, torsoColor: 0x444444, limbColor: 0xcccccc },
  { id: 'bacon', name: 'Bacon Hair', headColor: 0xf5c542, torsoColor: 0x8b4513, limbColor: 0xf5c542 },
  { id: 'robot', name: 'Robot', headColor: 0x888888, torsoColor: 0x555555, limbColor: 0x888888 },
  { id: 'zombie', name: 'Zombie', headColor: 0x7cba3f, torsoColor: 0x3d5c1e, limbColor: 0x7cba3f },
  { id: 'knight', name: 'Knight', headColor: 0xaaaaaa, torsoColor: 0x666666, limbColor: 0xaaaaaa },
  { id: 'alien', name: 'Alien', headColor: 0x44ff88, torsoColor: 0x227744, limbColor: 0x44ff88 },
];

// ─── Categories ───
const categories = ['Movement', 'Rotation', 'Scale', 'Color', 'Complex', 'Character', 'Physics', 'UI/FX'];

// ─── 50 Animations ───
const allAnimations: RobloxAnimation[] = [
  // ═══ Movement (1–10) ═══
  {
    id: 'move-left-right',
    name: 'Move Left to Right',
    category: 'Movement',
    icon: '➡️',
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
    description: 'Smoothly moves a part from left to right along the X axis using TweenService.',
    bestFor: 'Sliding doors, platform obstacles, moving platforms',
    looping: true,
    duration: 2,
    luaCode: `-- Move Left to Right Animation
-- Place this Script inside the Part you want to animate

local TweenService = game:GetService("TweenService")
local part = script.Parent

local startPos = part.Position
local endPos = startPos + Vector3.new(10, 0, 0)

local tweenInfo = TweenInfo.new(
    2,                          -- Duration (seconds)
    Enum.EasingStyle.Sine,      -- Easing style
    Enum.EasingDirection.InOut, -- Easing direction
    -1,                         -- RepeatCount (-1 = infinite)
    true,                       -- Reverses
    0                           -- DelayTime
)

local tween = TweenService:Create(part, tweenInfo, {Position = endPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = Math.sin(t * speed) * 3;
    }
  },
  {
    id: 'move-right-left',
    name: 'Move Right to Left',
    category: 'Movement',
    icon: '⬅️',
    color: 'linear-gradient(135deg, #f093fb, #f5576c)',
    description: 'Moves a part from right to left along the X axis.',
    bestFor: 'Reverse sliding doors, enemies approaching, horizontal conveyors',
    looping: true,
    duration: 2,
    luaCode: `-- Move Right to Left Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local startPos = part.Position
local endPos = startPos + Vector3.new(-10, 0, 0)

local tweenInfo = TweenInfo.new(
    2,
    Enum.EasingStyle.Sine,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Position = endPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = -Math.sin(t * speed) * 3;
    }
  },
  {
    id: 'move-up',
    name: 'Move Up',
    category: 'Movement',
    icon: '⬆️',
    color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    description: 'Elevates the part upward along the Y axis.',
    bestFor: 'Elevators, rising platforms, launching projectiles',
    looping: true,
    duration: 2,
    luaCode: `-- Move Up Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local startPos = part.Position
local endPos = startPos + Vector3.new(0, 10, 0)

local tweenInfo = TweenInfo.new(
    2,
    Enum.EasingStyle.Quad,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Position = endPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.y = Math.abs(Math.sin(t * speed)) * 3 + 0.5;
    }
  },
  {
    id: 'move-down',
    name: 'Move Down',
    category: 'Movement',
    icon: '⬇️',
    color: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    description: 'Lowers the part downward along the Y axis.',
    bestFor: 'Falling traps, descending platforms, gravity effects',
    looping: true,
    duration: 2,
    luaCode: `-- Move Down Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local startPos = part.Position
local endPos = startPos + Vector3.new(0, -10, 0)

local tweenInfo = TweenInfo.new(
    2,
    Enum.EasingStyle.Quad,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Position = endPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.y = -Math.abs(Math.sin(t * speed)) * 2 + 2;
    }
  },
  {
    id: 'move-up-down',
    name: 'Move Up and Down',
    category: 'Movement',
    icon: '↕️',
    color: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    description: 'Bounces the part vertically in a smooth sine wave.',
    bestFor: 'Floating platforms, bobbing items, bouncing objects',
    looping: true,
    duration: 2,
    luaCode: `-- Move Up and Down (Bobbing) Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local startPos = part.Position
local upPos = startPos + Vector3.new(0, 5, 0)

local tweenInfo = TweenInfo.new(
    1,
    Enum.EasingStyle.Sine,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Position = upPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.y = Math.sin(t * speed * 2) * 1.5 + 1.5;
    }
  },
  {
    id: 'move-down-up',
    name: 'Move Down to Up',
    category: 'Movement',
    icon: '🔄',
    color: 'linear-gradient(135deg, #fa709a, #fee140)',
    description: 'Starts from a lower position and moves upward repeatedly.',
    bestFor: 'Pop-up obstacles, rising hazards, spring mechanisms',
    looping: true,
    duration: 2,
    luaCode: `-- Move Down to Up Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local lowPos = part.Position + Vector3.new(0, -5, 0)
local highPos = part.Position + Vector3.new(0, 5, 0)

part.Position = lowPos

local tweenInfo = TweenInfo.new(
    2,
    Enum.EasingStyle.Back,
    Enum.EasingDirection.Out,
    -1, true, 0.5
)

local tween = TweenService:Create(part, tweenInfo, {Position = highPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      const phase = ((t * speed) % (Math.PI * 2)) / (Math.PI * 2);
      part.position.y = phase < 0.5 ? -1 + phase * 6 : 2 - (phase - 0.5) * 6;
    }
  },
  {
    id: 'walking',
    name: 'Walking Motion',
    category: 'Character',
    icon: '🚶',
    color: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
    description: 'Simulates a walking motion with alternating leg-like movements.',
    bestFor: 'NPCs, character walk cycles, animated mannequins',
    looping: true,
    duration: 1,
    luaCode: `-- Walking Motion Animation
-- Place inside a Model with humanoid-like parts
local TweenService = game:GetService("TweenService")
local part = script.Parent

-- Simulate forward walking with slight bob
local RunService = game:GetService("RunService")
local startPos = part.Position
local startRot = part.CFrame

local time = 0
RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local bobY = math.sin(time * 8) * 0.3
    local swayZ = math.sin(time * 4) * 0.1
    local moveX = math.sin(time * 2) * 5

    part.CFrame = CFrame.new(
        startPos.X + moveX,
        startPos.Y + bobY,
        startPos.Z
    ) * CFrame.Angles(0, 0, swayZ)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = Math.sin(t * speed * 2) * 2;
      part.position.y = Math.abs(Math.sin(t * speed * 4)) * 0.4 + 0.5;
      part.rotation.z = Math.sin(t * speed * 4) * 0.1;
    }
  },
  {
    id: 'fly',
    name: 'Flying / Hover',
    category: 'Movement',
    icon: '🦅',
    color: 'linear-gradient(135deg, #89f7fe, #66a6ff)',
    description: 'Makes the part hover and drift through the air with gentle oscillation.',
    bestFor: 'Flying NPCs, drones, floating collectibles',
    looping: true,
    duration: 3,
    luaCode: `-- Flying / Hover Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local hoverY = math.sin(time * 1.5) * 2
    local driftX = math.sin(time * 0.8) * 3
    local driftZ = math.cos(time * 0.6) * 2
    local tiltX = math.sin(time * 1.5) * math.rad(5)
    local tiltZ = math.cos(time * 0.8) * math.rad(8)

    part.CFrame = CFrame.new(
        startPos.X + driftX,
        startPos.Y + 5 + hoverY,
        startPos.Z + driftZ
    ) * CFrame.Angles(tiltX, time * 0.3, tiltZ)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = Math.sin(t * speed * 0.8) * 2;
      part.position.y = Math.sin(t * speed * 1.5) * 1 + 3;
      part.position.z = Math.cos(t * speed * 0.6) * 1.5;
      part.rotation.x = Math.sin(t * speed * 1.5) * 0.1;
      part.rotation.z = Math.cos(t * speed * 0.8) * 0.15;
    }
  },
  {
    id: 'loop-moving',
    name: 'Loop Moving (Circle)',
    category: 'Movement',
    icon: '🔁',
    color: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
    description: 'Moves the part in a circular loop path on the XZ plane.',
    bestFor: 'Orbiting objects, patrol paths, decorative motions',
    looping: true,
    duration: 4,
    luaCode: `-- Loop Moving (Circular Path) Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local center = part.Position
local radius = 8
local speed = 1
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * speed
    local x = center.X + math.cos(time) * radius
    local z = center.Z + math.sin(time) * radius
    local angle = math.atan2(math.cos(time), -math.sin(time))

    part.CFrame = CFrame.new(x, center.Y, z) * CFrame.Angles(0, angle, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const radius = 2.5;
      part.position.x = Math.cos(t * speed) * radius;
      part.position.z = Math.sin(t * speed) * radius;
      part.rotation.y = -t * speed + Math.PI / 2;
    }
  },
  {
    id: 'forward-back',
    name: 'Move Forward & Back',
    category: 'Movement',
    icon: '↔️',
    color: 'linear-gradient(135deg, #d4fc79, #96e6a1)',
    description: 'Oscillates the part along the Z axis (forward and backward).',
    bestFor: 'Piston mechanisms, breathing animations, push/pull doors',
    looping: true,
    duration: 2,
    luaCode: `-- Move Forward & Back Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local startPos = part.Position
local endPos = startPos + Vector3.new(0, 0, 10)

local tweenInfo = TweenInfo.new(
    2,
    Enum.EasingStyle.Sine,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Position = endPos})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.z = Math.sin(t * speed) * 3;
    }
  },

  // ═══ Rotation (11–20) ═══
  {
    id: 'spin-y',
    name: 'Spin (Y Axis)',
    category: 'Rotation',
    icon: '🌀',
    color: 'linear-gradient(135deg, #f6d365, #fda085)',
    description: 'Continuously spins the part around the vertical Y axis.',
    bestFor: 'Coins, power-ups, display pedestals, rotating signs',
    looping: true,
    duration: 2,
    luaCode: `-- Spin on Y Axis Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local speed = math.rad(180) -- 180 degrees per second

RunService.Heartbeat:Connect(function(dt)
    part.CFrame = part.CFrame * CFrame.Angles(0, speed * dt, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.y = t * speed * 2;
    }
  },
  {
    id: 'spin-x',
    name: 'Spin (X Axis)',
    category: 'Rotation',
    icon: '🎡',
    color: 'linear-gradient(135deg, #fbc2eb, #a6c1ee)',
    description: 'Spins the part around the X axis (front flip motion).',
    bestFor: 'Ferris wheels, rolling barrels, tumbling objects',
    looping: true,
    duration: 2,
    luaCode: `-- Spin on X Axis Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local speed = math.rad(180)

RunService.Heartbeat:Connect(function(dt)
    part.CFrame = part.CFrame * CFrame.Angles(speed * dt, 0, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.x = t * speed * 2;
    }
  },
  {
    id: 'spin-z',
    name: 'Spin (Z Axis)',
    category: 'Rotation',
    icon: '🎯',
    color: 'linear-gradient(135deg, #c3cfe2, #f5f7fa)',
    description: 'Spins the part around the Z axis (cartwheel motion).',
    bestFor: 'Propellers, windmills, clock hands',
    looping: true,
    duration: 2,
    luaCode: `-- Spin on Z Axis Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local speed = math.rad(180)

RunService.Heartbeat:Connect(function(dt)
    part.CFrame = part.CFrame * CFrame.Angles(0, 0, speed * dt)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.z = t * speed * 2;
    }
  },
  {
    id: 'tilt-rock',
    name: 'Tilting / Rocking',
    category: 'Rotation',
    icon: '🚢',
    color: 'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
    description: 'Gently rocks the part back and forth like a pendulum.',
    bestFor: 'Ships, pendulums, swinging signs, cradles',
    looping: true,
    duration: 2,
    luaCode: `-- Tilting / Rocking Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startCFrame = part.CFrame
local maxAngle = math.rad(25)
local speed = 2
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * speed
    local angle = math.sin(time) * maxAngle
    part.CFrame = startCFrame * CFrame.Angles(0, 0, angle)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.z = Math.sin(t * speed * 2) * 0.4;
    }
  },
  {
    id: 'wobble',
    name: 'Wobble',
    category: 'Rotation',
    icon: '🍮',
    color: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
    description: 'Multi-axis wobble that makes the part look like jelly.',
    bestFor: 'Jelly blocks, unstable platforms, hit reactions',
    looping: true,
    duration: 1.5,
    luaCode: `-- Wobble Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startCFrame = part.CFrame
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local wobbleX = math.sin(time * 6) * math.rad(8)
    local wobbleZ = math.cos(time * 5) * math.rad(10)
    local wobbleY = math.sin(time * 4) * math.rad(3)

    part.CFrame = startCFrame * CFrame.Angles(wobbleX, wobbleY, wobbleZ)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.x = Math.sin(t * speed * 6) * 0.15;
      part.rotation.z = Math.cos(t * speed * 5) * 0.18;
      part.rotation.y = Math.sin(t * speed * 4) * 0.05;
    }
  },
  {
    id: 'flip-360',
    name: '360° Flip',
    category: 'Rotation',
    icon: '🤸',
    color: 'linear-gradient(135deg, #ff9a9e, #fecfef)',
    description: 'Performs a full 360-degree flip on the X axis at intervals.',
    bestFor: 'Acrobatic NPCs, trick platforms, gymnastic effects',
    looping: true,
    duration: 2,
    luaCode: `-- 360° Flip Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

while true do
    local tweenInfo = TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut)
    local startCF = part.CFrame
    local targetCF = startCF * CFrame.Angles(math.rad(360), 0, 0)

    -- Use RunService for smooth rotation
    local elapsed = 0
    local duration = 0.8
    local conn
    conn = game:GetService("RunService").Heartbeat:Connect(function(dt)
        elapsed = elapsed + dt
        local alpha = math.min(elapsed / duration, 1)
        local easedAlpha = alpha < 0.5
            and 2 * alpha * alpha
            or 1 - (-2 * alpha + 2)^2 / 2
        part.CFrame = startCF * CFrame.Angles(math.rad(360) * easedAlpha, 0, 0)
        if alpha >= 1 then conn:Disconnect() end
    end)

    task.wait(2)
end`,
    threeAnimator: (part, t, _dt, speed) => {
      const cycle = (t * speed) % 4;
      if (cycle < 1.6) {
        const progress = cycle / 1.6;
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        part.rotation.x = eased * Math.PI * 2;
      } else {
        part.rotation.x = 0;
      }
    }
  },
  {
    id: 'helicopter',
    name: 'Helicopter Spin',
    category: 'Rotation',
    icon: '🚁',
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
    description: 'Fast spin on Y axis while slowly hovering up and down.',
    bestFor: 'Helicopter blades, drone rotors, spinning tops',
    looping: true,
    duration: 3,
    luaCode: `-- Helicopter Spin Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local time = 0
local spinSpeed = math.rad(720) -- 2 full rotations per second

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local hover = math.sin(time * 1.5) * 2
    part.CFrame = CFrame.new(startPos.X, startPos.Y + hover, startPos.Z)
        * CFrame.Angles(0, spinSpeed * time, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.y = t * speed * 6;
      part.position.y = Math.sin(t * speed * 1.5) * 1 + 2;
    }
  },
  {
    id: 'orbit-spin',
    name: 'Orbit & Self-Spin',
    category: 'Rotation',
    icon: '🪐',
    color: 'linear-gradient(135deg, #f093fb, #f5576c)',
    description: 'Orbits around a center point while also spinning on its own axis.',
    bestFor: 'Planets, electrons, orbiting decorations',
    looping: true,
    duration: 5,
    luaCode: `-- Orbit & Self-Spin Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local center = part.Position
local orbitRadius = 8
local orbitSpeed = 1
local selfSpinSpeed = math.rad(360)
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local x = center.X + math.cos(time * orbitSpeed) * orbitRadius
    local z = center.Z + math.sin(time * orbitSpeed) * orbitRadius

    part.CFrame = CFrame.new(x, center.Y, z)
        * CFrame.Angles(0, selfSpinSpeed * time, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const r = 2;
      part.position.x = Math.cos(t * speed * 0.8) * r;
      part.position.z = Math.sin(t * speed * 0.8) * r;
      part.rotation.y = t * speed * 4;
    }
  },
  {
    id: 'pendulum',
    name: 'Pendulum Swing',
    category: 'Rotation',
    icon: '🕰️',
    color: 'linear-gradient(135deg, #fddb92, #d1fdff)',
    description: 'Swings like a pendulum from a fixed pivot point.',
    bestFor: 'Clocks, wrecking balls, swinging traps',
    looping: true,
    duration: 2,
    luaCode: `-- Pendulum Swing Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local pivotCFrame = part.CFrame * CFrame.new(0, 3, 0)
local maxAngle = math.rad(45)
local speed = 2.5
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * speed
    local angle = math.sin(time) * maxAngle
    part.CFrame = pivotCFrame
        * CFrame.Angles(0, 0, angle)
        * CFrame.new(0, -3, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const angle = Math.sin(t * speed * 2.5) * 0.7;
      part.position.x = Math.sin(angle) * 2;
      part.position.y = -Math.cos(angle) * 2 + 3;
      part.rotation.z = angle;
    }
  },
  {
    id: 'corkscrew',
    name: 'Corkscrew',
    category: 'Rotation',
    icon: '🌪️',
    color: 'linear-gradient(135deg, #30cfd0, #330867)',
    description: 'Spins on the Y axis while moving upward in a spiral.',
    bestFor: 'Tornadoes, drill effects, ascending particles',
    looping: true,
    duration: 3,
    luaCode: `-- Corkscrew Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local time = 0
local spinSpeed = math.rad(360)
local riseSpeed = 3
local maxHeight = 10

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local height = (time * riseSpeed) % maxHeight
    local spiralX = math.cos(time * 3) * 2
    local spiralZ = math.sin(time * 3) * 2

    part.CFrame = CFrame.new(
        startPos.X + spiralX,
        startPos.Y + height,
        startPos.Z + spiralZ
    ) * CFrame.Angles(0, spinSpeed * time, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const phase = (t * speed) % 6;
      part.position.x = Math.cos(t * speed * 3) * 1.5;
      part.position.z = Math.sin(t * speed * 3) * 1.5;
      part.position.y = (phase / 6) * 5;
      part.rotation.y = t * speed * 4;
    }
  },

  // ═══ Scale (21–26) ═══
  {
    id: 'pulse-scale',
    name: 'Pulse (Scale)',
    category: 'Scale',
    icon: '💓',
    color: 'linear-gradient(135deg, #ff0844, #ffb199)',
    description: 'Pulsates the part size rhythmically like a heartbeat.',
    bestFor: 'Heartbeat effects, interactive buttons, power cores',
    looping: true,
    duration: 1,
    luaCode: `-- Pulse Scale Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local originalSize = part.Size
local pulseSize = originalSize * 1.3

local tweenInfo = TweenInfo.new(
    0.5,
    Enum.EasingStyle.Sine,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Size = pulseSize})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      const s = 1 + Math.sin(t * speed * 4) * 0.2;
      part.scale.set(s, s, s);
    }
  },
  {
    id: 'grow-shrink',
    name: 'Grow & Shrink',
    category: 'Scale',
    icon: '🔍',
    color: 'linear-gradient(135deg, #84fab0, #8fd3f4)',
    description: 'Gradually grows to a larger size and then shrinks back.',
    bestFor: 'Power-ups appearing, explosions charge-up, breath effects',
    looping: true,
    duration: 3,
    luaCode: `-- Grow & Shrink Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local smallSize = part.Size * 0.5
local bigSize = part.Size * 2

part.Size = smallSize

local tweenInfo = TweenInfo.new(
    1.5,
    Enum.EasingStyle.Elastic,
    Enum.EasingDirection.Out,
    -1, true, 0.5
)

local tween = TweenService:Create(part, tweenInfo, {Size = bigSize})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      const s = 0.5 + Math.abs(Math.sin(t * speed)) * 1.2;
      part.scale.set(s, s, s);
    }
  },
  {
    id: 'squash-stretch',
    name: 'Squash & Stretch',
    category: 'Scale',
    icon: '🏀',
    color: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
    description: 'Classic squash and stretch animation principle for bouncy feel.',
    bestFor: 'Bouncing balls, cartoon effects, character jumps',
    looping: true,
    duration: 1,
    luaCode: `-- Squash & Stretch Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local originalSize = part.Size
local startPos = part.Position
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local bounce = math.abs(math.sin(time * 4))
    local squash = 1 - bounce * 0.3
    local stretch = 1 + bounce * 0.4

    part.Size = Vector3.new(
        originalSize.X * (1 + (1 - squash) * 0.5),
        originalSize.Y * stretch,
        originalSize.Z * (1 + (1 - squash) * 0.5)
    )
    part.Position = Vector3.new(
        startPos.X,
        startPos.Y + bounce * 3,
        startPos.Z
    )
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const bounce = Math.abs(Math.sin(t * speed * 4));
      part.scale.set(1 + (1 - bounce) * 0.3, 0.7 + bounce * 0.6, 1 + (1 - bounce) * 0.3);
      part.position.y = bounce * 2;
    }
  },
  {
    id: 'breathe',
    name: 'Breathing Scale',
    category: 'Scale',
    icon: '🫁',
    color: 'linear-gradient(135deg, #a8edea, #fed6e3)',
    description: 'Slowly expands and contracts like breathing.',
    bestFor: 'Ambient creatures, organic structures, living walls',
    looping: true,
    duration: 4,
    luaCode: `-- Breathing Scale Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local originalSize = part.Size
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local breathe = math.sin(time * 1.5) * 0.15 + 1
    part.Size = originalSize * breathe
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const s = 1 + Math.sin(t * speed * 1.5) * 0.15;
      part.scale.set(s, s, s);
    }
  },
  {
    id: 'pop-in',
    name: 'Pop In (Elastic)',
    category: 'Scale',
    icon: '🎈',
    color: 'linear-gradient(135deg, #fbc2eb, #a18cd1)',
    description: 'Part pops into existence with an elastic overshoot effect.',
    bestFor: 'UI elements appearing, item spawns, notification popups',
    looping: true,
    duration: 2,
    luaCode: `-- Pop In (Elastic) Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local fullSize = part.Size

while true do
    part.Size = Vector3.new(0, 0, 0)
    part.Transparency = 1

    local tweenInfo = TweenInfo.new(
        0.6,
        Enum.EasingStyle.Elastic,
        Enum.EasingDirection.Out
    )

    local tween = TweenService:Create(part, tweenInfo, {
        Size = fullSize,
        Transparency = 0
    })
    tween:Play()
    tween.Completed:Wait()

    task.wait(1.5)

    -- Shrink back
    local shrinkInfo = TweenInfo.new(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.In)
    local shrinkTween = TweenService:Create(part, shrinkInfo, {
        Size = Vector3.new(0, 0, 0),
        Transparency = 1
    })
    shrinkTween:Play()
    shrinkTween.Completed:Wait()
end`,
    threeAnimator: (part, t, _dt, speed) => {
      const cycle = (t * speed) % 4;
      let s: number;
      if (cycle < 1.2) {
        const p = cycle / 1.2;
        s = 1 - Math.pow(2, -10 * p) * Math.cos((p * 10 - 0.75) * (2 * Math.PI) / 3);
        if (s < 0) s = 0;
      } else if (cycle < 3) {
        s = 1;
      } else {
        const p = (cycle - 3) / 1;
        s = 1 - p;
        if (s < 0) s = 0;
      }
      part.scale.set(s, s, s);
    }
  },
  {
    id: 'flatten',
    name: 'Flatten & Rise',
    category: 'Scale',
    icon: '🥞',
    color: 'linear-gradient(135deg, #f6d365, #fda085)',
    description: 'Part flattens to the ground then springs back up.',
    bestFor: 'Stomp effects, pancake animations, comedic squash',
    looping: true,
    duration: 2,
    luaCode: `-- Flatten & Rise Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local normalSize = part.Size
local flatSize = Vector3.new(normalSize.X * 1.5, normalSize.Y * 0.1, normalSize.Z * 1.5)

while true do
    local flatInfo = TweenInfo.new(0.2, Enum.EasingStyle.Back, Enum.EasingDirection.In)
    TweenService:Create(part, flatInfo, {Size = flatSize}):Play()
    task.wait(0.3)

    local riseInfo = TweenInfo.new(0.5, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out)
    TweenService:Create(part, riseInfo, {Size = normalSize}):Play()
    task.wait(1.5)
end`,
    threeAnimator: (part, t, _dt, speed) => {
      const cycle = (t * speed) % 4;
      if (cycle < 0.4) {
        const p = cycle / 0.4;
        part.scale.set(1 + p * 0.5, 1 - p * 0.9, 1 + p * 0.5);
      } else if (cycle < 1.4) {
        const p = (cycle - 0.4) / 1.0;
        const elastic = 1 - Math.pow(2, -10 * p) * Math.cos((p * 10 - 0.75) * (2 * Math.PI) / 3);
        part.scale.set(1.5 - elastic * 0.5, 0.1 + elastic * 0.9, 1.5 - elastic * 0.5);
      } else {
        part.scale.set(1, 1, 1);
      }
    }
  },

  // ═══ Color (27–32) ═══
  {
    id: 'color-cycle',
    name: 'Rainbow Color Cycle',
    category: 'Color',
    icon: '🌈',
    color: 'linear-gradient(135deg, #ff0000, #ff7700, #ffff00, #00ff00, #0000ff, #8b00ff)',
    description: 'Smoothly cycles through all rainbow colors using HSV.',
    bestFor: 'Party effects, disco floors, magical items',
    looping: true,
    duration: 5,
    luaCode: `-- Rainbow Color Cycle Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local time = 0
local speed = 0.5

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * speed
    local hue = time % 1
    part.Color = Color3.fromHSV(hue, 1, 1)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const hue = (t * speed * 0.3) % 1;
      const color = new THREE.Color();
      color.setHSL(hue, 1, 0.5);
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && 'color' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).color = color;
          }
        }
      });
    }
  },
  {
    id: 'flash',
    name: 'Flash / Blink',
    category: 'Color',
    icon: '💡',
    color: 'linear-gradient(135deg, #fff, #333)',
    description: 'Rapidly alternates between visible and transparent.',
    bestFor: 'Warning lights, invincibility frames, alert indicators',
    looping: true,
    duration: 1,
    luaCode: `-- Flash / Blink Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local time = 0
local flashSpeed = 4

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * flashSpeed
    part.Transparency = math.floor(time % 2) == 0 and 0 or 0.8
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const visible = Math.floor(t * speed * 4) % 2 === 0;
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && 'opacity' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).opacity = visible ? 1 : 0.2;
            (mesh.material as THREE.MeshStandardMaterial).transparent = true;
          }
        }
      });
    }
  },
  {
    id: 'glow-pulse',
    name: 'Glow Pulse',
    category: 'Color',
    icon: '✨',
    color: 'linear-gradient(135deg, #fcb045, #fd1d1d, #833ab4)',
    description: 'Emits a pulsating glow effect using PointLight intensity.',
    bestFor: 'Lanterns, magical orbs, energy sources',
    looping: true,
    duration: 2,
    luaCode: `-- Glow Pulse Animation
local RunService = game:GetService("RunService")
local part = script.Parent

-- Create PointLight if not exists
local light = part:FindFirstChildOfClass("PointLight")
if not light then
    light = Instance.new("PointLight")
    light.Color = Color3.fromRGB(255, 200, 50)
    light.Range = 15
    light.Parent = part
end

local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    light.Brightness = 1 + math.sin(time * 3) * 0.8
    part.Transparency = math.sin(time * 3) * 0.15
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const glow = 0.5 + Math.sin(t * speed * 3) * 0.5;
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && 'emissiveIntensity' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
          }
        }
      });
    }
  },
  {
    id: 'fade-in-out',
    name: 'Fade In & Out',
    category: 'Color',
    icon: '👻',
    color: 'linear-gradient(135deg, rgba(255,255,255,0.8), rgba(255,255,255,0.1))',
    description: 'Smoothly fades between fully visible and fully transparent.',
    bestFor: 'Ghosts, appearing/disappearing objects, stealth effects',
    looping: true,
    duration: 3,
    luaCode: `-- Fade In & Out Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local tweenInfo = TweenInfo.new(
    1.5,
    Enum.EasingStyle.Sine,
    Enum.EasingDirection.InOut,
    -1, true, 0
)

local tween = TweenService:Create(part, tweenInfo, {Transparency = 1})
tween:Play()`,
    threeAnimator: (part, t, _dt, speed) => {
      const alpha = (Math.sin(t * speed * 1.5) + 1) / 2;
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && 'opacity' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).opacity = 0.1 + alpha * 0.9;
            (mesh.material as THREE.MeshStandardMaterial).transparent = true;
          }
        }
      });
    }
  },
  {
    id: 'color-lerp',
    name: 'Two-Color Lerp',
    category: 'Color',
    icon: '🎨',
    color: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
    description: 'Smoothly interpolates between two colors.',
    bestFor: 'Temperature indicators, health bars, mood lighting',
    looping: true,
    duration: 2,
    luaCode: `-- Two-Color Lerp Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local colorA = Color3.fromRGB(255, 60, 60)   -- Red
local colorB = Color3.fromRGB(60, 200, 200)  -- Cyan

local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local alpha = (math.sin(time * 2) + 1) / 2
    part.Color = colorA:Lerp(colorB, alpha)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const alpha = (Math.sin(t * speed * 2) + 1) / 2;
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0xff3c3c),
        new THREE.Color(0x3cc8c8),
        alpha
      );
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh & { material: THREE.MeshStandardMaterial }).material.color = color;
        }
      });
    }
  },
  {
    id: 'neon-flicker',
    name: 'Neon Flicker',
    category: 'Color',
    icon: '🔦',
    color: 'linear-gradient(135deg, #00ff88, #005533)',
    description: 'Simulates a flickering neon light with random intensity.',
    bestFor: 'Neon signs, broken lights, horror ambiance',
    looping: true,
    duration: 2,
    luaCode: `-- Neon Flicker Animation
local RunService = game:GetService("RunService")
local part = script.Parent

part.Material = Enum.Material.Neon
local baseColor = part.Color
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local flicker = math.random() > 0.85 and 0.3 or 1
    local pulse = math.sin(time * 10) * 0.2 + 0.8
    part.Transparency = 1 - (flicker * pulse)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const flicker = Math.sin(t * speed * 30) > 0.3 ? 1 : 0.3;
      const pulse = Math.sin(t * speed * 10) * 0.2 + 0.8;
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material && 'opacity' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).opacity = flicker * pulse;
            (mesh.material as THREE.MeshStandardMaterial).transparent = true;
          }
        }
      });
    }
  },

  // ═══ Complex (33–40) ═══
  {
    id: 'figure-8',
    name: 'Figure-8 Path',
    category: 'Complex',
    icon: '♾️',
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
    description: 'Moves the part in a figure-eight (lemniscate) pattern.',
    bestFor: 'Patrol drones, elegant decoration, complex paths',
    looping: true,
    duration: 4,
    luaCode: `-- Figure-8 Path Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local center = part.Position
local scale = 6
local speed = 1.5
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * speed
    -- Lemniscate of Bernoulli
    local x = math.sin(time) * scale
    local z = math.sin(time) * math.cos(time) * scale

    part.CFrame = CFrame.new(center.X + x, center.Y, center.Z + z)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const s = 2.5;
      part.position.x = Math.sin(t * speed * 1.5) * s;
      part.position.z = Math.sin(t * speed * 1.5) * Math.cos(t * speed * 1.5) * s;
    }
  },
  {
    id: 'zigzag',
    name: 'Zigzag Path',
    category: 'Complex',
    icon: '⚡',
    color: 'linear-gradient(135deg, #f093fb, #f5576c)',
    description: 'Moves in a sharp zigzag pattern along the XZ plane.',
    bestFor: 'Lightning bolts, evasive movement, puzzle obstacles',
    looping: true,
    duration: 4,
    luaCode: `-- Zigzag Path Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local speed = 3
local amplitude = 5
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt * speed
    local x = (time % 10) - 5  -- Linear movement
    local z = amplitude * (2 * math.abs(((time * 2) % 2) - 1) - 1)  -- Triangle wave

    part.Position = Vector3.new(startPos.X + x, startPos.Y, startPos.Z + z)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const phase = (t * speed) % 4;
      part.position.x = (phase - 2) * 1.5;
      part.position.z = (2 * Math.abs(((t * speed * 2) % 2) - 1) - 1) * 2;
    }
  },
  {
    id: 'spiral-rise',
    name: 'Spiral Rise',
    category: 'Complex',
    icon: '🧬',
    color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    description: 'Rises upward while spiraling in a helix pattern.',
    bestFor: 'DNA strands, ascending portals, tornado effects',
    looping: true,
    duration: 5,
    luaCode: `-- Spiral Rise Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local center = part.Position
local radius = 4
local riseSpeed = 2
local spinSpeed = 3
local maxHeight = 15
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local height = (time * riseSpeed) % maxHeight
    local angle = time * spinSpeed
    local x = math.cos(angle) * radius
    local z = math.sin(angle) * radius

    part.CFrame = CFrame.new(
        center.X + x,
        center.Y + height,
        center.Z + z
    ) * CFrame.Angles(0, -angle, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const height = (t * speed * 0.8) % 5;
      const angle = t * speed * 3;
      part.position.x = Math.cos(angle) * 1.5;
      part.position.z = Math.sin(angle) * 1.5;
      part.position.y = height;
      part.rotation.y = -angle;
    }
  },
  {
    id: 'bounce',
    name: 'Realistic Bounce',
    category: 'Complex',
    icon: '⛹️',
    color: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    description: 'Physics-like bouncing with gravity and energy loss.',
    bestFor: 'Bouncing balls, dropped items, gravity demos',
    looping: true,
    duration: 3,
    luaCode: `-- Realistic Bounce Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startY = part.Position.Y
local velocity = 0
local gravity = -30
local bounciness = 0.7
local groundY = startY
local time = 0

part.Position = part.Position + Vector3.new(0, 8, 0)

RunService.Heartbeat:Connect(function(dt)
    velocity = velocity + gravity * dt
    local newY = part.Position.Y + velocity * dt

    if newY <= groundY then
        newY = groundY
        velocity = -velocity * bounciness
        if math.abs(velocity) < 0.5 then
            velocity = 15 -- Reset for loop
        end
    end

    part.Position = Vector3.new(part.Position.X, newY, part.Position.Z)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const cycle = (t * speed) % 3;
      const bounceHeight = Math.abs(Math.sin(cycle * Math.PI)) * Math.exp(-cycle * 0.5) * 4;
      part.position.y = bounceHeight;
      const squash = bounceHeight < 0.1 ? 0.6 : 1;
      part.scale.set(1 + (1 - squash) * 0.5, squash, 1 + (1 - squash) * 0.5);
    }
  },
  {
    id: 'wave-motion',
    name: 'Wave Motion',
    category: 'Complex',
    icon: '🌊',
    color: 'linear-gradient(135deg, #0575e6, #021b79)',
    description: 'Moves in a wave-like sinusoidal pattern combining X and Y.',
    bestFor: 'Ocean waves, flag waving, snake-like movement',
    looping: true,
    duration: 3,
    luaCode: `-- Wave Motion Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local waveX = math.sin(time * 2) * 5
    local waveY = math.cos(time * 3) * 2
    local tilt = math.sin(time * 2) * math.rad(15)

    part.CFrame = CFrame.new(
        startPos.X + waveX,
        startPos.Y + waveY,
        startPos.Z
    ) * CFrame.Angles(0, 0, tilt)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = Math.sin(t * speed * 2) * 2.5;
      part.position.y = Math.cos(t * speed * 3) * 1 + 1;
      part.rotation.z = Math.sin(t * speed * 2) * 0.25;
    }
  },
  {
    id: 'earthquake',
    name: 'Earthquake Shake',
    category: 'Complex',
    icon: '💥',
    color: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
    description: 'Rapid random shaking simulating an earthquake.',
    bestFor: 'Explosions, damage feedback, dramatic camera effects',
    looping: true,
    duration: 2,
    luaCode: `-- Earthquake Shake Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local startCF = part.CFrame
local intensity = 0.5
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local shakeX = (math.random() - 0.5) * 2 * intensity
    local shakeY = (math.random() - 0.5) * 2 * intensity * 0.5
    local shakeZ = (math.random() - 0.5) * 2 * intensity
    local rotShake = (math.random() - 0.5) * math.rad(5)

    part.CFrame = CFrame.new(
        startPos.X + shakeX,
        startPos.Y + shakeY,
        startPos.Z + shakeZ
    ) * CFrame.Angles(rotShake, rotShake * 0.5, rotShake)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const i = 0.15;
      part.position.x = (Math.random() - 0.5) * i * 2 * speed;
      part.position.y = (Math.random() - 0.5) * i * speed + 0.5;
      part.position.z = (Math.random() - 0.5) * i * 2 * speed;
      part.rotation.x = (Math.random() - 0.5) * 0.1;
      part.rotation.z = (Math.random() - 0.5) * 0.1;
    }
  },
  {
    id: 'teleport-flash',
    name: 'Teleport Flash',
    category: 'Complex',
    icon: '⚡',
    color: 'linear-gradient(135deg, #f7971e, #ffd200)',
    description: 'Instantly teleports to random positions with a flash effect.',
    bestFor: 'Teleporters, ghost enemies, magic effects',
    looping: true,
    duration: 3,
    luaCode: `-- Teleport Flash Animation
local TweenService = game:GetService("TweenService")
local part = script.Parent

local center = part.Position
local range = 10

while true do
    -- Flash out
    local flashOut = TweenService:Create(part,
        TweenInfo.new(0.1, Enum.EasingStyle.Quad),
        {Transparency = 1, Size = part.Size * 0.1}
    )
    flashOut:Play()
    flashOut.Completed:Wait()

    -- Teleport
    local newPos = center + Vector3.new(
        math.random(-range, range),
        math.random(0, range/2),
        math.random(-range, range)
    )
    part.Position = newPos

    -- Flash in
    local flashIn = TweenService:Create(part,
        TweenInfo.new(0.15, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out),
        {Transparency = 0, Size = part.Size * 10}
    )

    part.Size = part.Size * 0.1
    flashIn:Play()
    flashIn.Completed:Wait()

    task.wait(1 + math.random() * 1.5)
end`,
    threeAnimator: (part, t, _dt, speed) => {
      const cycle = (t * speed) % 3;
      if (cycle < 0.1) {
        part.scale.set(0.1, 0.1, 0.1);
      } else if (cycle < 0.3) {
        const p = (cycle - 0.1) / 0.2;
        part.scale.set(p, p, p);
        part.position.x = (Math.sin(Math.floor(t) * 123.456) * 2);
        part.position.z = (Math.cos(Math.floor(t) * 789.012) * 2);
        part.position.y = Math.abs(Math.sin(Math.floor(t) * 345.678)) * 2;
      } else {
        part.scale.set(1, 1, 1);
      }
    }
  },
  {
    id: 'conveyor',
    name: 'Conveyor Belt',
    category: 'Complex',
    icon: '🏭',
    color: 'linear-gradient(135deg, #bdc3c7, #2c3e50)',
    description: 'Applies surface velocity to simulate a conveyor belt that moves parts on top.',
    bestFor: 'Factory conveyors, treadmills, escalators',
    looping: true,
    duration: 1,
    luaCode: `-- Conveyor Belt Animation
-- This uses AssemblyLinearVelocity on surface
local RunService = game:GetService("RunService")
local part = script.Parent

-- Set the velocity on the surface
local speed = 10 -- studs per second
local direction = Vector3.new(1, 0, 0) -- X direction

-- Option 1: Using Velocity property (simpler)
part.AssemblyLinearVelocity = direction * speed

-- Option 2: Using surface texture scrolling for visual
local texture = Instance.new("Texture")
texture.Face = Enum.NormalId.Top
texture.Texture = "rbxassetid://0" -- Replace with your texture ID
texture.StudsPerTileU = 4
texture.StudsPerTileV = 4
texture.Parent = part

local time = 0
RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    texture.OffsetStudsU = time * speed * 0.2
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      // Visual: just show spinning rollers effect by rotating
      part.rotation.z = t * speed * 3;
    }
  },

  // ═══ Character Animations (41–45) ═══
  {
    id: 'jump',
    name: 'Jump Animation',
    category: 'Character',
    icon: '🦘',
    color: 'linear-gradient(135deg, #fa709a, #fee140)',
    description: 'Makes the character/part perform a jump with squash and stretch.',
    bestFor: 'Character jumps, NPC reactions, interactive triggers',
    looping: true,
    duration: 2,
    luaCode: `-- Jump Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local originalSize = part.Size
local time = 0
local jumpHeight = 8
local jumpDuration = 0.6

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local phase = time % 2

    if phase < 0.1 then
        -- Crouch (squash)
        part.Size = Vector3.new(originalSize.X * 1.2, originalSize.Y * 0.6, originalSize.Z * 1.2)
        part.Position = startPos + Vector3.new(0, -originalSize.Y * 0.2, 0)
    elseif phase < jumpDuration then
        -- Jumping
        local t = (phase - 0.1) / (jumpDuration - 0.1)
        local height = jumpHeight * math.sin(t * math.pi)
        part.Size = Vector3.new(originalSize.X * 0.9, originalSize.Y * 1.2, originalSize.Z * 0.9)
        part.Position = startPos + Vector3.new(0, height, 0)
    else
        -- Landed
        part.Size = originalSize
        part.Position = startPos
    end
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const phase = (t * speed) % 2;
      if (phase < 0.1) {
        part.scale.set(1.2, 0.6, 1.2);
        part.position.y = -0.2;
      } else if (phase < 0.8) {
        const p = (phase - 0.1) / 0.7;
        part.position.y = Math.sin(p * Math.PI) * 3;
        part.scale.set(0.9, 1.2, 0.9);
      } else {
        part.position.y = 0;
        part.scale.set(1, 1, 1);
      }
    }
  },
  {
    id: 'dance',
    name: 'Dance Moves',
    category: 'Character',
    icon: '💃',
    color: 'linear-gradient(135deg, #f093fb, #f5576c)',
    description: 'Rhythmic side-to-side swaying with rotation for dance effect.',
    bestFor: 'Dance floors, celebration NPCs, party effects',
    looping: true,
    duration: 2,
    luaCode: `-- Dance Moves Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local startCF = part.CFrame
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local swayX = math.sin(time * 4) * 1.5
    local bobY = math.abs(math.sin(time * 8)) * 0.5
    local twist = math.sin(time * 4) * math.rad(15)
    local tilt = math.sin(time * 2) * math.rad(10)

    part.CFrame = CFrame.new(
        startPos.X + swayX,
        startPos.Y + bobY,
        startPos.Z
    ) * CFrame.Angles(tilt, twist, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = Math.sin(t * speed * 4) * 0.8;
      part.position.y = Math.abs(Math.sin(t * speed * 8)) * 0.3 + 0.5;
      part.rotation.y = Math.sin(t * speed * 4) * 0.3;
      part.rotation.x = Math.sin(t * speed * 2) * 0.15;
    }
  },
  {
    id: 'wave-hand',
    name: 'Wave (Greeting)',
    category: 'Character',
    icon: '👋',
    color: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
    description: 'Simple waving motion like greeting someone.',
    bestFor: 'NPC greetings, welcome screens, interactive characters',
    looping: true,
    duration: 2,
    luaCode: `-- Wave (Greeting) Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startCF = part.CFrame
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local wave = math.sin(time * 6) * math.rad(20)
    part.CFrame = startCF * CFrame.Angles(0, 0, wave + math.rad(30))
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.z = Math.sin(t * speed * 6) * 0.35 + 0.5;
    }
  },
  {
    id: 'run',
    name: 'Running Motion',
    category: 'Character',
    icon: '🏃',
    color: 'linear-gradient(135deg, #667eea, #764ba2)',
    description: 'Faster walking motion with more pronounced body movements.',
    bestFor: 'Running NPCs, chase sequences, sprint animations',
    looping: true,
    duration: 1,
    luaCode: `-- Running Motion Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local bobY = math.abs(math.sin(time * 12)) * 0.5
    local leanForward = math.rad(15)
    local moveX = time * 8

    part.CFrame = CFrame.new(
        startPos.X + (moveX % 20) - 10,
        startPos.Y + bobY,
        startPos.Z
    ) * CFrame.Angles(leanForward, 0, math.sin(time * 12) * math.rad(5))
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.x = ((t * speed * 3) % 8) - 4;
      part.position.y = Math.abs(Math.sin(t * speed * 12)) * 0.3 + 0.5;
      part.rotation.x = 0.25;
      part.rotation.z = Math.sin(t * speed * 12) * 0.1;
    }
  },
  {
    id: 'idle-breathe',
    name: 'Idle Breathing',
    category: 'Character',
    icon: '😌',
    color: 'linear-gradient(135deg, #a8edea, #fed6e3)',
    description: 'Subtle idle animation with gentle breathing and slight sway.',
    bestFor: 'Idle NPCs, standing characters, ambient life',
    looping: true,
    duration: 4,
    luaCode: `-- Idle Breathing Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local startCF = part.CFrame
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local breathe = math.sin(time * 1.5) * 0.1
    local sway = math.sin(time * 0.8) * 0.05
    local headBob = math.sin(time * 1.2) * 0.02

    part.CFrame = CFrame.new(
        startPos.X + sway,
        startPos.Y + breathe,
        startPos.Z
    ) * CFrame.Angles(headBob, sway * 2, 0)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.y = Math.sin(t * speed * 1.5) * 0.08 + 0.5;
      part.position.x = Math.sin(t * speed * 0.8) * 0.03;
      part.rotation.y = Math.sin(t * speed * 0.8) * 0.05;
    }
  },

  // ═══ Physics & FX (46–50) ═══
  {
    id: 'magnet-attract',
    name: 'Magnetic Attraction',
    category: 'Physics',
    icon: '🧲',
    color: 'linear-gradient(135deg, #c471f5, #fa71cd)',
    description: 'Simulates being pulled toward a center point with oscillation.',
    bestFor: 'Black holes, magnets, item collection effects',
    looping: true,
    duration: 3,
    luaCode: `-- Magnetic Attraction Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local center = part.Position
local offset = Vector3.new(10, 5, 10)
part.Position = center + offset

local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local decay = math.exp(-time * 0.5)
    local orbit = decay * 8

    part.Position = center + Vector3.new(
        math.cos(time * 3) * orbit,
        math.sin(time * 4) * orbit * 0.5,
        math.sin(time * 3) * orbit
    )

    if decay < 0.05 then
        time = 0
        part.Position = center + offset
    end
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const cycle = (t * speed) % 5;
      const decay = Math.exp(-cycle * 0.4);
      const orbit = decay * 3;
      part.position.x = Math.cos(cycle * 3) * orbit;
      part.position.y = Math.sin(cycle * 4) * orbit * 0.5 + 1;
      part.position.z = Math.sin(cycle * 3) * orbit;
    }
  },
  {
    id: 'spring-snap',
    name: 'Spring Snap',
    category: 'Physics',
    icon: '🔩',
    color: 'linear-gradient(135deg, #89f7fe, #66a6ff)',
    description: 'Snaps to a position with spring-like oscillation and damping.',
    bestFor: 'UI animations, door mechanisms, elastic connections',
    looping: true,
    duration: 3,
    luaCode: `-- Spring Snap Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local restPos = part.Position
local targetPos = restPos + Vector3.new(8, 0, 0)
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local phase = time % 3

    if phase < 1.5 then
        local t = phase / 1.5
        local spring = 1 - math.exp(-t * 4) * math.cos(t * 15)
        part.Position = restPos:Lerp(targetPos, spring)
    else
        local t = (phase - 1.5) / 1.5
        local spring = 1 - math.exp(-t * 4) * math.cos(t * 15)
        part.Position = targetPos:Lerp(restPos, spring)
    end
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      const phase = (t * speed) % 6;
      let spring: number;
      if (phase < 3) {
        const p = phase / 3;
        spring = 1 - Math.exp(-p * 4) * Math.cos(p * 15);
        part.position.x = spring * 3;
      } else {
        const p = (phase - 3) / 3;
        spring = 1 - Math.exp(-p * 4) * Math.cos(p * 15);
        part.position.x = 3 - spring * 3;
      }
    }
  },
  {
    id: 'particle-orbit',
    name: 'Particle Orbit',
    category: 'UI/FX',
    icon: '⚛️',
    color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    description: 'Multiple small parts orbiting around a center (atom-like).',
    bestFor: 'Atom models, magical effects, energy shields',
    looping: true,
    duration: 4,
    luaCode: `-- Particle Orbit Animation
-- Place this in a Model, script goes in the center part
local RunService = game:GetService("RunService")
local center = script.Parent

local particles = {}
local numParticles = 6
local radius = 5

for i = 1, numParticles do
    local p = Instance.new("Part")
    p.Shape = Enum.PartType.Ball
    p.Size = Vector3.new(1, 1, 1)
    p.Material = Enum.Material.Neon
    p.Color = Color3.fromHSV(i / numParticles, 1, 1)
    p.Anchored = true
    p.CanCollide = false
    p.Parent = center.Parent
    table.insert(particles, {part = p, offset = (i - 1) * (math.pi * 2 / numParticles), axis = i % 3})
end

local time = 0
RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    for _, data in ipairs(particles) do
        local angle = time * 2 + data.offset
        local x, y, z

        if data.axis == 0 then
            x = math.cos(angle) * radius
            y = math.sin(angle) * radius
            z = 0
        elseif data.axis == 1 then
            x = 0
            y = math.cos(angle) * radius
            z = math.sin(angle) * radius
        else
            x = math.cos(angle) * radius
            y = 0
            z = math.sin(angle) * radius
        end

        data.part.Position = center.Position + Vector3.new(x, y, z)
    end
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.y = t * speed;
      part.rotation.x = t * speed * 0.7;
    }
  },
  {
    id: 'floating-island',
    name: 'Floating Island',
    category: 'UI/FX',
    icon: '🏝️',
    color: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    description: 'Gentle floating motion with very subtle tilting, perfect for scenic pieces.',
    bestFor: 'Floating islands, hover platforms, skybox decorations',
    looping: true,
    duration: 6,
    luaCode: `-- Floating Island Animation
local RunService = game:GetService("RunService")
local part = script.Parent

local startPos = part.Position
local startCF = part.CFrame
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local floatY = math.sin(time * 0.5) * 1.5
    local tiltX = math.sin(time * 0.3) * math.rad(2)
    local tiltZ = math.cos(time * 0.4) * math.rad(3)
    local driftX = math.sin(time * 0.2) * 0.3

    part.CFrame = CFrame.new(
        startPos.X + driftX,
        startPos.Y + floatY,
        startPos.Z
    ) * CFrame.Angles(tiltX, 0, tiltZ)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.position.y = Math.sin(t * speed * 0.5) * 0.8 + 2;
      part.position.x = Math.sin(t * speed * 0.2) * 0.2;
      part.rotation.x = Math.sin(t * speed * 0.3) * 0.04;
      part.rotation.z = Math.cos(t * speed * 0.4) * 0.05;
    }
  },
  {
    id: 'portal-spin',
    name: 'Portal Effect',
    category: 'UI/FX',
    icon: '🌀',
    color: 'linear-gradient(135deg, #6a11cb, #2575fc)',
    description: 'Spinning ring effect with scale pulsing for a portal look.',
    bestFor: 'Portals, teleporters, dimensional rifts, magic circles',
    looping: true,
    duration: 3,
    luaCode: `-- Portal Effect Animation
local RunService = game:GetService("RunService")
local part = script.Parent

-- Make the part a thin cylinder for ring look
part.Shape = Enum.PartType.Cylinder
part.Material = Enum.Material.Neon
part.Color = Color3.fromRGB(100, 50, 255)

local startCF = part.CFrame
local time = 0

RunService.Heartbeat:Connect(function(dt)
    time = time + dt
    local spin = time * 3
    local pulse = 1 + math.sin(time * 2) * 0.15
    local hue = (time * 0.1) % 1

    part.CFrame = startCF * CFrame.Angles(0, spin, 0)
    part.Size = Vector3.new(0.5, 8 * pulse, 8 * pulse)
    part.Color = Color3.fromHSV(hue, 0.8, 1)
end)`,
    threeAnimator: (part, t, _dt, speed) => {
      part.rotation.y = t * speed * 3;
      const pulse = 1 + Math.sin(t * speed * 2) * 0.15;
      part.scale.set(pulse, pulse, 0.3);
      const hue = (t * speed * 0.1) % 1;
      const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh & { material: THREE.MeshStandardMaterial }).material.color = color;
          (child as THREE.Mesh & { material: THREE.MeshStandardMaterial }).material.emissive = color;
          (child as THREE.Mesh & { material: THREE.MeshStandardMaterial }).material.emissiveIntensity = 0.5;
        }
      });
    }
  },
];

// ─── Computed ───
const filteredAnimations = computed(() => {
  let list = allAnimations;
  if (selectedCategory.value) {
    list = list.filter(a => a.category === selectedCategory.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      a.bestFor.toLowerCase().includes(q)
    );
  }
  return list;
});

const currentAnim = computed(() => {
  return customPreviewAnimation.value || selectedAnimation.value || {
    name: '', category: '', looping: false, duration: 0, description: '', bestFor: ''
  };
});

const currentLuaCode = computed(() => {
  return (customPreviewAnimation.value?.luaCode || selectedAnimation.value?.luaCode || '-- Select an animation');
});

const applicationSteps = computed<ApplicationStep[]>(() => {
  const anim = customPreviewAnimation.value || selectedAnimation.value;
  if (!anim) return [];
  return [
    {
      title: 'Open Roblox Studio',
      description: 'Open your Roblox game project in Roblox Studio.'
    },
    {
      title: 'Select or Create the Part',
      description: 'In the Explorer panel, select the Part you want to animate, or insert a new Part via the Insert menu (Model tab → Part).'
    },
    {
      title: 'Anchor the Part',
      description: 'In the Properties panel, check the "Anchored" checkbox. This prevents the part from falling due to gravity and allows script-based positioning.',
      code: '-- In Properties panel:\n-- Anchored = true'
    },
    {
      title: 'Insert a Script',
      description: 'Right-click the Part in the Explorer → Insert Object → Script. This creates a new server Script inside the Part.'
    },
    {
      title: 'Paste the Animation Code',
      description: 'Delete the default print("Hello world!") code and paste the Lua animation code below:',
      code: anim.luaCode
    },
    {
      title: 'Test the Animation',
      description: 'Click the "Play" button (or press F5) in Roblox Studio to enter Play mode. You should see the animation running on your Part.'
    },
    {
      title: 'Customize (Optional)',
      description: 'Modify the speed, distance, colors, or other parameters in the script to match your game\'s needs. The key variables are clearly labeled with comments.'
    },
    {
      title: 'Stop & Save',
      description: 'Press the "Stop" button (or Shift+F5) to exit Play mode. Save your game (Ctrl+S). The animation will run every time the game starts.'
    }
  ];
});

// ─── Three.js Setup ───
function initThree() {
  if (!threeContainer.value) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  camera = new THREE.PerspectiveCamera(
    50,
    threeContainer.value.clientWidth / threeContainer.value.clientHeight,
    0.1,
    100
  );
  camera.position.set(5, 4, 6);
  camera.lookAt(0, 1, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  threeContainer.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0x6366f1, 0.5, 20);
  pointLight.position.set(-3, 5, -3);
  scene.add(pointLight);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x16213e,
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid
  gridHelper = new THREE.GridHelper(20, 20, 0x333366, 0x222244);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // Character / Part
  characterGroup = new THREE.Group();
  partGroup = new THREE.Group();
  scene.add(characterGroup);
  scene.add(partGroup);

  buildCharacter(characters[0]);

  clock = new THREE.Clock();

  const onResize = () => {
    if (!threeContainer.value) return;
    camera.aspect = threeContainer.value.clientWidth / threeContainer.value.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threeContainer.value.clientWidth, threeContainer.value.clientHeight);
  };
  window.addEventListener('resize', onResize);

  animate();
}

function buildCharacter(charDef: CharacterDef) {
  // Clear existing
  while (characterGroup.children.length > 0) {
    characterGroup.remove(characterGroup.children[0]);
  }

  const headMat = new THREE.MeshStandardMaterial({ color: charDef.headColor, roughness: 0.6 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: charDef.torsoColor, roughness: 0.5 });
  const limbMat = new THREE.MeshStandardMaterial({ color: charDef.limbColor, roughness: 0.6 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.7), torsoMat);
  torso.position.y = 2.2;
  torso.castShadow = true;
  characterGroup.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), headMat);
  head.position.y = 3.4;
  head.castShadow = true;
  characterGroup.add(head);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const eyeGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.2, 3.45, 0.45);
  characterGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.2, 3.45, 0.45);
  characterGroup.add(rightEye);

  // Smile
  const smileCurve = new THREE.EllipseCurve(0, 0, 0.2, 0.1, Math.PI, 0, false, 0);
  const smilePoints = smileCurve.getPoints(16);
  const smileGeo = new THREE.BufferGeometry().setFromPoints(smilePoints);
  const smileLine = new THREE.Line(smileGeo, new THREE.LineBasicMaterial({ color: 0x111111 }));
  smileLine.position.set(0, 3.2, 0.51);
  characterGroup.add(smileLine);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  const leftArm = new THREE.Mesh(armGeo, limbMat);
  leftArm.position.set(-1.05, 2.1, 0);
  leftArm.castShadow = true;
  characterGroup.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, limbMat);
  rightArm.position.set(1.05, 2.1, 0);
  rightArm.castShadow = true;
  characterGroup.add(rightArm);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  const leftLeg = new THREE.Mesh(legGeo, limbMat);
  leftLeg.position.set(-0.35, 0.8, 0);
  leftLeg.castShadow = true;
  characterGroup.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, limbMat);
  rightLeg.position.set(0.35, 0.8, 0);
  rightLeg.castShadow = true;
  characterGroup.add(rightLeg);

  // Special features per character
  if (charDef.id === 'bacon') {
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const hair = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), hairMat);
    hair.position.y = 4;
    characterGroup.add(hair);
  }
  if (charDef.id === 'robot') {
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const antenna = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), antennaMat);
    antenna.position.set(0, 4.1, 0);
    characterGroup.add(antenna);
    const antennaStick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    antennaStick.position.set(0, 3.95, 0);
    characterGroup.add(antennaStick);
  }
  if (charDef.id === 'knight') {
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.4, 1.15), helmetMat);
    helmet.position.y = 3.95;
    characterGroup.add(helmet);
  }
}

function updateCharacter() {
  const char = characters.find(c => c.id === selectedCharacter.value);
  if (char) buildCharacter(char);
}

function animate() {
  animationFrame = requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  controls.update();

  const anim = customPreviewAnimation.value || selectedAnimation.value;
  if (anim && isPlaying.value) {
    // Reset transforms before applying animation
    characterGroup.position.set(0, 0, 0);
    characterGroup.rotation.set(0, 0, 0);
    characterGroup.scale.set(1, 1, 1);

    anim.threeAnimator(characterGroup, elapsed, dt, animationSpeed.value);
  }

  renderer.render(scene, camera);
}

function selectAnimation(anim: RobloxAnimation) {
  selectedAnimation.value = anim;
  customPreviewAnimation.value = null;
  activeTab.value = 'info';
  isPlaying.value = true;
  resetTransforms();
}

function togglePlay() {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    clock.start();
  }
}

function resetAnimation() {
  clock = new THREE.Clock();
  isPlaying.value = true;
  resetTransforms();
}

function resetTransforms() {
  if (characterGroup) {
    characterGroup.position.set(0, 0, 0);
    characterGroup.rotation.set(0, 0, 0);
    characterGroup.scale.set(1, 1, 1);
    characterGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material && 'opacity' in mesh.material) {
          (mesh.material as THREE.MeshStandardMaterial).opacity = 1;
          (mesh.material as THREE.MeshStandardMaterial).transparent = false;
        }
      }
    });
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(currentLuaCode.value);
    copySuccess.value = true;
    showToast('Code copied to clipboard!', 'success');
    setTimeout(() => { copySuccess.value = false; }, 2000);
  } catch {
    showToast('Failed to copy code', 'error');
  }
}

function showToast(msg: string, type: string = 'success') {
  toastMessage.value = msg;
  toastType.value = type;
  setTimeout(() => { toastMessage.value = ''; }, 3000);
}

// ─── Custom Animation via AI ───
async function requestCustomAnimation() {
  if (!customDescription.value.trim()) return;
  customLoading.value = true;

  try {
    const result = await robloxAI.generateCustomAnimation({
      description: customDescription.value,
      partType: customPartType.value,
      looping: customLooping.value,
      duration: customDuration.value
    });

    if (result) {
      const customAnim: RobloxAnimation = {
        id: 'custom-' + Date.now(),
        name: result.name || 'Custom Animation',
        category: 'Complex',
        icon: '🤖',
        color: 'linear-gradient(135deg, #6366f1, #a855f7)',
        description: result.description || customDescription.value,
        bestFor: 'Custom user-requested animation',
        looping: customLooping.value,
        duration: customDuration.value,
        luaCode: result.luaCode,
        threeAnimator: createThreeAnimatorFromAI(result.animationParams)
      };

      customPreviewAnimation.value = customAnim;
      selectedAnimation.value = null;
      activeTab.value = 'code';
      isPlaying.value = true;
      resetAnimation();
      showCustomRequest.value = false;
      showToast('Custom animation generated!', 'success');
    }
  } catch (err: any) {
    showToast('Failed to generate animation: ' + (err.message || 'AI error'), 'error');
  } finally {
    customLoading.value = false;
  }
}

function createThreeAnimatorFromAI(params: any): (part: THREE.Group, t: number, dt: number, speed: number) => void {
  if (!params) {
    return (part, t, _dt, speed) => {
      part.position.y = Math.sin(t * speed) * 1.5 + 1;
      part.rotation.y = t * speed;
    };
  }

  return (part, t, _dt, speed) => {
    const p = params;
    const ts = t * speed;

    // Position
    if (p.posX) part.position.x = eval(p.posX.replace(/t/g, String(ts))) || 0;
    if (p.posY) part.position.y = eval(p.posY.replace(/t/g, String(ts))) || 0;
    if (p.posZ) part.position.z = eval(p.posZ.replace(/t/g, String(ts))) || 0;

    // Rotation
    if (p.rotX) part.rotation.x = eval(p.rotX.replace(/t/g, String(ts))) || 0;
    if (p.rotY) part.rotation.y = eval(p.rotY.replace(/t/g, String(ts))) || 0;
    if (p.rotZ) part.rotation.z = eval(p.rotZ.replace(/t/g, String(ts))) || 0;

    // Scale
    if (p.scaleX) {
      const s = eval(p.scaleX.replace(/t/g, String(ts))) || 1;
      part.scale.set(s, p.scaleY ? eval(p.scaleY.replace(/t/g, String(ts))) || s : s, p.scaleZ ? eval(p.scaleZ.replace(/t/g, String(ts))) || s : s);
    }

    // Color
    if (p.colorHue) {
      const hue = eval(p.colorHue.replace(/t/g, String(ts))) || 0;
      const color = new THREE.Color().setHSL(hue % 1, 1, 0.5);
      part.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh & { material: THREE.MeshStandardMaterial }).material.color = color;
        }
      });
    }
  };
}

// ─── Lifecycle ───
onMounted(async () => {
  await nextTick();
  initThree();
});

onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  if (renderer) {
    renderer.dispose();
    if (threeContainer.value && renderer.domElement.parentNode === threeContainer.value) {
      threeContainer.value.removeChild(renderer.domElement);
    }
  }
});
</script>

<style src="@/assets/css/roblox-tool.css"></style>