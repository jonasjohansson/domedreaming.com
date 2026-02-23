/**
 * Chair Spirits — cinematic trailer sequence
 *
 * Spirit lights spawn at entry points and follow the navmesh path (stairs,
 * aisles) to reach their assigned chairs — like ghosts finding their seats.
 * Room lights dim cinematically, a film plays, then everything reverses.
 */

import * as THREE from "three";
import { scene } from "./scene.js";
import { safeTraverse } from "./utils.js";
import {
  lightingSettings,
  setAmbientIntensity,
  setDirectIntensity,
} from "./lighting.js";
import { glbLights, fbxMeshes, chairMarkerPositions, spawnPointLeft, spawnPointRight, modelReady } from "./model.js";
import { renderer } from "./scene.js";
import { getNavMeshQuery } from "./navmesh.js";
import { getMaterial } from "./utils.js";
import { initAudio, setMasterVolume, stopAudio as stopPulseAudio } from "./pulse-audio.js";
import { textureRotationSettings } from "../core/settings.js";
import {
  scrambleToNewText,
  setTextContent,
  setTextRotationEnabled,
  setTextRotationBPM,
  setTextScrambleEnabled,
  setImageCellsEnabled,
  polarGridSettings,
} from "./polar-grid-texture.js";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** World-space positions extracted from GLB chair markers */
let chairPositions = [];
/** Two entry points spirits spawn from */
let spawnLeft = new THREE.Vector3();
let spawnRight = new THREE.Vector3();
/** Container group added to the scene */
let spiritsGroup = null;
/** All active spirit objects */
let spirits = [];
/** Spawn sequencing state */
let spawnQueue = [];
let spawnTimer = 0;
let spawnIndex = 0;
let spawning = false;
/** Reverse (fade-out) state */
let reversing = false;
let reverseTimer = 0;
let reverseIndex = 0;
/** PointLight budget */
let pointLightCount = 0;
const MAX_POINT_LIGHTS = 20;

/** Saved light intensities for restore */
let savedAmbient = null;
let savedDirect = null;
let savedGlbIntensities = [];
let savedScreenEmissive = null;
let savedExposure = null;
let savedFloorColor = null;
/** Whether lights are currently dimmed / restoring */
let dimming = false;
let restoring = false;
let dimProgress = 0;
let dimDuration = 3;
let restoreProgress = 0;
let restoreDuration = 3;

/** Height spirits float above the navmesh ground */
const SPIRIT_FLOAT_HEIGHT = 0.8;
/** Speed spirits travel along the path (units/sec) */
const SPIRIT_SPEED = 0.99;
/** Speed variance so they don't all move in lockstep */
const SPIRIT_SPEED_JITTER = 0.2;
/** Time (seconds) for spirit light to ramp from zero to full intensity */
const RAMP_DURATION = 2.5;

/** Default trailer video (used by dimAndPlayFilm legacy path) */
const DEFAULT_TRAILER_VIDEO = "assets/video/ParallelPromoLQ.mp4";

/** Saved rotation / text state for restore after trailer */
let savedGridRotationSpeed = null;
let savedTextRotationEnabled = null;
let savedTextRotationBPM = null;
let savedTextScrambleEnabled = null;
let savedTextContents = null;
let savedImageCellsEnabled = null;

// ---------------------------------------------------------------------------
// Cinematic fanfare — bombastic intro sound (20th Century Fox style)
// Built entirely with Tone.js: sub-bass, brass chords, timpani, crescendo
// ---------------------------------------------------------------------------

let fanfareAudio = null; // HTMLAudioElement for fanfare
let fanfareNodes = []; // Tone nodes for any effects

async function ensureTone() {
  let T = window.Tone;
  if (!T) {
    await initAudio();
    T = window.Tone;
  }
  if (!T) return null;
  if (T.context.state !== "running") await T.start();
  return T;
}

/** Raw Web Audio nodes for cleanup */
let fanfareRawNodes = [];

function disposeFanfare() {
  if (fanfareAudio) {
    fanfareAudio.pause();
    fanfareAudio.src = "";
    fanfareAudio = null;
  }
  fanfareGain = null;
  // Disconnect raw Web Audio nodes
  fanfareRawNodes.forEach((n) => {
    try { n.disconnect(); } catch (_) {}
  });
  fanfareRawNodes = [];
  // Dispose Tone.js nodes
  fanfareNodes.forEach((n) => {
    try { n.dispose(); } catch (_) {}
  });
  fanfareNodes = [];
}

/** Raw Web Audio gain node for fanfare volume control */
let fanfareGain = null;

/**
 * Play the 20th Century Fox fanfare MP3.
 * Routes through raw Web Audio API for reverb + modulation (avoids Tone.js MediaElement issues).
 * Adds a sub-bass synth layer via Tone.js for extra weight.
 * Audio is modulated (slight pitch shift, EQ coloring) so it's not identical to the original.
 */
