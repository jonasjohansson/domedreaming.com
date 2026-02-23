/**
 * Chair Spirits — cinematic trailer sequence
 *
 * Spirit lights spawn at entry points and follow the navmesh path (stairs,
 * aisles) to reach their assigned chairs — like ghosts finding their seats.
 * Room lights dim cinematically, a film plays, then everything reverses.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { scene } from "./scene.js";
import { safeTraverse, pruneObjectChildren } from "./utils.js";
import {
  lightingSettings,
  setAmbientIntensity,
  setDirectIntensity,
} from "./lighting.js";
import { glbLights } from "./model.js";
import { getNavMeshQuery } from "./navmesh.js";
import { getMaterial } from "./utils.js";
import { initAudio } from "./pulse-audio.js";

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
// Cinematic sound — low rumble during dim using Tone.js
// ---------------------------------------------------------------------------

let rumbleSynth = null;
let rumbleFilter = null;
let rumbleGain = null;

async function playDimRumble(duration) {
  try {
    const Tone = window.Tone;
    if (!Tone) {
      await initAudio();
      if (!window.Tone) return;
    }

    // Ensure audio context is running
    if (Tone.context.state !== "running") {
      await Tone.start();
    }

    // Clean up previous rumble
    disposeDimRumble();

    // Low-pass filter sweeps from 60Hz up to 300Hz
    rumbleFilter = new Tone.Filter({
      frequency: 60,
      type: "lowpass",
      rolloff: -24,
    }).toDestination();

    rumbleGain = new Tone.Gain(0).connect(rumbleFilter);

    // Deep rumble: two detuned oscillators
    rumbleSynth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: duration * 0.4, decay: 0.5, sustain: 0.6, release: duration * 0.3 },
      volume: -18,
    }).connect(rumbleGain);

    // Fade gain in
    rumbleGain.gain.rampTo(0.7, duration * 0.5);

    // Sweep filter up
    rumbleFilter.frequency.rampTo(300, duration * 0.8);

    // Play a very low note
    rumbleSynth.triggerAttack("C1");

    // Release and fade out near the end
    setTimeout(() => {
      if (rumbleGain) rumbleGain.gain.rampTo(0, duration * 0.3);
      if (rumbleSynth) rumbleSynth.triggerRelease();
    }, duration * 700); // 70% through

    // Dispose after done
    setTimeout(() => disposeDimRumble(), (duration + 1) * 1000);
  } catch (e) {
    console.warn("Chair spirits: rumble sound skipped", e);
  }
}

function disposeDimRumble() {
  try {
    if (rumbleSynth) { rumbleSynth.dispose(); rumbleSynth = null; }
    if (rumbleFilter) { rumbleFilter.dispose(); rumbleFilter = null; }
    if (rumbleGain) { rumbleGain.dispose(); rumbleGain = null; }
  } catch (e) { /* already disposed */ }
}

// ---------------------------------------------------------------------------
// GLB loading — extract marker positions, then discard the geometry
// ---------------------------------------------------------------------------

export async function loadChairMarkers() {
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/libs/draco/gltf/"
  );
  loader.setDRACOLoader(dracoLoader);

  return new Promise((resolve, reject) => {
    loader.load(
      "assets/models/wisdome-chairs.glb",
      (gltf) => {
        const root = gltf.scene;
        pruneObjectChildren(root);

        // Temporarily add to scene so world matrices resolve
        scene.add(root);
        root.updateMatrixWorld(true);

        const positions = [];
        let left = null;
        let right = null;

        safeTraverse(root, (child) => {
          const name = (child.name || "").toLowerCase();
          if (name === "startingpointleft") {
            left = new THREE.Vector3();
            child.getWorldPosition(left);
          } else if (name === "startingpointright") {
            right = new THREE.Vector3();
            child.getWorldPosition(right);
          } else if (name.startsWith("chairmarker")) {
            const pos = new THREE.Vector3();
            child.getWorldPosition(pos);
            positions.push(pos);
          }
        });

        // Remove GLB — markers are data only
        scene.remove(root);
        root.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material))
              child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });

        // Shuffle for visual variety
        for (let i = positions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        chairPositions = positions;

        if (left) spawnLeft.copy(left);
        else spawnLeft.set(-5, 2, 0);

        if (right) spawnRight.copy(right);
        else spawnRight.set(5, 2, 0);

        // Create container group
        spiritsGroup = new THREE.Group();
        spiritsGroup.name = "ChairSpirits";
        scene.add(spiritsGroup);

        console.log(
          `Chair spirits: loaded ${positions.length} markers, spawn L/R set`
        );
        resolve(positions.length);
      },
      undefined,
      (err) => {
        console.error("Chair spirits: failed to load GLB", err);
        reject(err);
      }
    );
  });
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

  const screenMat = getScreenMaterial();
  if (screenMat) {
    savedScreenEmissive = screenMat.emissiveIntensity ?? 1.0;
  }
}

