import * as THREE from "three";

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

varying vec2 vUv;

void main() {
  // Sample base texture
  vec4 baseColor = texture2D(uBaseTexture, vUv);

  // Add pulse glow
  float pulseGlow = 0.0;

  for (int i = 0; i < ${MAX_PULSES}; i++) {
    if (i >= uPulseCount) break;

    vec2 pulsePos = uPulsePositions[i].xy;
    float pulseSize = uPulsePositions[i].z;

    // Distance from pulse center
    float dist = distance(vUv, pulsePos);

    // Soft glow falloff
    float glow = smoothstep(pulseSize * 2.0, 0.0, dist);

    // Core intensity
    float core = smoothstep(pulseSize * 0.5, 0.0, dist);

    pulseGlow += glow * 0.5 + core * 0.8;
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
    uPulseIntensity: { value: 1.0 }
  };

  return pulseUniforms;
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
    }

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