async function playCinematicFanfare(duration) {
  try {
    disposeFanfare();

    const audio = new Audio("assets/audio/fanfare.mp3");
    audio.crossOrigin = "anonymous";
    // Slight pitch shift — 2 semitones down for a deeper, more cinematic feel
    audio.playbackRate = Math.pow(2, -2 / 12); // ~0.891
    fanfareAudio = audio;

    const T = await ensureTone();
    if (T) {
      const rawCtx = T.context.rawContext || T.context._context || T.context;

      const mediaSource = rawCtx.createMediaElementSource(audio);

      // Gain node for volume control
      const gain = rawCtx.createGain();
      gain.gain.value = 1.0;
      fanfareGain = gain;

      // EQ coloring: boost low-mids, cut highs for a warmer, more "cinematic" tone
      const lowBoost = rawCtx.createBiquadFilter();
      lowBoost.type = "lowshelf";
      lowBoost.frequency.value = 300;
      lowBoost.gain.value = 4; // +4dB low boost

      const highCut = rawCtx.createBiquadFilter();
      highCut.type = "highshelf";
      highCut.frequency.value = 6000;
      highCut.gain.value = -3; // -3dB high cut

      // Simple convolver reverb via Web Audio
      const convolver = rawCtx.createConvolver();
      const irLength = rawCtx.sampleRate * 2.5;
      const irBuffer = rawCtx.createBuffer(2, irLength, rawCtx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = irBuffer.getChannelData(ch);
        for (let i = 0; i < irLength; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 2.5);
        }
      }
      convolver.buffer = irBuffer;

      // Wet/dry mix: 70% dry, 30% reverb (more reverb for bigger hall feel)
      const dryGain = rawCtx.createGain();
      dryGain.gain.value = 0.7;
      const wetGain = rawCtx.createGain();
      wetGain.gain.value = 0.3;

      // Chain: mediaSource → gain → EQ → dry/wet split → destination
      mediaSource.connect(gain);
      gain.connect(lowBoost);
      lowBoost.connect(highCut);
      highCut.connect(dryGain);
      highCut.connect(convolver);
      convolver.connect(wetGain);
      dryGain.connect(rawCtx.destination);
      wetGain.connect(rawCtx.destination);

      // Track raw nodes for cleanup on replay
      fanfareRawNodes = [mediaSource, gain, lowBoost, highCut, convolver, dryGain, wetGain];

      // Sub-bass synth layer via Tone.js (separate chain, works fine)
      try {
        const subFilter = new T.Filter({ frequency: 100, type: "lowpass", rolloff: -24 }).toDestination();
        fanfareNodes.push(subFilter);
        const sub = new T.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 2, decay: 1, sustain: 0.6, release: 3 },
          volume: -14,
        }).connect(subFilter);
        fanfareNodes.push(sub);

        audio.addEventListener("playing", () => {
          try { sub.triggerAttack("Ab0"); } catch (_) {} // Shifted down to match pitch
        }, { once: true });

        audio.addEventListener("ended", () => {
          try { sub.triggerRelease(); } catch (_) {}
          setTimeout(() => disposeFanfare(), 3000);
        }, { once: true });
      } catch (_) {
        audio.addEventListener("ended", () => {
          setTimeout(() => disposeFanfare(), 1000);
        }, { once: true });
      }
    } else {
      audio.volume = 1.0;
      audio.addEventListener("ended", () => {
        setTimeout(() => disposeFanfare(), 1000);
      }, { once: true });
    }

    await audio.play();
    console.log("Chair spirits: playing modulated fanfare MP3");
  } catch (e) {
    console.warn("Chair spirits: fanfare playback failed", e);
  }
}

// ---------------------------------------------------------------------------
// Initialize chair markers from the main model (wisdome002.glb)
// Positions are extracted by model.js during load — no separate GLB needed
// ---------------------------------------------------------------------------

export async function loadChairMarkers() {
  // Wait for model.js to finish loading wisdome002.glb
  await modelReady;

  const positions = [...chairMarkerPositions];

  // Shuffle for visual variety
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  chairPositions = positions;

  if (spawnPointLeft) spawnLeft.copy(spawnPointLeft);
  else spawnLeft.set(-5, 2, 0);

  if (spawnPointRight) spawnRight.copy(spawnPointRight);
  else spawnRight.set(5, 2, 0);

  // Create container group
  spiritsGroup = new THREE.Group();
  spiritsGroup.name = "ChairSpirits";
  scene.add(spiritsGroup);

  console.log(
    `Chair spirits: initialized ${positions.length} markers from main model, spawn L/R set`
  );
  return Promise.resolve(positions.length);
}

// ---------------------------------------------------------------------------
// Navmesh path computation
// ---------------------------------------------------------------------------

function computeSpiritPath(startPos, targetPos) {
  const navMeshQuery = getNavMeshQuery();

  if (navMeshQuery) {
    try {
      const result = navMeshQuery.computePath(
        { x: startPos.x, y: startPos.y, z: startPos.z },
        { x: targetPos.x, y: targetPos.y, z: targetPos.z }
      );
      if (result.success && result.path && result.path.length >= 2) {
        return result.path.map((p) => new THREE.Vector3(p.x, p.y, p.z));
      }
    } catch (e) {
      // Fall through to fallback
    }
  }

  return [startPos.clone(), targetPos.clone()];
}

function pathLength(waypoints) {
  let len = 0;
  for (let i = 1; i < waypoints.length; i++) {
    len += waypoints[i].distanceTo(waypoints[i - 1]);
  }
  return len;
}

// ---------------------------------------------------------------------------
// Spirit entity
// ---------------------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createSpirit(targetPos, spawnPos) {
  const hue = 0.12 + (Math.random() - 0.5) * 0.06;
  const color = new THREE.Color().setHSL(hue, 0.9, 0.75);

  const geo = new THREE.SphereGeometry(0.04, 8, 6);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(spawnPos);

  let light = null;
  if (pointLightCount < MAX_POINT_LIGHTS) {
    light = new THREE.PointLight(color, 0.8, 8);
    mesh.add(light);
    pointLightCount++;
  }

  spiritsGroup.add(mesh);

  const waypoints = computeSpiritPath(spawnPos, targetPos);
  const totalDist = pathLength(waypoints);
  const speed = SPIRIT_SPEED + (Math.random() - 0.5) * SPIRIT_SPEED_JITTER;

  const cumulativeDist = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cumulativeDist.push(
      cumulativeDist[i - 1] + waypoints[i].distanceTo(waypoints[i - 1])
    );
  }

  // Start dim — intensity ramps up over RAMP_DURATION seconds
  mat.opacity = 0.05;
  if (light) light.intensity = 0;

  return {
    mesh,
    material: mat,
    light,
    targetPos: targetPos.clone(),
    waypoints,
    cumulativeDist,
    totalDist,
    speed,
    distanceTravelled: 0,
    settled: false,
    fadingOut: false,
    fadeProgress: 0,
    removed: false,
    /** Intensity ramp-up timer (0 → 1 over RAMP_DURATION) */
    rampProgress: 0,
    swayPhaseX: Math.random() * Math.PI * 2,
    swayPhaseZ: Math.random() * Math.PI * 2,
    swayFreqX: 2 + Math.random() * 2,
    swayFreqZ: 2 + Math.random() * 2,
    swayAmpX: 0.08 + Math.random() * 0.08,
    swayAmpZ: 0.08 + Math.random() * 0.08,
  };
}

// ---------------------------------------------------------------------------
// Animation — follow waypoints along navmesh path
// ---------------------------------------------------------------------------

function positionOnPath(spirit) {
  const { waypoints, cumulativeDist, totalDist, distanceTravelled } = spirit;
  const d = Math.min(distanceTravelled, totalDist);

  let segIdx = 0;
  for (let i = 1; i < cumulativeDist.length; i++) {
    if (cumulativeDist[i] >= d) {
      segIdx = i - 1;
      break;
    }
    segIdx = i - 1;
  }

  const segStart = cumulativeDist[segIdx];
  const segEnd = cumulativeDist[segIdx + 1] || totalDist;
  const segLen = segEnd - segStart;
  const localT = segLen > 0 ? (d - segStart) / segLen : 1;

  const a = waypoints[segIdx];
  const b = waypoints[segIdx + 1] || waypoints[waypoints.length - 1];
  return new THREE.Vector3().lerpVectors(a, b, localT);
}

