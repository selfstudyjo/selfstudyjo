<template>
  <div class="space-background">
    <!-- Milky Way Galaxy -->
    <div class="milky-way"></div>
    
    <!-- Walking Person -->
    <div class="walking-person">
      <div class="person-body"></div>
      <div class="person-leg left-leg"></div>
      <div class="person-leg right-leg"></div>
      <div class="person-arm left-arm"></div>
      <div class="person-arm right-arm"></div>
    </div>
    
    <!-- Stars -->
    <div class="stars"></div>
    <div class="stars stars-2"></div>
    <div class="stars stars-3"></div>
    
    <!-- Celestial Bodies -->
    <div class="sun"></div>
    <div class="moon"></div>
    
    <!-- Planets Container -->
    <div class="planets-container">
      <div 
        v-for="(planet, index) in planets" 
        :key="planet.id"
        :class="['planet', `planet-${index + 1}`]"
        :style="{
          '--planet-color': planet.color,
          '--planet-size': planet.size,
          '--orbit-radius': planet.orbitRadius,
          '--animation-duration': planet.duration,
          '--rotation-speed': planet.rotationSpeed,
          '--glow-color': planet.glow
        }"
      >
        <div class="planet-core"></div>
        <div class="planet-ring" v-if="planet.hasRing"></div>
        <div class="planet-label">{{ planet.name }}</div>
        <div class="planet-glow"></div>
      </div>
    </div>
    
    <!-- Comets -->
    <div class="comet comet-1"></div>
    <div class="comet comet-2"></div>
    <div class="comet comet-3"></div>
    
    <!-- Nebula Effects -->
    <div class="nebula nebula-1"></div>
    <div class="nebula nebula-2"></div>
    <div class="nebula nebula-3"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface Planet {
  id: number;
  name: string;
  color: string;
  size: string;
  orbitRadius: string;
  duration: string;
  rotationSpeed: string;
  glow: string;
  hasRing: boolean;
}

const planets = ref<Planet[]>([
  // Tech Planets
  { id: 1, name: 'Python', color: '#3776AB', size: '60px', orbitRadius: '200px', duration: '40s', rotationSpeed: '20s', glow: 'rgba(55, 118, 171, 0.5)', hasRing: false },
  { id: 2, name: 'Java', color: '#007396', size: '65px', orbitRadius: '280px', duration: '45s', rotationSpeed: '25s', glow: 'rgba(0, 115, 150, 0.5)', hasRing: true },
  { id: 3, name: 'CSS', color: '#1572B6', size: '50px', orbitRadius: '350px', duration: '50s', rotationSpeed: '15s', glow: 'rgba(21, 114, 182, 0.5)', hasRing: false },
  { id: 4, name: 'JavaScript', color: '#F7DF1E', size: '70px', orbitRadius: '420px', duration: '35s', rotationSpeed: '18s', glow: 'rgba(247, 223, 30, 0.5)', hasRing: true },
  
  // Framework Planets
  { id: 5, name: 'Django', color: '#092E20', size: '55px', orbitRadius: '500px', duration: '55s', rotationSpeed: '22s', glow: 'rgba(9, 46, 32, 0.5)', hasRing: false },
  { id: 6, name: 'Flask', color: '#000000', size: '45px', orbitRadius: '580px', duration: '60s', rotationSpeed: '30s', glow: 'rgba(0, 0, 0, 0.5)', hasRing: true },
  { id: 7, name: 'IONIC', color: '#3880FF', size: '60px', orbitRadius: '650px', duration: '38s', rotationSpeed: '20s', glow: 'rgba(56, 128, 255, 0.5)', hasRing: false },
  
  // Cloud Planets
  { id: 8, name: 'AWS', color: '#FF9900', size: '75px', orbitRadius: '750px', duration: '65s', rotationSpeed: '35s', glow: 'rgba(255, 153, 0, 0.5)', hasRing: true },
  { id: 9, name: 'Azure', color: '#0089D6', size: '70px', orbitRadius: '850px', duration: '70s', rotationSpeed: '28s', glow: 'rgba(0, 137, 214, 0.5)', hasRing: false },
  { id: 10, name: 'Google Cloud', color: '#4285F4', size: '65px', orbitRadius: '950px', duration: '75s', rotationSpeed: '32s', glow: 'rgba(66, 133, 244, 0.5)', hasRing: true },
  
  // DevOps Planets
  { id: 11, name: 'Docker', color: '#2496ED', size: '55px', orbitRadius: '1050px', duration: '42s', rotationSpeed: '24s', glow: 'rgba(36, 150, 237, 0.5)', hasRing: false },
  { id: 12, name: 'Kubernetes', color: '#326CE5', size: '80px', orbitRadius: '1150px', duration: '80s', rotationSpeed: '40s', glow: 'rgba(50, 108, 229, 0.5)', hasRing: true },
  
  // Other Planets
  { id: 13, name: 'Computer Science', color: '#8A2BE2', size: '85px', orbitRadius: '1250px', duration: '85s', rotationSpeed: '45s', glow: 'rgba(138, 43, 226, 0.5)', hasRing: false },
  { id: 14, name: 'Math', color: '#FF6B6B', size: '50px', orbitRadius: '1350px', duration: '48s', rotationSpeed: '26s', glow: 'rgba(255, 107, 107, 0.5)', hasRing: true },
  { id: 15, name: 'Self Study', color: '#4ECDC4', size: '60px', orbitRadius: '1450px', duration: '52s', rotationSpeed: '29s', glow: 'rgba(78, 205, 196, 0.5)', hasRing: false },
  { id: 16, name: 'Web Scraping', color: '#45B7D1', size: '45px', orbitRadius: '1550px', duration: '58s', rotationSpeed: '33s', glow: 'rgba(69, 183, 209, 0.5)', hasRing: true },
  { id: 17, name: 'Virtualization', color: '#96CEB4', size: '55px', orbitRadius: '1650px', duration: '62s', rotationSpeed: '31s', glow: 'rgba(150, 206, 180, 0.5)', hasRing: false },
  { id: 18, name: 'HTML', color: '#E34F26', size: '65px', orbitRadius: '1750px', duration: '44s', rotationSpeed: '19s', glow: 'rgba(227, 79, 38, 0.5)', hasRing: true },
]);

