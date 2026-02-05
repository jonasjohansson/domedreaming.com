import * as THREE from "three";
import { updatePulseAudio, updateTickIntensity, getTickIntensity, getActivePulseIndex } from "./pulse-audio.js";

/**
 * WebGL Shader-based pulse animation
 * Animates pulses entirely on GPU - no texture updates needed
 */

const MAX_PULSES = 8;

// Pulse state
let pulseUniforms = null;
let animationId = null;
let pulses = [];

// Vertex shader - pass through UVs
const pulseVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader - overlay pulses on base texture
const pulseFragmentShader = `
uniform sampler2D uBaseTexture;
uniform vec3 uPulsePositions[${MAX_PULSES}];  // xy = position (0-1 UV), z = size
uniform float uTime;
uniform int uPulseCount;
uniform float uPulseIntensity;
uniform float uRotation;  // Texture rotation in radians
uniform float uTickIntensity;  // 0-1, for pulse pulsation on ticks
uniform int uActivePulse;  // Which pulse reacts to tick (-1 = none)

varying vec2 vUv;

// Rotate UV around center (0.5, 0.5)
vec2 rotateUV(vec2 uv, float angle) {
  vec2 center = vec2(0.5, 0.5);
  vec2 centered = uv - center;
  float s = sin(angle);
  float c = cos(angle);
  vec2 rotated = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c);
  return rotated + center;
}

void main() {
  // Flip UV to match texture configuration (flipY and repeat.y = -1)
  vec2 flippedUv = vec2(vUv.x, 1.0 - vUv.y);

  // Apply rotation
  vec2 rotatedUv = rotateUV(flippedUv, uRotation);

  // Sample base texture with rotated UVs
  vec4 baseColor = texture2D(uBaseTexture, rotatedUv);

  // Add pulse glow
  float pulseGlow = 0.0;

  for (int i = 0; i < ${MAX_PULSES}; i++) {
    if (i >= uPulseCount) break;

    vec2 pulsePos = uPulsePositions[i].xy;
    float pulseSize = uPulsePositions[i].z;

    // Apply pulsation to active pulse on ticks
    float pulsation = 1.0;
    if (i == uActivePulse) {
      pulsation = 1.0 + uTickIntensity * 2.0;  // Up to 3x size on tick
    }
    float adjustedSize = pulseSize * pulsation;

    // Distance from pulse center (use flipped UV to match texture)
    float dist = distance(flippedUv, pulsePos);

    // Soft glow falloff - larger on tick
    float glow = smoothstep(adjustedSize * 2.0, 0.0, dist);

    // Core intensity
    float core = smoothstep(adjustedSize * 0.5, 0.0, dist);

    // Boost intensity for active pulse
    float intensityBoost = (i == uActivePulse) ? (1.0 + uTickIntensity * 0.5) : 1.0;
    pulseGlow += (glow * 0.5 + core * 0.8) * intensityBoost;
  }

  // Blend pulse glow with base
  vec3 finalColor = baseColor.rgb + vec3(pulseGlow * uPulseIntensity);

  gl_FragColor = vec4(finalColor, baseColor.a);
}
`;

/**
 * Create uniforms for pulse shader
 */
export function createPulseUniforms(baseTexture) {
  // Initialize pulse positions array
  const positions = [];
  for (let i = 0; i < MAX_PULSES; i++) {
    positions.push(new THREE.Vector3(0, 0, 0));
  }

  pulseUniforms = {
    uBaseTexture: { value: baseTexture },
    uPulsePositions: { value: positions },
    uTime: { value: 0 },
    uPulseCount: { value: 0 },
    uPulseIntensity: { value: 1.0 },
    uRotation: { value: 0 },  // Texture rotation in radians
    uTickIntensity: { value: 0 },  // Tick pulsation intensity
    uActivePulse: { value: -1 }  // Which pulse is pulsating
  };

  return pulseUniforms;
}

/**
 * Update texture rotation for shader
 */