function updateSpiritJourney(spirit, dt) {
  if (spirit.removed) return;

  // Ramp up intensity from zero (avoids hard pop-in of light)
  if (spirit.rampProgress < 1) {
    spirit.rampProgress = Math.min(spirit.rampProgress + dt / RAMP_DURATION, 1);
    const ramp = spirit.rampProgress * spirit.rampProgress; // ease-in quadratic
    spirit.material.opacity = ramp * 0.9;
    if (spirit.light) spirit.light.intensity = ramp * 0.8;
  }

  // Fade-out mode
  if (spirit.fadingOut) {
    spirit.fadeProgress += dt / 1.5;
    const fade = 1 - Math.min(spirit.fadeProgress, 1);
    spirit.material.opacity = fade * 0.85;
    if (spirit.light) spirit.light.intensity = fade * 0.6;
    if (spirit.fadeProgress >= 1) {
      spirit.removed = true;
      spiritsGroup.remove(spirit.mesh);
      spirit.mesh.geometry.dispose();
      spirit.material.dispose();
      if (spirit.light) pointLightCount--;
    }
    return;
  }

  const time = performance.now() / 1000;

  // Settled — subtle idle breathing at exact chair marker center
  if (spirit.settled) {
    const t = spirit.targetPos;
    const bob = Math.sin(time * 1.2 + spirit.swayPhaseX) * 0.008;
    const driftX = Math.sin(time * 0.5 + spirit.swayPhaseX) * 0.005;
    const driftZ = Math.cos(time * 0.4 + spirit.swayPhaseZ) * 0.005;
    spirit.mesh.position.set(t.x + driftX, t.y + bob, t.z + driftZ);
    return;
  }

  // Journey along path
  spirit.distanceTravelled += spirit.speed * dt;
  const progress = Math.min(spirit.distanceTravelled / spirit.totalDist, 1);

  const pathPos = positionOnPath(spirit);

  // In the final 40%, blend off navmesh toward exact chair marker
  const DETACH_START = 0.6;
  let base;
  if (progress > DETACH_START) {
    const blend = (progress - DETACH_START) / (1 - DETACH_START);
    const eased = blend * blend * (3 - 2 * blend); // smoothstep
    base = new THREE.Vector3().lerpVectors(pathPos, spirit.targetPos, eased);
  } else {
    base = pathPos;
  }

  const overlay = 1 - progress;

  const swayX =
    Math.sin(time * spirit.swayFreqX + spirit.swayPhaseX) *
    spirit.swayAmpX *
    overlay;
  const swayZ =
    Math.sin(time * spirit.swayFreqZ + spirit.swayPhaseZ) *
    spirit.swayAmpZ *
    overlay;

  const bob = Math.sin(time * 3 + spirit.swayPhaseX) * 0.02;
  const floatHeight = SPIRIT_FLOAT_HEIGHT * overlay;

  spirit.mesh.position.set(
    base.x + swayX,
    base.y + floatHeight + bob,
    base.z + swayZ
  );

  if (progress >= 1) {
    spirit.settled = true;
    spirit.mesh.position.copy(spirit.targetPos);
    spirit.mesh.scale.setScalar(1);
    spirit.material.opacity = 0.85;
    if (spirit.light) spirit.light.intensity = 0.6;
  }
}

// ---------------------------------------------------------------------------
// Public API — spawn / reverse / update
// ---------------------------------------------------------------------------

export function startSpiritsSequence() {
  if (chairPositions.length === 0) {
    console.warn("Chair spirits: no markers loaded yet");
    return;
  }

  spirits.forEach((s) => {
    if (!s.removed) {
      spiritsGroup.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.material.dispose();
    }
  });
  spirits = [];
  pointLightCount = 0;
  spawnIndex = 0;
  spawnTimer = 0;
  spawning = true;
  reversing = false;

  spawnQueue = chairPositions.map((pos, i) => ({
    targetPos: pos,
    spawnPos: i % 2 === 0 ? spawnLeft : spawnRight,
  }));

  console.log(
    `Chair spirits: starting sequence for ${spawnQueue.length} chairs`
  );
}

export function reverseSpiritsSequence() {
  reversing = true;
  reverseIndex = 0;
  reverseTimer = 0;
  spawning = false;
  console.log("Chair spirits: reversing sequence");
}

export function isSequenceComplete() {
  if (spawning) return false;
  return spirits.length > 0 && spirits.every((s) => s.settled || s.removed);
}

export function remainingUnsettled() {
  return spirits.filter((s) => !s.settled && !s.removed).length;
}

/**
 * Spawn a single "late guest" spirit that rushes to an empty seat.
 * It picks a random unoccupied chair position and moves at 3x normal speed.
 */
function spawnLateGuest() {
  if (!spiritsGroup || chairPositions.length === 0) return;

  // Find a chair position not already taken by a spirit
  const takenPositions = new Set(spirits.map((s) => `${s.targetPos.x.toFixed(2)},${s.targetPos.z.toFixed(2)}`));
  const available = chairPositions.filter(
    (p) => !takenPositions.has(`${p.x.toFixed(2)},${p.z.toFixed(2)}`)
  );

  // If all chairs are taken, pick a random one anyway (the late guest squeezes in)
  const target = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : chairPositions[Math.floor(Math.random() * chairPositions.length)];

  // Pick a random spawn side
  const spawnPos = Math.random() > 0.5 ? spawnLeft : spawnRight;

  const lateSpirit = createSpirit(target, spawnPos);
  // Override speed to be 3x faster — in a hurry!
  lateSpirit.speed = SPIRIT_SPEED * 3;
  // Shine extra bright — this one stands out
  lateSpirit.material.opacity = 1.0;
  if (lateSpirit.light) {
    lateSpirit.light.intensity = 1.6;
    lateSpirit.light.distance = 12;
  }

  spirits.push(lateSpirit);
  console.log("Chair spirits: late guest rushes in!");
}

