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
const SPIRIT_SPEED = 0.6;
/** Speed variance so they don't all move in lockstep */
const SPIRIT_SPEED_JITTER = 0.2;
/** Time (seconds) for spirit light to ramp from zero to full intensity */
const RAMP_DURATION = 2.5;

/** Default trailer video */
const DEFAULT_TRAILER_VIDEO = "assets/video/ParallelPromoLQ.mp4";

// ---------------------------------------------------------------------------
// Cinematic fanfare — bombastic intro sound (20th Century Fox style)
// Built entirely with Tone.js: sub-bass, brass chords, timpani, crescendo
// ---------------------------------------------------------------------------

let fanfareNodes = []; // all Tone nodes to dispose

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

function disposeFanfare() {
  fanfareNodes.forEach((n) => {
    try { n.dispose(); } catch (_) {}
  });
  fanfareNodes = [];
}

/**
 * Play a bombastic cinematic fanfare over `duration` seconds.
 * Layers: sub-bass rumble, brass-like synth chords, timpani hits, cymbal swell.
 */
async function playCinematicFanfare(duration) {
  try {
    const T = await ensureTone();
    if (!T) return;
    disposeFanfare();

    // Master bus: large reverb → destination
    const reverb = new T.Reverb({ decay: 6, wet: 0.4 });
    await reverb.generate();
    reverb.toDestination();
    fanfareNodes.push(reverb);

    const masterGain = new T.Gain(0).connect(reverb);
    fanfareNodes.push(masterGain);

    // Slow build to full volume, sustain, then fade with the visual dim
    masterGain.gain.rampTo(1.0, duration * 0.5);
    setTimeout(() => {
      if (masterGain) masterGain.gain.rampTo(0, duration * 0.3);
    }, duration * 700);

    // ── 1. Sub-bass rumble (floor shaking low end) ──────────────────
    const subFilter = new T.Filter({ frequency: 60, type: "lowpass", rolloff: -24 }).connect(masterGain);
    fanfareNodes.push(subFilter);

    const sub = new T.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: duration * 0.4, decay: 2, sustain: 0.8, release: duration * 0.3 },
      volume: -10,
    }).connect(subFilter);
    fanfareNodes.push(sub);

    sub.triggerAttack("C1");
    subFilter.frequency.rampTo(250, duration * 0.8);

    // ── 2. Brass fanfare (big Hollywood horns) ──────────────────────
    const brassFilter = new T.Filter({ frequency: 300, type: "lowpass", rolloff: -12 }).connect(masterGain);
    fanfareNodes.push(brassFilter);
    brassFilter.frequency.rampTo(4000, duration * 0.7);

    const brass = new T.PolySynth(T.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: duration * 0.2, decay: 0.5, sustain: 0.85, release: duration * 0.3 },
      volume: -16,
    }).connect(brassFilter);
    fanfareNodes.push(brass);

    // Staggered entry — building tension
    brass.triggerAttack(["C3", "G3"], "+0");
    setTimeout(() => {
      try { brass.triggerAttack(["E4", "C4"]); } catch (_) {}
    }, duration * 150);
    setTimeout(() => {
      try { brass.triggerAttack(["G4", "C5"]); } catch (_) {}
    }, duration * 300);

    // CLIMAX — full orchestra chord with key change feel
    setTimeout(() => {
      try {
        brass.releaseAll();
        brass.triggerAttack(["C3", "E3", "G3", "Bb3", "C4", "E4", "G4", "C5", "E5"]);
      } catch (_) {}
    }, duration * 500);

    // ── 3. Horn swell (warm mid-range power) ────────────────────────
    const hornFilter = new T.Filter({ frequency: 600, type: "lowpass", rolloff: -12 }).connect(masterGain);
    fanfareNodes.push(hornFilter);
    hornFilter.frequency.rampTo(2500, duration * 0.6);

    const horn = new T.PolySynth(T.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: duration * 0.35, decay: 1, sustain: 0.7, release: duration * 0.3 },
      volume: -18,
    }).connect(hornFilter);
    fanfareNodes.push(horn);

    setTimeout(() => {
      try { horn.triggerAttack(["F3", "A3", "C4", "F4"]); } catch (_) {}
    }, duration * 100);
    // Resolve to C at climax
    setTimeout(() => {
      try {
        horn.releaseAll();
        horn.triggerAttack(["C3", "E3", "G3", "C4"]);
      } catch (_) {}
    }, duration * 500);

    // ── 4. Timpani rolls and hits ───────────────────────────────────
    const timpani = new T.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 6,
      envelope: { attack: 0.01, decay: 2, sustain: 0, release: 1.5 },
      volume: -6,
    }).connect(masterGain);
    fanfareNodes.push(timpani);

    // Dramatic pattern: building roll into climax
    const hitTimes = [0.03, 0.12, 0.22, 0.32, 0.42, 0.50, 0.52, 0.60, 0.70, 0.80];
    const hitNotes = ["C2", "G1", "C2", "G1", "C2", "C2", "G1", "C2", "G1", "C2"];
    hitTimes.forEach((frac, i) => {
      setTimeout(() => {
        try { timpani.triggerAttackRelease(hitNotes[i], "2n"); } catch (_) {}
      }, duration * frac * 1000);
    });

    // ── 5. Cymbal swell + crash ─────────────────────────────────────
    const noiseFilter = new T.Filter({ frequency: 400, type: "bandpass", Q: 0.4 }).connect(masterGain);
    fanfareNodes.push(noiseFilter);
    noiseFilter.frequency.rampTo(10000, duration * 0.5);

    const noiseGain = new T.Gain(0).connect(noiseFilter);
    fanfareNodes.push(noiseGain);
    noiseGain.gain.rampTo(0.18, duration * 0.5);
    // Cymbal crash at climax then sustain
    setTimeout(() => {
      if (noiseGain) {
        noiseGain.gain.rampTo(0.25, 0.1); // crash
        setTimeout(() => noiseGain.gain.rampTo(0, duration * 0.25), 200);
      }
    }, duration * 500);

    const noise = new T.Noise("white").connect(noiseGain);
    fanfareNodes.push(noise);
    noise.start();

    // ── 6. String shimmer (ethereal sparkle at climax) ──────────────
    const shimmer = new T.PolySynth(T.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: duration * 0.25, decay: 0.5, sustain: 0.7, release: duration * 0.3 },
      volume: -22,
    }).connect(masterGain);
    fanfareNodes.push(shimmer);

    setTimeout(() => {
      try { shimmer.triggerAttack(["C5", "E5", "G5", "C6"]); } catch (_) {}
    }, duration * 400);

    // ── 7. Deep power chord (cinematic punch at climax) ─────────────
    const powerFilter = new T.Filter({ frequency: 200, type: "lowpass", rolloff: -12 }).connect(masterGain);
    fanfareNodes.push(powerFilter);
    powerFilter.frequency.rampTo(1500, duration * 0.3);

    const power = new T.PolySynth(T.Synth, {
      oscillator: { type: "square" },
      envelope: { attack: 0.05, decay: 1, sustain: 0.6, release: duration * 0.3 },
      volume: -22,
    }).connect(powerFilter);
    fanfareNodes.push(power);

    setTimeout(() => {
      try { power.triggerAttack(["C2", "G2", "C3"]); } catch (_) {}
    }, duration * 500);

    // ── Release everything together ─────────────────────────────────
    setTimeout(() => {
      try {
        sub.triggerRelease();
        brass.releaseAll();
        horn.releaseAll();
        shimmer.releaseAll();
        power.releaseAll();
        noise.stop();
      } catch (_) {}
    }, duration * 850);

    setTimeout(() => disposeFanfare(), (duration + 3) * 1000);
    console.log(`Chair spirits: cinematic fanfare playing (${duration}s)`);
  } catch (e) {
    console.warn("Chair spirits: fanfare sound skipped", e);
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

  // Gradually dim the dome screen generative visuals (lines, text, patterns)
  const screenMat = getScreenMaterial();
  if (screenMat && savedScreenEmissive !== null) {
    screenMat.emissiveIntensity = savedScreenEmissive * (1 - screenT);
    if (screenMat.color) {
      const c = 1 - screenT;
      screenMat.color.setRGB(c, c, c);
    }
    // Also dim shader uniforms (pulse brightness) for generative content
    if (screenMat.uniforms && screenMat.uniforms.uPulseIntensity) {
      screenMat.uniforms.uPulseIntensity.value = 1.0 * (1 - screenT);
    }
    screenMat.needsUpdate = true;
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

  // Restore the dome screen and generative visuals
  const screenMat = getScreenMaterial();
  if (screenMat && savedScreenEmissive !== null) {
    screenMat.emissiveIntensity = savedScreenEmissive * screenT;
    if (screenMat.color) {
      screenMat.color.setRGB(screenT, screenT, screenT);
    }
    if (screenMat.uniforms && screenMat.uniforms.uPulseIntensity) {
      screenMat.uniforms.uPulseIntensity.value = screenT;
    }
    screenMat.needsUpdate = true;
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

export function dimRoomLights(duration = 3) {
  saveCurrentLightValues();
  dimDuration = duration;
  dimProgress = 0;
  dimming = true;
  restoring = false;

  // Fade pulse audio (drones/ticks) in sync with screen graphics fading out.
  // Screen graphics start fading at 30% of dim progress, so delay the audio fade.
  // The fanfare has its own gain chain and is NOT affected by this.
  const audioFadeDelay = duration * 0.3; // when screen graphics start dimming
  const audioFadeDuration = duration * 0.5; // fade over the same window
  setTimeout(() => {
    // Gradually reduce pulse audio volume to zero
    const steps = 20;
    const stepTime = (audioFadeDuration * 1000) / steps;
    let step = 0;
    const fadeInterval = setInterval(() => {
      step++;
      const level = 1 - step / steps;
      setMasterVolume(Math.max(0, level * 0.5)); // 0.5 is default master volume
      if (step >= steps) {
        clearInterval(fadeInterval);
        stopPulseAudio();
      }
    }, stepTime);
  }, audioFadeDelay * 1000);

  // Play cinematic fanfare (uses its own audio chain, unaffected by pulse fade)
  playCinematicFanfare(duration);
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

  if (screenMat.emissiveIntensity !== undefined && savedScreenEmissive !== null) {
    screenMat.emissiveIntensity = savedScreenEmissive * level;
  }
  if (screenMat.color) {
    const base = savedScreenColor || new THREE.Color(1, 1, 1);
    screenMat.color.setRGB(base.r * level, base.g * level, base.b * level);
  }
  // Fade shader uniforms (pulse shader brightness)
  if (screenMat.uniforms && screenMat.uniforms.uBrightness && savedScreenUniforms) {
    screenMat.uniforms.uBrightness.value = (savedScreenUniforms.brightness || 1.0) * level;
  }
  screenMat.needsUpdate = true;
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

export async function runTrailerSequence(videoUrl) {
  const url = videoUrl || DEFAULT_TRAILER_VIDEO;
  console.log("Chair spirits: trailer sequence started");

  // Fade out page text
  setTrailerMode(true);

  // 1. Start audio if available (ambient soundscape while spirits find seats)
  if (window.startAudio) {
    try { await window.startAudio(); } catch (e) { /* needs gesture */ }
  }

  // 2. Spirits float in
  startSpiritsSequence();

  // 3. Wait for half the spirits to spawn, then start dimming
  const halfCount = Math.floor(chairPositions.length / 2);
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (spirits.length >= halfCount) {
        clearInterval(check);
        resolve();
      }
    }, 200);
  });

  // Start dimming once half have spawned
  dimRoomLights(15);

  // 4. Wait for all spirits to settle
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (isSequenceComplete()) {
        clearInterval(check);
        resolve();
      }
    }, 200);
  });

  // 5. Ensure dim finishes if spirits settled early
  while (dimming) {
    await new Promise((r) => setTimeout(r, 200));
  }

  // 6. Fade screen content to black before swapping to video
  startScreenFadeOut(2);
  await new Promise((r) => setTimeout(r, 2200));

  // 5. Play video on dome
  console.log("Chair spirits: playing video on dome");
  const video = await playVideoOnDome(url);

  if (video) {
    // Wait for video to end
    await new Promise((resolve) => {
      video.addEventListener("ended", resolve, { once: true });
    });
    console.log("Chair spirits: video ended — reversing");
  }

  // 5. Reverse everything
  await reverseTrailer(3);
}

export async function reverseTrailer(duration = 3) {
  console.log("Chair spirits: reversing trailer");
  // Crossfade video out and dome graphics back in
  await crossfadeVideoToDome(duration);
  startScreenFadeIn(duration);
  restoreRoomLights(duration);
  reverseSpiritsSequence();
  filmPlaying = false;
  // Fade text back in
  setTrailerMode(false);
}