// Infinite loop animation control
let animationFrameId: number;

const updateAnimations = () => {
  // This function can be used to dynamically update animations if needed
  animationFrameId = requestAnimationFrame(updateAnimations);
};

onMounted(() => {
  updateAnimations();
});

onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<style scoped>
.space-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  perspective: 1000px;
  overflow: hidden;
  background: linear-gradient(to bottom, 
    #000428 0%, 
    #000b2e 15%, 
    #00113a 30%, 
    #001848 50%, 
    #000f35 70%, 
    #000428 100%);
}

/* Milky Way Galaxy */
.milky-way {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2000px;
  height: 800px;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(173, 216, 230, 0.05) 30%,
    rgba(138, 43, 226, 0.02) 60%,
    transparent 70%
  );
  transform: translate(-50%, -50%) rotateX(60deg);
  animation: rotateGalaxy 400s linear infinite;
}

@keyframes rotateGalaxy {
  0% { transform: translate(-50%, -50%) rotateX(60deg) rotateZ(0deg); }
  100% { transform: translate(-50%, -50%) rotateX(60deg) rotateZ(360deg); }
}

/* Walking Person */
.walking-person {
  position: absolute;
  bottom: 20%;
  left: 10%;
  width: 40px;
  height: 100px;
  transform-style: preserve-3d;
  animation: walkForward 30s linear infinite;
  z-index: 10;
}