export function updateSpirits(dt) {
  const clamped = Math.min(dt, 0.1);

  // Spawn sequencing
  if (spawning && spawnIndex < spawnQueue.length) {
    spawnTimer += clamped;
    const interval = 0.15 + Math.random() * 0.1;
    while (spawnTimer >= interval && spawnIndex < spawnQueue.length) {
      spawnTimer -= interval;
      const { targetPos, spawnPos } = spawnQueue[spawnIndex];
      spirits.push(createSpirit(targetPos, spawnPos));
      spawnIndex++;
    }
    if (spawnIndex >= spawnQueue.length) {
      spawning = false;
    }
  }

  // Reverse sequencing
  if (reversing && reverseIndex < spirits.length) {
    reverseTimer += clamped;
    const waveInterval = 0.02;
    while (reverseTimer >= waveInterval && reverseIndex < spirits.length) {
      reverseTimer -= waveInterval;
      spirits[reverseIndex].fadingOut = true;
      reverseIndex++;
    }
  }

  for (const spirit of spirits) {
    updateSpiritJourney(spirit, clamped);
  }

  if (spirits.length > 0 && spirits.every((s) => s.removed)) {
    spirits = [];
    reversing = false;
  }

  // Reactive audience lights (sample video → tint spirits)
  updateReactiveLights();

  // Screen content fade
  if (screenFading) {
    screenFadeProgress += clamped / screenFadeDuration;
    if (screenFadeProgress >= 1) {
      screenFadeProgress = 1;
      screenFading = false;
    }
    applyScreenFade(screenFadeProgress);
  }

  // Light dimming / restoring
  if (dimming) {
    dimProgress += clamped / dimDuration;
    if (dimProgress >= 1) {
      dimProgress = 1;
      dimming = false;
    }
    applyDimLevel(dimProgress);
  }

  if (restoring) {
    restoreProgress += clamped / restoreDuration;
    if (restoreProgress >= 1) {
      restoreProgress = 1;
      restoring = false;
    }
    applyRestoreLevel(restoreProgress);
  }
}

// ---------------------------------------------------------------------------
// Cinematic light dimming (includes screen/dome)
// ---------------------------------------------------------------------------

/** Find floor mesh from fbxMeshes by name */
function getFloorMesh() {
  const entry = fbxMeshes.find((m) => m.name.toLowerCase().includes("floor"));
  return entry ? entry : null;
}

/** Find main structure color to derive floor cinema color */
function getMainStructureColor() {
  const entry = fbxMeshes.find((m) => m.name.toLowerCase().includes("main"));
  if (entry && entry.originalColor) return entry.originalColor.clone();
  return new THREE.Color(0x222222);
}

/** Cache the screen object ref (avoid circular import with texture.js) */
let _screenObj = null;
function getScreen() {
  if (!_screenObj) {
    // scene child with screen-like name, or use global ref set by texture.js
    safeTraverse(scene, (child) => {
      if (child.isMesh) {
        const n = (child.name || "").toLowerCase();
        if (n.includes("screen") || n.includes("projection") || n.includes("canvas")) {
          _screenObj = child;
        }
      }
    });
  }
  return _screenObj;
}

function getScreenMaterial() {
  const screen = getScreen();
  if (!screen) return null;
  return getMaterial(screen);
}

function saveCurrentLightValues() {
  savedAmbient = lightingSettings.ambientIntensity;
  savedDirect = lightingSettings.directIntensity;
  savedGlbIntensities = glbLights.map((l) => l.intensity);
  savedExposure = renderer.toneMappingExposure;

  const screenMat = getScreenMaterial();
  if (screenMat) {
    savedScreenEmissive = screenMat.emissiveIntensity ?? 1.0;
  }

  // Save floor color
  const floor = getFloorMesh();
  if (floor) {
    const mat = getMaterial(floor.mesh);
    if (mat && mat.color) savedFloorColor = mat.color.clone();
  }
}

function applyDimLevel(t) {
  // Staggered: direct → ambient → GLB → screen → exposure
  const directT = Math.min(t / 0.4, 1);
  const ambientT = Math.min(Math.max((t - 0.1) / 0.4, 0), 1);
  const glbT = Math.min(Math.max((t - 0.2) / 0.4, 0), 1);
  const screenT = Math.min(Math.max((t - 0.3) / 0.5, 0), 1);
  const exposureT = Math.min(Math.max((t - 0.5) / 0.5, 0), 1);

  setDirectIntensity(savedDirect * (1 - directT));
  setAmbientIntensity(savedAmbient * (1 - ambientT));

  glbLights.forEach((light, i) => {
    if (i < savedGlbIntensities.length) {
      light.intensity = savedGlbIntensities[i] * (1 - glbT);
    }
  });

  // Dim spirit lights in sync with GLB lights
  for (const spirit of spirits) {
    if (spirit.removed || spirit.fadingOut) continue;
    const dimmedOpacity = 0.85 * (1 - glbT * 0.7);
    spirit.material.opacity = dimmedOpacity;
    if (spirit.light) {
      spirit.light.intensity = 0.6 * (1 - glbT * 0.7);
    }
  }

  // Dim renderer exposure for deeper overall darkness
  if (savedExposure !== null) {
    renderer.toneMappingExposure = savedExposure * (1 - exposureT * 0.8);
  }

  // Fade grid lines, images, and pulses — AND dim typography with them
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms) {
    if (screenMat.uniforms.uGridFade) {
      screenMat.uniforms.uGridFade.value = 1.0 - screenT;
    }
    // Dim overall brightness so typography fades out too
    if (screenMat.uniforms.uBrightness) {
      // Typography dims slightly later than grid (starts at t=0.4, full dark by t=1.0)
      const brightnessT = Math.min(Math.max((t - 0.4) / 0.6, 0), 1);
      screenMat.uniforms.uBrightness.value = 1.0 - brightnessT;
    }
  }

  // Darken floor to a darker hue of the MainStructure color
  if (savedFloorColor) {
    const floor = getFloorMesh();
    if (floor) {
      const mat = getMaterial(floor.mesh);
      if (mat && mat.color) {
        const mainColor = getMainStructureColor();
        const hsl = {};
        mainColor.getHSL(hsl);
        // Target: same hue, lower saturation, much darker lightness
        const targetColor = new THREE.Color().setHSL(hsl.h, hsl.s * 0.5, hsl.l * 0.15);
        mat.color.copy(savedFloorColor).lerp(targetColor, glbT);
      }
    }
  }
}