export function updateShaderRotation(rotation) {
  if (pulseUniforms && pulseUniforms.uRotation) {
    pulseUniforms.uRotation.value = rotation;
  }
}

/**
 * Create a ShaderMaterial with pulse animation
 */
export function createPulseShaderMaterial(baseTexture) {
  const uniforms = createPulseUniforms(baseTexture);

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: pulseVertexShader,
    fragmentShader: pulseFragmentShader,
    transparent: false,
  });

  return material;
}

/**
 * Initialize pulses with random positions
 */
export function initializePulses(count, numCircles) {
  pulses = [];
  const actualCount = Math.min(count, MAX_PULSES);

  for (let i = 0; i < actualCount; i++) {
    // Random circle (1 to numCircles)
    const circle = 1 + Math.floor(Math.random() * numCircles);
    // Random starting angle
    const angle = Math.random() * Math.PI * 2;
    // Random speed (some go clockwise, some counter-clockwise)
    const speed = (0.5 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1);
    // Random size multiplier
    const size = 0.8 + Math.random() * 0.4;

    pulses.push({
      circle,
      angle,
      speed,
      size,
      numCircles
    });
  }

  if (pulseUniforms) {
    pulseUniforms.uPulseCount.value = actualCount;
  }
}

/**
 * Update pulse positions and sync to uniforms
 */
function updatePulses(deltaTime, speed) {
  if (!pulseUniforms) return;

  for (let i = 0; i < pulses.length; i++) {
    const pulse = pulses[i];

    // Update angle
    pulse.angle += pulse.speed * speed * deltaTime * 0.001;

    // Keep angle in valid range
    if (pulse.angle > Math.PI * 2) pulse.angle -= Math.PI * 2;
    if (pulse.angle < 0) pulse.angle += Math.PI * 2;

    // Convert polar coordinates to UV coordinates (0-1 range)
    // The texture is centered, so we need to map to 0.5 center
    const radius = (pulse.circle / pulse.numCircles) * 0.45; // 0.45 to stay within circle
    const uvX = 0.5 + Math.cos(pulse.angle) * radius;
    const uvY = 0.5 + Math.sin(pulse.angle) * radius;

    // Pulse size in UV space
    const pulseSize = 0.015 * pulse.size;

    // Update uniform
    pulseUniforms.uPulsePositions.value[i].set(uvX, uvY, pulseSize);
  }
}

/**
 * Start pulse animation loop
 */
export function startPulseShaderAnimation(settings = {}) {
  const {
    pulseCount = 4,
    numCircles = 8,
    pulseSpeed = 0.5,
    pulseIntensity = 1.0
  } = settings;

  // Initialize pulses
  initializePulses(pulseCount, numCircles);

  if (pulseUniforms) {
    pulseUniforms.uPulseIntensity.value = pulseIntensity;
  }

  let lastTime = performance.now();

  function animate(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Update pulse positions
    updatePulses(deltaTime, pulseSpeed);

    // Update time uniform
    if (pulseUniforms) {
      pulseUniforms.uTime.value = currentTime * 0.001;
      // Update tick pulsation uniforms
      pulseUniforms.uTickIntensity.value = getTickIntensity();
      pulseUniforms.uActivePulse.value = getActivePulseIndex();
    }

    // Update audio (ticks and spatial positioning)
    updatePulseAudio(pulses, { circleStep: 1 / numCircles });
    updateTickIntensity();

    animationId = requestAnimationFrame(animate);
  }

  // Stop any existing animation
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  animationId = requestAnimationFrame(animate);
}

/**
 * Stop pulse animation
 */
export function stopPulseShaderAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Update base texture (when regenerating polar grid)
 */
export function updateBaseTexture(texture) {
  if (pulseUniforms) {
    pulseUniforms.uBaseTexture.value = texture;
  }
}

/**
 * Get pulse uniforms for external access
 */
export function getPulseUniforms() {
  return pulseUniforms;
}