.person-body {
  position: absolute;
  width: 20px;
  height: 50px;
  background: linear-gradient(to bottom, #4a90e2, #357abd);
  border-radius: 10px 10px 0 0;
  transform: translateZ(20px);
}

.person-leg, .person-arm {
  position: absolute;
  background: #357abd;
  border-radius: 5px;
}

.left-leg {
  width: 8px;
  height: 40px;
  bottom: 0;
  left: 6px;
  transform-origin: top center;
  animation: walkLeg 0.8s ease-in-out infinite;
}

.right-leg {
  width: 8px;
  height: 40px;
  bottom: 0;
  right: 6px;
  transform-origin: top center;
  animation: walkLeg 0.8s ease-in-out infinite 0.4s;
}

.left-arm {
  width: 8px;
  height: 35px;
  top: 5px;
  left: -5px;
  transform-origin: bottom center;
  animation: walkArm 0.8s ease-in-out infinite 0.2s;
}

.right-arm {
  width: 8px;
  height: 35px;
  top: 5px;
  right: -5px;
  transform-origin: bottom center;
  animation: walkArm 0.8s ease-in-out infinite 0.6s;
}

@keyframes walkForward {
  0% {
    transform: translateX(-100px) translateZ(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateX(calc(100vw + 100px)) translateZ(200px) scale(0.5);
    opacity: 0;
  }
}

@keyframes walkLeg {
  0%, 100% { transform: rotateX(0deg); }
  50% { transform: rotateX(45deg); }
}

@keyframes walkArm {
  0%, 100% { transform: rotateX(0deg); }
  50% { transform: rotateX(-30deg); }
}

/* Stars */
.stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    radial-gradient(2px 2px at 20px 30px, #eee, transparent),
    radial-gradient(2px 2px at 40px 70px, #fff, transparent),
    radial-gradient(1px 1px at 90px 40px, #ddd, transparent),
    radial-gradient(1px 1px at 130px 80px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 160px 120px, #eee, transparent);
  background-repeat: repeat;
  background-size: 200px 200px;
  animation: twinkle 3s ease-in-out infinite;
}

.stars-2 {
  animation-delay: 1s;
  background-size: 300px 300px;
  opacity: 0.7;
}

.stars-3 {
  animation-delay: 2s;
  background-size: 400px 400px;
  opacity: 0.5;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* Sun and Moon */
.sun, .moon {
  position: absolute;
  border-radius: 50%;
}

.sun {
  width: 100px;
  height: 100px;
  top: 10%;
  right: 15%;
  background: radial-gradient(circle at 30% 30%, #ffd700, #ff8c00, #ff4500);
  box-shadow: 0 0 60px 30px rgba(255, 215, 0, 0.5),
              0 0 100px 60px rgba(255, 140, 0, 0.3),
              0 0 140px 90px rgba(255, 69, 0, 0.1);
  animation: sunPulse 8s ease-in-out infinite;
}

.moon {
  width: 80px;
  height: 80px;
  top: 20%;
  left: 10%;
  background: radial-gradient(circle at 70% 30%, #f0f0f0, #c0c0c0, #a0a0a0);
  box-shadow: 0 0 40px 20px rgba(240, 240, 240, 0.3);
  animation: moonOrbit 120s linear infinite;
}

@keyframes sunPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes moonOrbit {
  0% { transform: rotate(0deg) translateX(150px) rotate(0deg); }
  100% { transform: rotate(360deg) translateX(150px) rotate(-360deg); }
}

/* Planets Container */
.planets-container {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.planet {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-style: preserve-3d;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.planet-core {
  width: var(--planet-size);
  height: var(--planet-size);
  background: var(--planet-color);
  border-radius: 50%;
  position: relative;
  transform-style: preserve-3d;
  animation: rotatePlanet var(--rotation-speed) linear infinite;
  box-shadow: 
    inset -10px -10px 20px rgba(0, 0, 0, 0.5),
    inset 10px 10px 20px rgba(255, 255, 255, 0.2),
    0 0 40px var(--glow-color);
}

.planet-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--planet-size) * 1.8);
  height: calc(var(--planet-size) * 0.3);
  background: transparent;
  border: 10px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%) rotateX(75deg);
  animation: rotateRing calc(var(--rotation-speed) * 0.8) linear infinite reverse;
}

.planet-label {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-size: 12px;
  font-weight: bold;
  text-shadow: 0 0 10px currentColor;
  opacity: 0;
  transition: opacity 0.3s;
  white-space: nowrap;
}

.planet:hover .planet-label {
  opacity: 1;
}

.planet-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--planet-size) * 2);
  height: calc(var(--planet-size) * 2);
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.5;
  animation: pulseGlow 4s ease-in-out infinite;
}

/* Planet Orbit Animations */
.planet-1 { animation-name: orbit1; animation-duration: var(--animation-duration); }
.planet-2 { animation-name: orbit2; animation-duration: var(--animation-duration); }
.planet-3 { animation-name: orbit3; animation-duration: var(--animation-duration); }
.planet-4 { animation-name: orbit4; animation-duration: var(--animation-duration); }
.planet-5 { animation-name: orbit5; animation-duration: var(--animation-duration); }
.planet-6 { animation-name: orbit6; animation-duration: var(--animation-duration); }
.planet-7 { animation-name: orbit7; animation-duration: var(--animation-duration); }
.planet-8 { animation-name: orbit8; animation-duration: var(--animation-duration); }
.planet-9 { animation-name: orbit9; animation-duration: var(--animation-duration); }
.planet-10 { animation-name: orbit10; animation-duration: var(--animation-duration); }
.planet-11 { animation-name: orbit11; animation-duration: var(--animation-duration); }
.planet-12 { animation-name: orbit12; animation-duration: var(--animation-duration); }
.planet-13 { animation-name: orbit13; animation-duration: var(--animation-duration); }
.planet-14 { animation-name: orbit14; animation-duration: var(--animation-duration); }
.planet-15 { animation-name: orbit15; animation-duration: var(--animation-duration); }
.planet-16 { animation-name: orbit16; animation-duration: var(--animation-duration); }
.planet-17 { animation-name: orbit17; animation-duration: var(--animation-duration); }
.planet-18 { animation-name: orbit18; animation-duration: var(--animation-duration); }

/* Orbit paths - each at different angles and planes */
@keyframes orbit1 {
  0% { transform: rotateY(0deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(360deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit2 {
  0% { transform: rotateY(20deg) rotateX(15deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(380deg) rotateX(15deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit3 {
  0% { transform: rotateY(40deg) rotateX(-10deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(400deg) rotateX(-10deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit4 {
  0% { transform: rotateY(60deg) rotateX(20deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(420deg) rotateX(20deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit5 {
  0% { transform: rotateY(80deg) rotateX(-15deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(440deg) rotateX(-15deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit6 {
  0% { transform: rotateY(100deg) rotateX(10deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(460deg) rotateX(10deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit7 {
  0% { transform: rotateY(120deg) rotateX(-20deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(480deg) rotateX(-20deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit8 {
  0% { transform: rotateY(140deg) rotateX(25deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(500deg) rotateX(25deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit9 {
  0% { transform: rotateY(160deg) rotateX(-25deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(520deg) rotateX(-25deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit10 {
  0% { transform: rotateY(180deg) rotateX(30deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(540deg) rotateX(30deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit11 {
  0% { transform: rotateY(200deg) rotateX(-30deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(560deg) rotateX(-30deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit12 {
  0% { transform: rotateY(220deg) rotateX(35deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(580deg) rotateX(35deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit13 {
  0% { transform: rotateY(240deg) rotateX(-35deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(600deg) rotateX(-35deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit14 {
  0% { transform: rotateY(260deg) rotateX(40deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(620deg) rotateX(40deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit15 {
  0% { transform: rotateY(280deg) rotateX(-40deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(640deg) rotateX(-40deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit16 {
  0% { transform: rotateY(300deg) rotateX(45deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(660deg) rotateX(45deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit17 {
  0% { transform: rotateY(320deg) rotateX(-45deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(680deg) rotateX(-45deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes orbit18 {
  0% { transform: rotateY(340deg) rotateX(50deg) translateX(var(--orbit-radius)) rotateY(0deg); }
  100% { transform: rotateY(700deg) rotateX(50deg) translateX(var(--orbit-radius)) rotateY(-360deg); }
}

@keyframes rotatePlanet {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}

@keyframes rotateRing {
  0% { transform: translate(-50%, -50%) rotateX(75deg) rotateZ(0deg); }
  100% { transform: translate(-50%, -50%) rotateX(75deg) rotateZ(360deg); }
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
}

/* Comets */
.comet {
  position: absolute;
  width: 4px;
  height: 4px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8);
}

.comet::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100px;
  height: 2px;
  background: linear-gradient(to right, transparent, white);
  transform-origin: left center;
}

.comet-1 {
  top: 20%;
  left: 100%;
  animation: cometFly 15s linear infinite;
}

.comet-2 {
  top: 40%;
  left: 100%;
  animation: cometFly 20s linear infinite 5s;
}

.comet-3 {
  top: 60%;
  left: 100%;
  animation: cometFly 25s linear infinite 10s;
}

@keyframes cometFly {
  0% {
    transform: translateX(0) translateY(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateX(-200vw) translateY(200px);
    opacity: 0;
  }
}

/* Nebula Effects */
.nebula {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  opacity: 0.1;
  mix-blend-mode: screen;
}

.nebula-1 {
  width: 400px;
  height: 400px;
  top: 20%;
  left: 10%;
  background: radial-gradient(circle, #ff00ff, #00ffff);
  animation: floatNebula 25s ease-in-out infinite;
}

.nebula-2 {
  width: 300px;
  height: 300px;
  top: 60%;
  right: 15%;
  background: radial-gradient(circle, #00ff00, #0000ff);
  animation: floatNebula 30s ease-in-out infinite reverse;
}

.nebula-3 {
  width: 500px;
  height: 500px;
  bottom: 10%;
  left: 30%;
  background: radial-gradient(circle, #ffff00, #ff0000);
  animation: floatNebula 35s ease-in-out infinite 10s;
}

@keyframes floatNebula {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(100px, -50px) scale(1.1); }
  66% { transform: translate(-50px, 100px) scale(0.9); }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .planet-core {
    width: calc(var(--planet-size) * 0.7);
    height: calc(var(--planet-size) * 0.7);
  }
  
  .planet-label {
    font-size: 8px;
  }
  
  .walking-person {
    transform: scale(0.7);
  }
}
</style>