function applyRestoreLevel(t) {
  // Reverse order: exposure → screen → GLB → ambient → direct
  const exposureT = Math.min(t / 0.3, 1);
  const screenT = Math.min(Math.max((t - 0.1) / 0.5, 0), 1);
  const glbT = Math.min(Math.max((t - 0.2) / 0.5, 0), 1);
  const ambientT = Math.min(Math.max((t - 0.3) / 0.5, 0), 1);
  const directT = Math.min(Math.max((t - 0.4) / 0.6, 0), 1);

  setDirectIntensity(savedDirect * directT);
  setAmbientIntensity(savedAmbient * ambientT);

  glbLights.forEach((light, i) => {
    if (i < savedGlbIntensities.length) {
      light.intensity = savedGlbIntensities[i] * glbT;
    }
  });

  // Restore exposure
  if (savedExposure !== null) {
    renderer.toneMappingExposure = savedExposure * (0.2 + exposureT * 0.8);
  }

  // Restore grid lines, generative visuals, and typography brightness
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms) {
    if (screenMat.uniforms.uGridFade) {
      screenMat.uniforms.uGridFade.value = screenT;
    }
    if (screenMat.uniforms.uBrightness) {
      // Brightness restores early so text is readable quickly
      const brightnessT = Math.min(t / 0.6, 1);
      screenMat.uniforms.uBrightness.value = brightnessT;
    }
  }

  // Restore floor color
  if (savedFloorColor) {
    const floor = getFloorMesh();
    if (floor) {
      const mat = getMaterial(floor.mesh);
      if (mat && mat.color) {
        const mainColor = getMainStructureColor();
        const hsl = {};
        mainColor.getHSL(hsl);
        const darkColor = new THREE.Color().setHSL(hsl.h, hsl.s * 0.5, hsl.l * 0.15);
        mat.color.copy(darkColor).lerp(savedFloorColor, glbT);
      }
    }
  }
}

export function dimRoomLights(duration = 3, { playFanfare = true } = {}) {
  saveCurrentLightValues();
  dimDuration = duration;
  dimProgress = 0;
  dimming = true;
  restoring = false;

  if (playFanfare) {
    playCinematicFanfare(duration);
  }
  console.log(`Chair spirits: dimming lights over ${duration}s`);
}

export function restoreRoomLights(duration = 3) {
  if (savedAmbient === null) saveCurrentLightValues();
  restoreDuration = duration;
  restoreProgress = 0;
  restoring = true;
  dimming = false;
  console.log(`Chair spirits: restoring lights over ${duration}s`);
}

// ---------------------------------------------------------------------------
// Screen content fade (shader text/lines/animations fade to black)
// ---------------------------------------------------------------------------

let screenFading = false;
let screenFadeIn = false;
let screenFadeProgress = 0;
let screenFadeDuration = 2;
let savedScreenColor = null;
let savedScreenUniforms = null;

function startScreenFadeOut(duration = 2) {
  const screenMat = getScreenMaterial();
  if (!screenMat) return;

  // Save original values
  if (savedScreenEmissive === null) {
    savedScreenEmissive = screenMat.emissiveIntensity ?? 1.0;
  }
  if (!savedScreenColor && screenMat.color) {
    savedScreenColor = screenMat.color.clone();
  }
  // Save shader uniforms if present (pulse shader)
  if (screenMat.uniforms) {
    savedScreenUniforms = {};
    if (screenMat.uniforms.uBrightness) {
      savedScreenUniforms.brightness = screenMat.uniforms.uBrightness.value;
    }
  }

  screenFading = true;
  screenFadeIn = false;
  screenFadeProgress = 0;
  screenFadeDuration = duration;
}

function startScreenFadeIn(duration = 2) {
  screenFading = true;
  screenFadeIn = true;
  screenFadeProgress = 0;
  screenFadeDuration = duration;
}

function applyScreenFade(t) {
  const screenMat = getScreenMaterial();
  if (!screenMat) return;

  const level = screenFadeIn ? t : 1 - t;

  // Fade grid/lines while keeping text, then fade text too for full blackout
  if (screenMat.uniforms) {
    if (screenMat.uniforms.uGridFade) {
      // Grid fades first (in the first 60% of the fade)
      screenMat.uniforms.uGridFade.value = Math.max(0, level / 0.6);
    }
    if (screenMat.uniforms.uBrightness) {
      // Text fades later (last 40% — for full blackout before video swap)
      screenMat.uniforms.uBrightness.value = Math.min(1, level / 0.4);
    }
  }
}

// ---------------------------------------------------------------------------
// Screen light burst — explosion of light particles from dome center
// ---------------------------------------------------------------------------

let burstParticles = [];
let burstGroup = null;
let burstAnimating = false;

/**
 * Create an explosion of light particles from the dome screen center.
 * Particles radiate outward from the dome, creating a "drenched in light" effect,
 * then fade out to reveal the text beneath.
 * @param {number} count — number of particles
 * @param {number} duration — total burst duration in seconds
 * @returns {Promise} resolves when burst is finished
 */