function applyDimLevel(t) {
  // Staggered: direct → ambient → GLB → screen
  const directT = Math.min(t / 0.5, 1);
  const ambientT = Math.min(Math.max((t - 0.15) / 0.5, 0), 1);
  const glbT = Math.min(Math.max((t - 0.3) / 0.5, 0), 1);
  const screenT = Math.min(Math.max((t - 0.4) / 0.6, 0), 1);

  setDirectIntensity(savedDirect * (1 - directT));
  setAmbientIntensity(savedAmbient * (1 - ambientT));

  glbLights.forEach((light, i) => {
    if (i < savedGlbIntensities.length) {
      light.intensity = savedGlbIntensities[i] * (1 - glbT);
    }
  });

  // Dim the dome screen to black
  const screenMat = getScreenMaterial();
  if (screenMat && savedScreenEmissive !== null) {
    screenMat.emissiveIntensity = savedScreenEmissive * (1 - screenT);
    if (screenMat.color) {
      const c = 1 - screenT;
      screenMat.color.setRGB(c, c, c);
    }
    screenMat.needsUpdate = true;
  }
}

function applyRestoreLevel(t) {
  // Reverse order: screen → GLB → ambient → direct
  const screenT = Math.min(t / 0.5, 1);
  const glbT = Math.min(Math.max((t - 0.15) / 0.5, 0), 1);
  const ambientT = Math.min(Math.max((t - 0.3) / 0.5, 0), 1);
  const directT = Math.min(Math.max((t - 0.4) / 0.6, 0), 1);

  setDirectIntensity(savedDirect * directT);
  setAmbientIntensity(savedAmbient * ambientT);

  glbLights.forEach((light, i) => {
    if (i < savedGlbIntensities.length) {
      light.intensity = savedGlbIntensities[i] * glbT;
    }
  });

  // Restore the dome screen
  const screenMat = getScreenMaterial();
  if (screenMat && savedScreenEmissive !== null) {
    screenMat.emissiveIntensity = savedScreenEmissive * screenT;
    if (screenMat.color) {
      screenMat.color.setRGB(screenT, screenT, screenT);
    }
    screenMat.needsUpdate = true;
  }
}

export function dimRoomLights(duration = 3) {
  saveCurrentLightValues();
  dimDuration = duration;
  dimProgress = 0;
  dimming = true;
  restoring = false;

  // Fade audio out over the dim duration then stop
  try {
    const Tone = window.Tone;
    if (Tone && Tone.Destination) {
      Tone.Destination.volume.rampTo(-Infinity, duration * 0.8);
      setTimeout(() => {
        if (window.stopAudio) window.stopAudio();
        // Reset destination volume for later use
        if (Tone.Destination) Tone.Destination.volume.value = 0;
      }, duration * 1000);
    } else if (window.stopAudio) {
      window.stopAudio();
    }
  } catch (e) {
    if (window.stopAudio) window.stopAudio();
  }

  // Play cinematic rumble
  playDimRumble(duration);
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

function stopTrailerVideo() {
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
  stopTrailerVideo();

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

  // 2. Start dimming immediately — long slow dim across the whole sequence
  dimRoomLights(20);

  // 3. Spirits float in
  startSpiritsSequence();

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
  stopTrailerVideo();
  startScreenFadeIn(duration);
  restoreRoomLights(duration);
  reverseSpiritsSequence();
  filmPlaying = false;
  // Fade text back in
  setTrailerMode(false);
}