function screenLightBurst(count = 200, duration = 4) {
  const screen = getScreen();
  if (!screen) return Promise.resolve();

  // Get the screen center and measure its size for proper scaling
  const screenCenter = new THREE.Vector3();
  screen.getWorldPosition(screenCenter);

  // Compute bounding sphere to know how big the dome screen is
  if (!screen.geometry.boundingSphere) screen.geometry.computeBoundingSphere();
  const screenRadius = screen.geometry.boundingSphere?.radius || 3;

  // Get screen normal direction (local Z → world)
  const screenNormal = new THREE.Vector3(0, 0, 1);
  screen.localToWorld(screenNormal).sub(screenCenter).normalize();

  // Create a group if needed
  if (!burstGroup) {
    burstGroup = new THREE.Group();
    burstGroup.name = "LightBurst";
    scene.add(burstGroup);
  }

  // Clean up any previous particles
  while (burstGroup.children.length > 0) {
    const child = burstGroup.children[0];
    burstGroup.remove(child);
    child.geometry?.dispose();
    child.material?.dispose();
  }
  burstParticles = [];

  // Build tangent frame for the screen surface
  const up = new THREE.Vector3(0, 1, 0);
  const tangentX = new THREE.Vector3().crossVectors(up, screenNormal).normalize();
  const tangentY = new THREE.Vector3().crossVectors(screenNormal, tangentX).normalize();

  // Scale particle size relative to the dome — much larger than before
  const particleBaseSize = screenRadius * 0.015;
  const geo = new THREE.SphereGeometry(particleBaseSize, 8, 6);

  // Central bright flash light
  const flashLight = new THREE.PointLight(0xfff5e0, 8, screenRadius * 4);
  flashLight.position.copy(screenCenter).addScaledVector(screenNormal, 0.3);
  burstGroup.add(flashLight);

  for (let i = 0; i < count; i++) {
    const hue = 0.08 + Math.random() * 0.1; // warm golden-white
    const sat = 0.05 + Math.random() * 0.2;
    const light = 0.9 + Math.random() * 0.1;
    const color = new THREE.Color().setHSL(hue, sat, light);

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(screenCenter);

    // Push in front of the screen so particles are visible
    mesh.position.addScaledVector(screenNormal, 0.15);

    burstGroup.add(mesh);

    // Radial direction on the dome surface — scaled to dome size
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.5 + Math.random() * 1.5) * screenRadius;
    const forwardPush = (0.2 + Math.random() * 0.6) * screenRadius * 0.3;

    const dir = new THREE.Vector3()
      .addScaledVector(tangentX, Math.cos(angle) * speed)
      .addScaledVector(tangentY, Math.sin(angle) * speed)
      .addScaledVector(screenNormal, forwardPush);

    burstParticles.push({
      mesh,
      material: mat,
      velocity: dir,
      life: 0,
      maxLife: 1.0 + Math.random() * 1.5, // 1–2.5s lifetime
      delay: Math.random() * 0.5, // Staggered spawn
      scale: 1.0 + Math.random() * 3.0, // much larger scale range
    });
  }

  burstAnimating = true;

  // Flash the screen brightness hard
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
    screenMat.uniforms.uBrightness.value = 5.0; // Intense white flash
  }

  return new Promise((resolve) => {
    const startTime = performance.now();
    const durationMs = duration * 1000;

    function animateBurst() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);

      // Fade screen flash: 5.0 → 1.0 over 2.5s
      if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
        const brightT = Math.min(elapsed / 2500, 1);
        const eased = brightT * brightT; // ease-in for dramatic hold
        screenMat.uniforms.uBrightness.value = 5.0 * (1 - eased) + 1.0 * eased;
      }

      // Bring uGridFade back up so text appears through the light
      if (screenMat && screenMat.uniforms && screenMat.uniforms.uGridFade) {
        const gridT = Math.min(Math.max((elapsed - 800) / 2500, 0), 1);
        screenMat.uniforms.uGridFade.value = gridT;
      }

      // Fade the central flash light
      const lightFade = Math.max(0, 1 - elapsed / 2000);
      flashLight.intensity = 8 * lightFade;

      let allDead = true;
      const dt = 1 / 60; // approximate frame time

      for (const p of burstParticles) {
        if (elapsed < p.delay * 1000) {
          p.mesh.visible = false;
          allDead = false;
          continue;
        }

        p.mesh.visible = true;
        const particleElapsed = (elapsed - p.delay * 1000) / 1000;
        p.life = particleElapsed;

        if (p.life < p.maxLife) {
          allDead = false;
          const lifeT = p.life / p.maxLife;

          // Move outward, decelerating
          const moveSpeed = (1 - lifeT * 0.6) * dt;
          p.mesh.position.addScaledVector(p.velocity, moveSpeed);

          // Scale: rapid grow then slow shrink
          const growPhase = Math.min(lifeT / 0.15, 1); // grow in first 15%
          const shrinkPhase = lifeT > 0.15 ? (lifeT - 0.15) / 0.85 : 0;
          const s = p.scale * growPhase * (1 - shrinkPhase * shrinkPhase);
          p.mesh.scale.setScalar(Math.max(0.01, s));

          // Fade out — hold bright for a while then rapid fade
          const fadeStart = 0.4;
          p.material.opacity = lifeT < fadeStart ? 1.0 : 1 - (lifeT - fadeStart) / (1 - fadeStart);
        } else {
          p.mesh.visible = false;
        }
      }

      if (t < 1 && !allDead) {
        requestAnimationFrame(animateBurst);
      } else {
        // Clean up
        while (burstGroup.children.length > 0) {
          const child = burstGroup.children[0];
          burstGroup.remove(child);
          child.material?.dispose();
        }
        burstParticles = [];
        burstAnimating = false;
        geo.dispose();

        // Ensure screen is at normal brightness with text visible
        if (screenMat && screenMat.uniforms) {
          if (screenMat.uniforms.uBrightness) screenMat.uniforms.uBrightness.value = 1.0;
          if (screenMat.uniforms.uGridFade) screenMat.uniforms.uGridFade.value = 1.0;
        }

        resolve();
      }
    }

    requestAnimationFrame(animateBurst);
  });
}

// ---------------------------------------------------------------------------
// Video playback on dome from URL
// ---------------------------------------------------------------------------

let trailerVideo = null;
let savedScreenMaterial = null;

function playVideoOnDome(url) {
  const screen = getScreen();
  if (!screen) return null;

  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.loop = false;
  video.muted = false;
  video.playsInline = true;

  return new Promise((resolve) => {
    video.addEventListener("loadedmetadata", () => {
      video.play();

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;

      // Save the current material (shader) and replace entirely
      savedScreenMaterial = screen.material;

      screen.material = new THREE.MeshBasicMaterial({
        map: videoTexture,
        toneMapped: false,
        side: THREE.FrontSide,
      });

      trailerVideo = video;
      reactiveLightsActive = true;
      resolve(video);
    });

    video.addEventListener("error", () => {
      console.error("Chair spirits: failed to load trailer video");
      resolve(null);
    });
  });
}

/**
 * Crossfade from video material back to the original dome shader material.
 * Fades the video material opacity down while restoring the shader material.
 */
async function crossfadeVideoToDome(duration = 3) {
  const screen = getScreen();
  if (!screen || !savedScreenMaterial) {
    stopTrailerVideoImmediate();
    return;
  }

  const videoMat = screen.material;
  if (!videoMat || videoMat === savedScreenMaterial) {
    stopTrailerVideoImmediate();
    return;
  }

  // Make video material transparent for crossfade
  videoMat.transparent = true;
  videoMat.opacity = 1;

  // Restore the shader material underneath by putting it in an overlay group
  // Actually, Three.js single-material mesh — we'll animate opacity of the video mat
  // and swap at the end
  const startTime = performance.now();
  const durationMs = duration * 1000;

  return new Promise((resolve) => {
    function fadeStep() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      videoMat.opacity = 1 - t;

      if (t < 1) {
        requestAnimationFrame(fadeStep);
      } else {
        // Swap back to original material
        if (screen.material.map) screen.material.map.dispose();
        screen.material.dispose();
        screen.material = savedScreenMaterial;
        savedScreenMaterial = null;
        if (trailerVideo) {
          trailerVideo.pause();
          trailerVideo.src = "";
          trailerVideo = null;
        }
        reactiveLightsActive = false;
        resolve();
      }
    }
    fadeStep();
  });
}

function stopTrailerVideoImmediate() {
  reactiveLightsActive = false;
  if (trailerVideo) {
    trailerVideo.pause();
    trailerVideo.src = "";
    trailerVideo = null;
  }

  // Restore original screen material
  const screen = getScreen();
  if (screen && savedScreenMaterial) {
    // Dispose the temporary video material
    if (screen.material && screen.material !== savedScreenMaterial) {
      if (screen.material.map) screen.material.map.dispose();
      screen.material.dispose();
    }
    screen.material = savedScreenMaterial;
    savedScreenMaterial = null;
  }
}

// ---------------------------------------------------------------------------
// Reactive audience lights — sample video color and tint spirit lights
// ---------------------------------------------------------------------------

let videoSampleCanvas = null;
let videoSampleCtx = null;
let reactiveLightsActive = false;
const SAMPLE_SIZE = 8; // tiny canvas for average color

function sampleVideoColor() {
  if (!trailerVideo || trailerVideo.paused || trailerVideo.ended) return null;

  if (!videoSampleCanvas) {
    videoSampleCanvas = document.createElement("canvas");
    videoSampleCanvas.width = SAMPLE_SIZE;
    videoSampleCanvas.height = SAMPLE_SIZE;
    videoSampleCtx = videoSampleCanvas.getContext("2d", { willReadFrequently: true });
  }

  try {
    videoSampleCtx.drawImage(trailerVideo, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const data = videoSampleCtx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    let r = 0, g = 0, b = 0;
    const pixels = SAMPLE_SIZE * SAMPLE_SIZE;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return new THREE.Color(r / pixels / 255, g / pixels / 255, b / pixels / 255);
  } catch (e) {
    return null; // cross-origin or not ready
  }
}

function updateReactiveLights() {
  if (!reactiveLightsActive || spirits.length === 0) return;

  const avgColor = sampleVideoColor();
  if (!avgColor) return;

  // Boost saturation slightly for more vivid effect
  const hsl = {};
  avgColor.getHSL(hsl);
  const boosted = new THREE.Color().setHSL(hsl.h, Math.min(hsl.s * 1.4, 1), hsl.l);

  for (const spirit of spirits) {
    if (spirit.removed) continue;
    spirit.material.color.lerp(boosted, 0.15); // smooth blend
    if (spirit.light) {
      spirit.light.color.lerp(boosted, 0.15);
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone dim + film toggle (no spirits needed)
// ---------------------------------------------------------------------------

let filmPlaying = false;

export async function dimAndPlayFilm(videoUrl) {
  if (filmPlaying) return;
  filmPlaying = true;
  const url = videoUrl || DEFAULT_TRAILER_VIDEO;
  console.log("Chair spirits: dim + play film");

  setTrailerMode(true);

  // Fade screen content (text/lines/animations) to black
  startScreenFadeOut(3);

  // Dim room lights fully
  dimRoomLights(4);

  // Wait for screen fade + dim to finish
  await new Promise((r) => setTimeout(r, 4500));

  // Play video
  const video = await playVideoOnDome(url);

  if (video) {
    await new Promise((resolve) => {
      video.addEventListener("ended", resolve, { once: true });
    });
    console.log("Chair spirits: film ended — restoring");
  }

  await stopFilm(3);
}

export async function stopFilm(duration = 3) {
  console.log("Chair spirits: stopping film");
  // Crossfade video out and dome graphics back in
  await crossfadeVideoToDome(duration);

  // Fade screen content back in
  startScreenFadeIn(duration);

  restoreRoomLights(duration);
  setTrailerMode(false);
  filmPlaying = false;
}

// ---------------------------------------------------------------------------
// Full trailer orchestration
// ---------------------------------------------------------------------------

function setTrailerMode(on) {
  document.body.classList.toggle("dome-mode", on);
}

/**
 * Flash a word onto the dome with a brightness pump (no scramble).
 * Places the word on a specific text line, clears the others.
 * @param {string} word — the word to display
 * @param {number} line — which text line (1-5) to place it on
 * @param {number} flashDuration — total brightness pulse duration in ms
 */
function flashWordOnDome(word, line = 3, flashDuration = 800) {
  const screenMat = getScreenMaterial();

  // Place word directly (no scramble) on the specified line, clear others
  for (let i = 1; i <= 5; i++) {
    setTextContent(i, i === line ? word : "");
  }

  // Brightness pump: 0 → peak → 0 (fully dark between words)
  if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
    const startTime = performance.now();
    function pulse() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / flashDuration, 1);
      // Sharp attack (10%), bright hold (30%), full decay to black (60%)
      let brightness;
      if (t < 0.1) {
        brightness = (t / 0.1) * 1.5; // overshoot to 1.5 for bloom punch
      } else if (t < 0.4) {
        brightness = 1.5 - (t - 0.1) / 0.3 * 0.5; // settle from 1.5 to 1.0
      } else {
        brightness = 1.0 * (1 - (t - 0.4) / 0.6); // decay fully to 0
        brightness *= brightness; // ease-in for smooth fade to black
      }
      screenMat.uniforms.uBrightness.value = Math.max(0, brightness);
      if (t < 1) requestAnimationFrame(pulse);
      else screenMat.uniforms.uBrightness.value = 0; // ensure clean zero
    }
    pulse();
  }
}

/**
 * Play the fanfare with words synced to its musical peaks.
 * The fanfare is pitched down 2 semitones (playbackRate ~0.891) so it's ~24s.
 * Words appear on different text lines for visual variety.
 * No scramble effect — clean text with brightness pumps.
 */
async function playFanfareWithWords() {
  // Start the fanfare audio
  await playCinematicFanfare();

  // Word sequence with timestamps matched to the pitched-down fanfare peaks.
  // The original fanfare is ~21s; at 0.891x it's ~23.5s.
  // Each entry specifies which text line (1-5) the word appears on.
  const wordSequence = [
    { time: 3000,  word: "DOME",      line: 3, flash: 1000 },
    { time: 5500,  word: "DREAMING",  line: 4, flash: 1000 },
    { time: 8500,  word: "OPEN",      line: 2, flash: 900  },
    { time: 10500, word: "CALL",      line: 5, flash: 900  },
    { time: 13000, word: "LIVE",      line: 3, flash: 1000 },
    { time: 15500, word: "NOW",       line: 2, flash: 1000 },
    { time: 17500, word: "APPLY",     line: 4, flash: 1000 },
    { time: 19500, word: "LATEST",    line: 3, flash: 900  },
    { time: 21500, word: "1 MARCH",   line: 5, flash: 1400 },
  ];

  const startTime = performance.now();

  for (const entry of wordSequence) {
    const now = performance.now();
    const waitTime = entry.time - (now - startTime);
    if (waitTime > 0) {
      await new Promise((r) => setTimeout(r, waitTime));
    }
    console.log(`Chair spirits: "${entry.word}" (line ${entry.line})`);
    flashWordOnDome(entry.word, entry.line, entry.flash);
  }

  // Hold last word briefly, then dim to black
  await new Promise((r) => setTimeout(r, 2500));

  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
    screenMat.uniforms.uBrightness.value = 0;
  }
}

export async function runTrailerSequence() {
  console.log("Chair spirits: trailer sequence started");

  // Fade out page text
  setTrailerMode(true);

  // 1. Start audio if available (ambient soundscape while spirits find seats)
  //    Re-enable audio system in case it was stopped by a previous run
  if (window.startAudio) {
    try { await window.startAudio(); } catch (e) { /* needs gesture */ }
  }

  // 2. Save current rotation, text, and image state for later restore
  savedGridRotationSpeed = textureRotationSettings.speed;
  savedTextRotationEnabled = polarGridSettings.textRotationEnabled;
  savedTextRotationBPM = polarGridSettings.textRotationBPM;
  savedTextScrambleEnabled = polarGridSettings.textScrambleEnabled;
  savedImageCellsEnabled = polarGridSettings.imageCellsEnabled;
  savedTextContents = {};
  for (let i = 1; i <= 5; i++) {
    savedTextContents[i] = polarGridSettings[`text${i}Content`];
  }

  // Make sure any previous fanfare is cleaned up
  disposeFanfare();

  // 3. Spirits float in
  startSpiritsSequence();

  // 4. Wait for ~40% spirits seated — then begin the cinematic buildup
  const earlyCount = Math.floor(chairPositions.length * 0.4);
  await new Promise((resolve) => {
    const check = setInterval(() => {
      const settledCount = spirits.filter((s) => s.settled).length;
      if (settledCount >= earlyCount) {
        clearInterval(check);
        resolve();
      }
    }, 200);
  });

  // === Everything below runs in parallel for a layered cinematic buildup ===

  // 5. Fade out pulse audio in background
  const pulseAudioFadeDuration = 5;
  const fadeSteps = 20;
  const stepTime = (pulseAudioFadeDuration * 1000) / fadeSteps;
  let step = 0;
  const audioFadePromise = new Promise((resolve) => {
    const fadeInterval = setInterval(() => {
      step++;
      const level = 1 - step / fadeSteps;
      setMasterVolume(Math.max(0, level * 0.5));
      if (step >= fadeSteps) {
        clearInterval(fadeInterval);
        stopPulseAudio();
        resolve();
      }
    }, stepTime);
  });

  // 6. Ease grid rotation to zero (ease-out quintic, very smooth long tail)
  const rotSlowDuration = 5000;
  const rotSlowStart = performance.now();
  const origSpeed = textureRotationSettings.speed;
  const rotSlowPromise = new Promise((resolve) => {
    function slowDown() {
      const elapsed = performance.now() - rotSlowStart;
      const t = Math.min(elapsed / rotSlowDuration, 1);
      const eased = 1 - Math.pow(1 - t, 5);
      textureRotationSettings.speed = origSpeed * (1 - eased);
      if (t < 1) {
        requestAnimationFrame(slowDown);
      } else {
        textureRotationSettings.speed = 0;
        resolve();
      }
    }
    requestAnimationFrame(slowDown);
  });

  // Stop text step rotation (per-cell BPM stepping, separate from grid)
  setTextRotationEnabled(false);

  // 7. Start dimming lights (6s)
  const dimDur = 6;
  dimRoomLights(dimDur, { playFanfare: false });

  // 8. ONLY wait for the dim to finish — don't wait for spirits or late guest.
  //    The dim is 6s. Rotation (5s) and audio fade (5s) finish within that too.
  await new Promise((resolve) => {
    const dimCheck = setInterval(() => {
      if (!dimming) {
        clearInterval(dimCheck);
        resolve();
      }
    }, 100);
  });

  // Screen is now fully dark — safe to regenerate texture without images
  setImageCellsEnabled(false);

  // Fire late guest in background (arrives during the fanfare — doesn't block)
  setTimeout(() => spawnLateGuest(), 2000);

  // 9. Start fanfare IMMEDIATELY — room is dark, music begins
  console.log("Chair spirits: starting fanfare word sequence");
  await playFanfareWithWords();

  console.log("Chair spirits: fanfare word sequence complete");

  // 12. Set up final announcement with scramble-in effect
  setTextScrambleEnabled(true);
  scrambleToNewText({
    1: "OPEN CALL",
    2: "IS LIVE",
    3: "DOME DREAMING",
    4: "FULLDOME FILM FESTIVAL",
    5: "DEADLINE 1ST OF MARCH",
  }, 600);

  // Bring brightness back up to show the final announcement
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
    const rampStart = performance.now();
    await new Promise((resolve) => {
      function rampUp() {
        const t = Math.min((performance.now() - rampStart) / 2000, 1);
        screenMat.uniforms.uBrightness.value = t;
        if (t < 1) requestAnimationFrame(rampUp);
        else resolve();
      }
      rampUp();
    });
  }

  console.log("Chair spirits: open call announcement revealed");

  // Hold the announcement
  await new Promise((r) => setTimeout(r, 6000));

  // 13. Reverse everything
  await reverseTrailer(4);
}

export async function reverseTrailer(duration = 3) {
  console.log("Chair spirits: reversing trailer");

  // Stop fanfare if still playing
  disposeFanfare();

  // Scramble text back to original content
  if (savedTextContents) {
    scrambleToNewText(savedTextContents, 400);
  }

  // Restore grid, screen, and lights (applyRestoreLevel now handles uBrightness too)
  startScreenFadeIn(duration);
  restoreRoomLights(duration);
  reverseSpiritsSequence();
  filmPlaying = false;

  // Gradually restore grid rotation speed (ease-in for gentle start)
  const restoreRotStart = performance.now();
  const restoreRotDuration = duration * 1000;
  const targetSpeed = savedGridRotationSpeed ?? 0.02;
  function restoreRot() {
    const elapsed = performance.now() - restoreRotStart;
    const t = Math.min(elapsed / restoreRotDuration, 1);
    const eased = t * t; // ease-in quadratic — gentle start
    textureRotationSettings.speed = targetSpeed * eased;
    if (t < 1) requestAnimationFrame(restoreRot);
  }
  restoreRot();

  // Restore text rotation and scramble settings
  if (savedTextRotationEnabled !== null) {
    setTextRotationEnabled(savedTextRotationEnabled);
  }
  if (savedTextRotationBPM !== null) {
    setTextRotationBPM(savedTextRotationBPM);
  }
  if (savedTextScrambleEnabled !== null) {
    setTextScrambleEnabled(savedTextScrambleEnabled);
  }

  // Restore images in the grid texture
  if (savedImageCellsEnabled !== null) {
    setImageCellsEnabled(savedImageCellsEnabled);
  }

  // Fade text back in
  setTrailerMode(false);
}
