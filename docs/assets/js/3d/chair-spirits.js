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
import { playFanfareSynth, FANFARE_DURATION_MS } from "./fanfare-synth.js";
import { textureRotationSettings } from "../core/settings.js";
import {
  scrambleToNewText,
  setTextContent,
  setTextStartSector,
  setTextRotationEnabled,
  setTextRotationBPM,
  setTextScrambleEnabled,
  setImageCellsEnabled,
  setGridLinesEnabled,
  setPulsesEnabled,
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
/** InstancedMesh for all spirits — single draw call instead of 94 */
let spiritInstancedMesh = null;
let spiritSharedMat = null;
const MAX_SPIRITS = 100; // pre-allocate instance slots
const _instanceMatrix = new THREE.Matrix4();
const _instanceColor = new THREE.Color();

function ensureSpiritInstancedMesh() {
  if (spiritInstancedMesh) return;
  const geo = new THREE.SphereGeometry(0.04, 8, 6);
  spiritSharedMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  spiritInstancedMesh = new THREE.InstancedMesh(geo, spiritSharedMat, MAX_SPIRITS);
  spiritInstancedMesh.count = 0; // start with zero visible instances
  spiritInstancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_SPIRITS * 3), 3
  );
  spiritInstancedMesh.frustumCulled = false;
  spiritsGroup.add(spiritInstancedMesh);
}

/** PointLights for a select few spirits — illuminate surroundings */
const SPIRIT_LIGHT_COUNT = 8; // how many spirits get real lights
const SPIRIT_LIGHT_INTENSITY = 0.6; // settled intensity
const SPIRIT_LIGHT_DISTANCE = 3; // light range
const SPIRIT_LIGHT_DECAY = 2; // physical light falloff
const spiritLights = []; // { light, spiritIdx }

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
const SPIRIT_SPEED = 1.24;
/** Speed variance so they don't all move in lockstep */
const SPIRIT_SPEED_JITTER = 0.2;
/** Time (seconds) for spirit light to ramp from zero to full intensity */
const RAMP_DURATION = 2.5;

/** Default trailer video (used by dimAndPlayFilm legacy path) */
const DEFAULT_TRAILER_VIDEO = "assets/video/ParallelPromoLQ.mp4";

/**
 * Fanfare word cue settings — editable via GUI.
 * Each cue: { time (ms), word, line (1-5), flash (ms) }
 * word=null means flash all accumulated words. line=0 for null words.
 */
/**
 * Fanfare cues — derived from MIDI tick positions in fanfare-synth.js.
 * Words with \n are displayed across two lines (split in flashWordOnDome).
 */
export const fanfareCues = {
  cue1:  { time:   320, word: "DOME",                    line: 2, flash:  800 },
  cue2:  { time:  1219, word: "DOME",                    line: 2, flash:  800 },
  cue3:  { time:  2478, word: "DREAMING",                line: 2, flash: 1000 },
  cue4:  { time:  3517, word: "DREAMING",                line: 2, flash:  300 },
  cue5:  { time:  3880, word: "DREAMING",                line: 2, flash:  600 },
  cue6:  { time:  4556, word: "FULLDOME\nFILM FESTIVAL",  line: 2, flash:  400 },
  cue7:  { time:  5056, word: "FULLDOME\nFILM FESTIVAL",  line: 2, flash:  800 },
  cue8:  { time:  6365, word: "OPEN CALL\nFOR ARTISTS",  line: 2, flash:  400 },
  cue9:  { time:  6786, word: "OPEN CALL\nFOR ARTISTS",  line: 2, flash:  500 },
  cue10: { time:  8473, word: "SUBMISSIONS\nOPEN",       line: 2, flash:  500 },
  cue11: { time:  9140, word: "SUBMISSIONS\nOPEN",       line: 2, flash:  400 },
  cue12: { time:  9787, word: "SUBMISSIONS\nOPEN",       line: 2, flash:  950 },
  cue13: { time: 11290, word: "WORKS IN\nPROGRESS",      line: 2, flash:  450 },
  cue14: { time: 11850, word: "FULLDOME\nFILMS",         line: 2, flash:  800 },
  cue15: { time: 13379, word: "INSTALLATIONS",            line: 2, flash:  450 },
  cue16: { time: 13849, word: "AV LIVE",                  line: 2, flash:  800 },
  cue17: { time: 15447, word: "APPLY\n8TH OF MARCH",    line: 2, flash:  350 },
  cue18: { time: 15926, word: "APPLY\n8TH OF MARCH",    line: 2, flash: 2900 },
  cue19: { time: 19104, word: null,                       line: 2, flash: 4000 },
};

// ---------------------------------------------------------------------------
// Timeline visualisation overlay
// ---------------------------------------------------------------------------

const TIMELINE_DURATION = 23500; // ms — total timeline length for display
const WORD_COLORS = {
  "DOME": "#FF6B6B",
  "DREAMING": "#4ECDC4",
  "DOME DREAMING": "#FF6B6B",
  "OPEN CALL\nFOR ARTISTS": "#FFE66D",
  "SUBMISSIONS\nOPEN": "#A8E6CF",
  "WORKS IN\nPROGRESS": "#DDA0DD",
  "FULLDOME\nFILMS": "#87CEEB",
  "INSTALLATIONS": "#F0E68C",
  "AV LIVE": "#FFA07A",
  "APPLY\n8TH OF MARCH": "#FF69B4",
  null: "#FFFFFF",
};

let timelineOverlay = null;
let timelinePlayhead = null;
let timelineAnimId = null;
let timelineStartTime = null;
/** Audio element the playhead should sync to (when available) */
let timelineAudioRef = null;
/** Pause state for timeline playback */
let timelinePaused = false;
let timelinePausedElapsed = 0;


export function toggleTimeline() {
  if (timelineOverlay) {
    closeTimeline();
  } else {
    openTimeline();
  }
}

/** Waveform data cache */
let waveformData = null; // { peaks: Float32Array, durationMs: number }
const WAVEFORM_PEAKS_COUNT = 800;
/** Playback rate used for the fanfare (native 112 BPM) */
const FANFARE_PLAYBACK_RATE = 1.0;

async function decodeWaveform() {
  if (waveformData) return waveformData;
  try {
    const resp = await fetch("assets/audio/fanfare.mp3");
    const buf = await resp.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await audioCtx.decodeAudioData(buf);
    const nativeDurationMs = decoded.duration * 1000;
    // Real-world playback duration at the slowed rate
    const playbackDurationMs = nativeDurationMs / FANFARE_PLAYBACK_RATE;
    // Merge channels into mono peaks
    const raw = decoded.getChannelData(0);
    const second = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
    const samplesPerPeak = Math.floor(raw.length / WAVEFORM_PEAKS_COUNT);
    const peaks = new Float32Array(WAVEFORM_PEAKS_COUNT);
    for (let i = 0; i < WAVEFORM_PEAKS_COUNT; i++) {
      let max = 0;
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, raw.length);
      for (let j = start; j < end; j++) {
        let sample = Math.abs(raw[j]);
        if (second) sample = Math.max(sample, Math.abs(second[j]));
        if (sample > max) max = sample;
      }
      peaks[i] = max;
    }
    audioCtx.close();
    waveformData = { peaks, durationMs: playbackDurationMs };
    return waveformData;
  } catch (e) {
    console.warn("Waveform decode failed:", e);
    return null;
  }
}

function drawWaveform(canvas, data) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!data || !data.peaks) return;

  const { peaks, durationMs } = data;
  // The waveform represents durationMs of real-world playback time.
  // Scale it so it aligns with the timeline (TIMELINE_DURATION ms = full width).
  const waveformWidthPx = (durationMs / TIMELINE_DURATION) * w;
  const barW = waveformWidthPx / peaks.length;

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (let i = 0; i < peaks.length; i++) {
    const barH = peaks[i] * h * 0.9;
    const x = i * barW;
    if (x > w) break; // don't draw beyond canvas
    const y = (h - barH) / 2;
    ctx.fillRect(x, y, Math.max(1, barW - 0.5), barH);
  }
}

/** Track pixel width — wider than viewport to allow scroll */
/** Track width — set dynamically to fit the viewport on open */
let TRACK_PX_WIDTH = 2400;

function openTimeline() {
  if (timelineOverlay) return;

  const el = document.createElement("div");
  el.id = "fanfare-timeline";
  el.innerHTML = `
    <style>
      #fanfare-timeline {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: 640px; background: rgba(0,0,0,0.94);
        z-index: 10000; font-family: monospace; color: #ccc;
        user-select: none; border-top: 1px solid #333;
        display: flex; flex-direction: column;
      }
      #fanfare-timeline .tl-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 12px; font-size: 11px; background: #111;
        flex-shrink: 0;
      }
      #fanfare-timeline .tl-header button {
        background: #333; color: #fff; border: none; padding: 4px 12px;
        cursor: pointer; font-size: 11px; font-family: monospace; margin-left: 6px;
        border-radius: 2px;
      }
      #fanfare-timeline .tl-header button:hover { background: #555; }
      #fanfare-timeline .tl-scroll {
        flex: 1; overflow: hidden;
        padding: 8px 12px 12px;
      }
      #fanfare-timeline .tl-track {
        position: relative; height: 100%; width: 100%;
        background: #1a1a1a; border: 1px solid #333;
      }
      #fanfare-timeline .tl-waveform {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
      }
      #fanfare-timeline .tl-tick {
        position: absolute; top: 0; bottom: 0; width: 1px; background: #333;
      }
      #fanfare-timeline .tl-tick-label {
        position: absolute; top: 2px; font-size: 9px; color: #555;
        transform: translateX(-50%);
      }
      #fanfare-timeline .tl-cue {
        position: absolute;
      }
      #fanfare-timeline .tl-cue.selected .tl-cue-marker {
        outline: 2px solid #fff; outline-offset: 1px;
      }
      #fanfare-timeline .tl-cue-marker {
        width: 7px; background: currentColor; position: absolute; top: 0;
        border-radius: 1px; cursor: ew-resize; left: -2px;
      }
      #fanfare-timeline .tl-cue-flash {
        position: absolute; top: 0; opacity: 0.15; background: currentColor;
      }
      #fanfare-timeline .tl-cue-flash-handle {
        position: absolute; top: 0; right: -2px; width: 5px; height: 100%;
        cursor: col-resize; background: currentColor; opacity: 0.5;
        border-radius: 0 2px 2px 0;
      }
      #fanfare-timeline .tl-cue-flash-handle:hover { opacity: 0.8; }
      #fanfare-timeline .tl-cue-label {
        position: absolute; font-size: 9px; white-space: nowrap;
        text-shadow: 0 0 3px #000;
      }
      #fanfare-timeline .tl-cue-time {
        position: absolute; font-size: 8px; color: #888; white-space: nowrap;
      }
      #fanfare-timeline .tl-playhead {
        position: absolute; top: 0; bottom: 0; width: 2px;
        background: #ff0; z-index: 10; pointer-events: none;
        display: none;
      }
    </style>
    <div class="tl-header">
      <span>Click cue to select | drag to move | right-click flash | dbl-click to seek</span>
      <div>
        <button id="tl-dup" disabled>+ Dup</button>
        <button id="tl-del" disabled>- Del</button>
        <button id="tl-audio">Audio Only</button>
        <button id="tl-play">Play</button>
        <button id="tl-copy">Copy</button>
        <button id="tl-reset">Reset</button>
        <button id="tl-close">Close</button>
      </div>
    </div>
    <div class="tl-scroll" id="tl-scroll">
      <div class="tl-track" id="tl-track">
        <canvas class="tl-waveform" id="tl-waveform"></canvas>
        <div class="tl-playhead" id="tl-playhead"></div>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  timelineOverlay = el;

  const scrollContainer = el.querySelector("#tl-scroll");
  const track = el.querySelector("#tl-track");
  const waveformCanvas = el.querySelector("#tl-waveform");
  timelinePlayhead = el.querySelector("#tl-playhead");

  // Measure actual track width so everything fits the viewport
  TRACK_PX_WIDTH = track.clientWidth || window.innerWidth - 24;
  const trackH = track.clientHeight || 260;
  waveformCanvas.width = TRACK_PX_WIDTH;
  waveformCanvas.height = trackH;

  // Decode and draw waveform asynchronously
  decodeWaveform().then((data) => {
    if (data && waveformCanvas.isConnected) {
      drawWaveform(waveformCanvas, data);
    }
  });

  // Draw beat grid (112 BPM)
  const beatMs = 60000 / 112; // ~535.7ms per beat
  for (let beat = 0; beat * beatMs <= TIMELINE_DURATION; beat++) {
    const ms = beat * beatMs;
    const xPx = (ms / TIMELINE_DURATION) * TRACK_PX_WIDTH;
    const isBar = beat % 4 === 0;
    const tick = document.createElement("div");
    tick.className = "tl-tick";
    tick.style.left = xPx + "px";
    tick.style.background = isBar ? "#555" : "#2a2a2a";
    track.appendChild(tick);
    if (isBar) {
      const label = document.createElement("div");
      label.className = "tl-tick-label";
      label.style.left = xPx + "px";
      label.textContent = (ms / 1000).toFixed(1) + "s (beat " + beat + ")";
      track.appendChild(label);
    }
  }

  // --- Cue selection state ---
  let selectedKey = null;
  const dupBtn = el.querySelector("#tl-dup");
  const delBtn = el.querySelector("#tl-del");

  function selectCue(key) {
    selectedKey = key;
    track.querySelectorAll(".tl-cue").forEach((g) => g.classList.toggle("selected", g.dataset.key === key));
    dupBtn.disabled = !key;
    delBtn.disabled = !key;
  }

  // Helper to renumber cue keys after add/remove
  function renumberCues() {
    const sorted = Object.values(fanfareCues).sort((a, b) => a.time - b.time);
    // Clear all keys
    for (const k of Object.keys(fanfareCues)) delete fanfareCues[k];
    sorted.forEach((cue, i) => { fanfareCues[`cue${i + 1}`] = cue; });
  }

  // --- Render all cues (called on open and after add/remove) ---
  function renderCues() {
    // Remove existing cue elements
    track.querySelectorAll(".tl-cue").forEach((g) => g.remove());

    const wordRows = {};
    const uniqueWords = [...new Set(Object.values(fanfareCues).map(c => c.word))];
    uniqueWords.forEach((w, i) => { wordRows[w] = i; });
    const rowCount = uniqueWords.length;
    const rowH = Math.min((trackH - 20) / rowCount, 80);

    for (const [key, cue] of Object.entries(fanfareCues)) {
      const row = wordRows[cue.word];
      const color = WORD_COLORS[cue.word] || "#888";
      const xPx = (cue.time / TIMELINE_DURATION) * TRACK_PX_WIDTH;
      const topPx = 16 + row * rowH;

      const group = document.createElement("div");
      group.className = "tl-cue" + (key === selectedKey ? " selected" : "");
      group.style.left = xPx + "px";
      group.style.top = topPx + "px";
      group.style.color = color;
      group.dataset.key = key;

      const flash = document.createElement("div");
      flash.className = "tl-cue-flash";
      flash.style.height = (rowH - 2) + "px";
      flash.style.left = "0";

      const flashHandle = document.createElement("div");
      flashHandle.className = "tl-cue-flash-handle";
      flashHandle.style.height = (rowH - 2) + "px";
      flash.appendChild(flashHandle);

      const marker = document.createElement("div");
      marker.className = "tl-cue-marker";
      marker.style.height = (rowH - 2) + "px";

      const label = document.createElement("div");
      label.className = "tl-cue-label";
      label.style.top = "-1px";
      label.style.left = "8px";
      label.style.color = color;
      label.textContent = cue.word ? cue.word.replace(/\n/g, " / ") : "ALL";

      const timeLabel = document.createElement("div");
      timeLabel.className = "tl-cue-time";
      timeLabel.style.bottom = "-12px";
      timeLabel.style.left = "0";
      const updateTimeLabel = () => {
        timeLabel.textContent = (cue.time / 1000).toFixed(2) + "s / " + cue.flash + "ms";
      };
      updateTimeLabel();

      group.appendChild(flash);
      group.appendChild(marker);
      group.appendChild(label);
      group.appendChild(timeLabel);
      track.appendChild(group);

      const updateFlashWidth = () => {
        flash.style.width = (cue.flash / TIMELINE_DURATION * TRACK_PX_WIDTH) + "px";
      };
      updateFlashWidth();

      const updateGroupPos = () => {
        group.style.left = (cue.time / TIMELINE_DURATION * TRACK_PX_WIDTH) + "px";
      };

      let dragging = false;
      let resizing = false;

      flashHandle.addEventListener("mousedown", (e) => {
        resizing = true;
        e.preventDefault();
        e.stopPropagation();
      });
      marker.addEventListener("mousedown", (e) => {
        dragging = true;
        selectCue(key);
        e.preventDefault();
        e.stopPropagation();
      });
      // Click anywhere on the cue group to select it
      group.addEventListener("click", (e) => {
        selectCue(key);
        e.stopPropagation();
      });
      group.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        selectCue(key);
        const old = track.querySelector(".tl-inline-edit");
        if (old) old.remove();
        const input = document.createElement("input");
        input.className = "tl-inline-edit";
        input.type = "number";
        input.value = cue.flash;
        input.min = 50;
        input.step = 50;
        input.style.cssText = `
          position: absolute; top: ${topPx - 18}px;
          left: ${group.style.left};
          width: 60px; background: #222; color: #fff; border: 1px solid #666;
          font: 11px monospace; padding: 2px 4px; z-index: 20; outline: none;
        `;
        track.appendChild(input);
        input.focus();
        input.select();
        const commit = () => {
          const v = parseInt(input.value);
          if (!isNaN(v) && v >= 50) {
            cue.flash = v;
            updateFlashWidth();
            updateTimeLabel();

          }
          input.remove();
        };
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") commit();
          if (ev.key === "Escape") input.remove();
        });
        input.addEventListener("blur", commit);
      });
      window.addEventListener("mousemove", (e) => {
        if (resizing) {
          const groupLeft = group.getBoundingClientRect().left;
          const dx = e.clientX - groupLeft;
          const newFlash = Math.max(50, Math.round((dx / TRACK_PX_WIDTH) * TIMELINE_DURATION / 50) * 50);
          cue.flash = newFlash;
          updateFlashWidth();
          updateTimeLabel();
        } else if (dragging) {
          const rect = track.getBoundingClientRect();
          const x = Math.max(0, Math.min(e.clientX - rect.left, TRACK_PX_WIDTH));
          const newTime = Math.round((x / TRACK_PX_WIDTH) * TIMELINE_DURATION);
          cue.time = newTime;
          updateGroupPos();
          updateTimeLabel();
        }
      });
      window.addEventListener("mouseup", () => {
        if (dragging || resizing) {
          dragging = false;
          resizing = false;
        }
      });
    }
  }
  renderCues();

  // Duplicate selected cue
  dupBtn.addEventListener("click", () => {
    if (!selectedKey || !fanfareCues[selectedKey]) return;
    const src = fanfareCues[selectedKey];
    const newCue = { time: src.time + 500, word: src.word, line: src.line, flash: src.flash };
    // Add with a temp key, then renumber
    fanfareCues["cue_new"] = newCue;
    renumberCues();
    // Find the new key for the duplicated cue
    const newKey = Object.entries(fanfareCues).find(([, c]) => c === newCue)?.[0];
    selectedKey = newKey || null;
    renderCues();
  });

  // Delete selected cue
  delBtn.addEventListener("click", () => {
    if (!selectedKey || !fanfareCues[selectedKey]) return;
    delete fanfareCues[selectedKey];
    renumberCues();
    selectedKey = null;
    renderCues();
  });

  // Single-click: position playhead + show time (no playback)
  track.addEventListener("click", (e) => {
    if (e.target.closest(".tl-cue")) return; // don't interfere with cue interactions
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = Math.round((x / TRACK_PX_WIDTH) * TIMELINE_DURATION);
    // Show a brief tooltip with the time
    console.log(`Timeline: ${(ms / 1000).toFixed(2)}s (beat ${(ms / (60000 / 112)).toFixed(1)})`);
    // Move playhead to clicked position (static, no animation)
    if (timelineAnimId) cancelAnimationFrame(timelineAnimId);
    timelineAnimId = null;
    timelinePlayhead.style.display = "block";
    timelinePlayhead.style.left = x + "px";
  });

  // Double-click on track to seek and play from that position
  track.addEventListener("dblclick", (e) => {
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seekMs = Math.round((x / TRACK_PX_WIDTH) * TIMELINE_DURATION);
    console.log(`Timeline: seek to ${(seekMs / 1000).toFixed(2)}s`);
    // Stop audio-only if running
    if (audioOnlyEl) {
      audioOnlyEl.pause();
      audioOnlyEl.src = "";
      audioOnlyEl = null;
      el.querySelector("#tl-audio").textContent = "Audio Only";
    }
    if (window.playFanfareWithWords) {
      window.playFanfareWithWords({ startFromMs: seekMs });
      startTimelinePlayhead(seekMs);
    }
  });

  // Audio Only button — plays just the MP3 with playhead, no word cues
  let audioOnlyEl = null;
  el.querySelector("#tl-audio").addEventListener("click", async () => {
    const btn = el.querySelector("#tl-audio");
    if (audioOnlyEl) {
      // Stop audio-only playback
      audioOnlyEl.pause();
      audioOnlyEl.src = "";
      audioOnlyEl = null;
      timelineAudioRef = null;
      btn.textContent = "Audio Only";
      if (timelineAnimId) cancelAnimationFrame(timelineAnimId);
      timelinePlayhead.style.display = "none";
      return;
    }
    // Dispose any active fanfare first
    disposeFanfare();
    btn.textContent = "Stop Audio";
    const audio = new Audio("assets/audio/fanfare.mp3");
    audio.playbackRate = 1.0;
    audioOnlyEl = audio;
    timelineAudioRef = audio;
    audio.addEventListener("ended", () => {
      audioOnlyEl = null;
      timelineAudioRef = null;
      btn.textContent = "Audio Only";
      timelinePlayhead.style.display = "none";
    }, { once: true });
    // Start playhead tracking immediately (it will sync once audio starts)
    startTimelinePlayhead();
    await audio.play();
  });

  // Play button — plays with word cues
  let playBusy = false; // guard against double-clicks while async start runs
  el.querySelector("#tl-play").addEventListener("click", async () => {
    // Stop audio-only if running
    if (audioOnlyEl) {
      audioOnlyEl.pause();
      audioOnlyEl.src = "";
      audioOnlyEl = null;
      el.querySelector("#tl-audio").textContent = "Audio Only";
    }
    if (fanfarePlaying && timelinePaused) {
      resumeFanfare();
    } else if (fanfarePlaying) {
      pauseFanfare();
    } else if (window.playFanfareWithWords && !playBusy) {
      playBusy = true;
      startTimelinePlayhead();
      // Don't await — playFanfareWithWords runs for the full duration
      window.playFanfareWithWords().then(() => { playBusy = false; });
    }
  });

  // Copy button — copies current cue timings to clipboard
  el.querySelector("#tl-copy").addEventListener("click", () => {
    const lines = Object.entries(fanfareCues).map(([key, cue]) => {
      const w = cue.word === null ? "null" : `"${cue.word.replace(/\n/g, "\\n")}"`;
      return `  ${key}: { time: ${String(cue.time).padStart(5)}, word: ${w.padStart(12)}, line: ${cue.line}, flash: ${String(cue.flash).padStart(4)} },`;
    });
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      const btn = el.querySelector("#tl-copy");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = "Copy"; }, 1500);
    });
    console.log("Fanfare cues:\n" + text);
  });

  // Reset button — reload to restore hardcoded defaults
  el.querySelector("#tl-reset").addEventListener("click", () => {
    location.reload();
  });

  // Close button
  el.querySelector("#tl-close").addEventListener("click", closeTimeline);
}

function startTimelinePlayhead(offsetMs = 0) {
  if (!timelinePlayhead) return;
  timelinePlayhead.style.display = "block";
  timelineStartTime = performance.now() - offsetMs;
  if (timelineAnimId) cancelAnimationFrame(timelineAnimId);

  // Auto-scroll the container to keep the playhead in view
  const scrollContainer = timelineOverlay ? timelineOverlay.querySelector("#tl-scroll") : null;

  function tick() {
    // Prefer syncing to actual audio.currentTime when available
    let elapsed;
    const audioEl = timelineAudioRef
      || (fanfareSynthHandle && fanfareSynthHandle.audio)
      || null;
    if (audioEl && !audioEl.paused && audioEl.currentTime > 0) {
      // audio.currentTime is in seconds at native playback speed
      elapsed = audioEl.currentTime * 1000;
      // Keep timelineStartTime in sync so pause/resume works
      timelineStartTime = performance.now() - elapsed;
    } else {
      elapsed = performance.now() - timelineStartTime;
    }

    const xPx = Math.min((elapsed / TIMELINE_DURATION) * TRACK_PX_WIDTH, TRACK_PX_WIDTH);
    timelinePlayhead.style.left = xPx + "px";

    // Keep playhead visible by scrolling the container
    if (scrollContainer) {
      const viewLeft = scrollContainer.scrollLeft;
      const viewRight = viewLeft + scrollContainer.clientWidth;
      if (xPx > viewRight - 60) {
        scrollContainer.scrollLeft = xPx - scrollContainer.clientWidth * 0.3;
      }
    }

    if (elapsed < TIMELINE_DURATION) {
      timelineAnimId = requestAnimationFrame(tick);
    } else {
      timelinePlayhead.style.display = "none";
    }
  }
  timelineAnimId = requestAnimationFrame(tick);
}

function closeTimeline() {
  if (timelineAnimId) cancelAnimationFrame(timelineAnimId);
  if (timelineOverlay) {
    timelineOverlay.remove();
    timelineOverlay = null;
    timelinePlayhead = null;
  }
}

/** Saved rotation / text state for restore after trailer */
let savedGridRotationSpeed = null;
let savedTextRotationEnabled = null;
let savedTextRotationBPM = null;
let savedTextScrambleEnabled = null;
let savedTextContents = null;
let savedTextStartSectors = null;
let savedImageCellsEnabled = null;
let savedGridLinesEnabled = null;
let savedPulsesEnabled = null;
let savedPulseSize = null;
let savedPulseSpeed = null;

// ---------------------------------------------------------------------------
// Cinematic fanfare — bombastic intro sound (20th Century Fox style)
// Built entirely with Tone.js: sub-bass, brass chords, timpani, crescendo
// ---------------------------------------------------------------------------

let fanfareSynthHandle = null; // handle returned by playFanfareSynth
let fanfarePlaying = false; // true while fanfare word sequence is active

function disposeFanfare() {
  fanfarePlaying = false;
  timelinePaused = false;
  timelineAudioRef = null;
  if (fanfareSynthHandle) {
    try { fanfareSynthHandle.stop(); } catch (_) {}
    fanfareSynthHandle = null;
  }
}

/**
 * Smoothly fade fanfare audio to silence over `duration` seconds, then dispose.
 */
function fadeFanfareOut(duration = 3) {
  if (!fanfareSynthHandle || fanfareSynthHandle.disposed) {
    disposeFanfare();
    return Promise.resolve();
  }
  return fanfareSynthHandle.fadeOut(duration).then(() => {
    fanfareSynthHandle = null;
    fanfarePlaying = false;
  });
}

function pauseFanfare() {
  if (!fanfarePlaying || timelinePaused) return;
  timelinePaused = true;
  // Pause audio and read its actual position
  if (fanfareSynthHandle && fanfareSynthHandle.audio && !fanfareSynthHandle.audio.paused) {
    timelinePausedElapsed = fanfareSynthHandle.audio.currentTime * 1000;
    fanfareSynthHandle.audio.pause();
  } else if (timelineStartTime !== null) {
    timelinePausedElapsed = performance.now() - timelineStartTime;
  }
  if (timelineAnimId) {
    cancelAnimationFrame(timelineAnimId);
    timelineAnimId = null;
  }
  updatePlayButton();
}

function resumeFanfare() {
  if (!timelinePaused) return;
  timelinePaused = false;
  // Resume audio
  if (fanfareSynthHandle && fanfareSynthHandle.audio && fanfareSynthHandle.audio.paused) {
    fanfareSynthHandle.audio.play().catch(() => {});
  }
  // Adjust start times based on paused position (from audio.currentTime)
  const now = performance.now();
  timelineStartTime = now - timelinePausedElapsed;
  fanfareStartTime = now - timelinePausedElapsed;
  startTimelinePlayhead(timelinePausedElapsed);
  updatePlayButton();
}

function updatePlayButton() {
  if (!timelineOverlay) return;
  const btn = timelineOverlay.querySelector("#tl-play");
  if (!btn) return;
  if (fanfarePlaying && timelinePaused) {
    btn.textContent = "Resume";
  } else if (fanfarePlaying) {
    btn.textContent = "Pause";
  } else {
    btn.textContent = "Play";
  }
}

/**
 * Start the MIDI-synced fanfare via fanfare-synth.js module.
 * The module handles Web Audio processing, sub-bass, and MIDI-timed cues.
 */
async function startFanfareSynth({ startFromMs = 0 } = {}) {
  try {
    disposeFanfare();

    // Ensure Tone.js is loaded (fanfare-synth.js needs it)
    let T = window.Tone;
    if (!T) {
      await initAudio();
      T = window.Tone;
    }

    fanfareSynthHandle = await playFanfareSynth({ startFromMs });
    window._fanfareHandle = fanfareSynthHandle;
    console.log("Chair spirits: fanfare synth started");

    // Audio init may reset screen uniforms — force dark until first cue
    const sm = getScreenMaterial();
    if (sm && sm.uniforms) {
      if (sm.uniforms.uGridFade) sm.uniforms.uGridFade.value = 0;
      if (sm.uniforms.uBrightness) sm.uniforms.uBrightness.value = 0;
    }
  } catch (e) {
    console.warn("Chair spirits: fanfare synth failed", e);
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

function createSpirit(targetPos, spawnPos, precomputedWaypoints) {
  ensureSpiritInstancedMesh();

  // Prevent overflow past pre-allocated buffer
  if (spiritInstancedMesh.count >= MAX_SPIRITS) return null;

  const hue = 0.12 + (Math.random() - 0.5) * 0.06;
  const color = new THREE.Color().setHSL(hue, 0.9, 0.75);

  // Assign an instance index
  const idx = spiritInstancedMesh.count;
  spiritInstancedMesh.count = idx + 1;

  // Set initial position (at spawn)
  _instanceMatrix.makeTranslation(spawnPos.x, spawnPos.y, spawnPos.z);
  spiritInstancedMesh.setMatrixAt(idx, _instanceMatrix);

  // Set per-instance color (starts dim — alpha handled via color brightness)
  _instanceColor.setRGB(color.r * 0.05, color.g * 0.05, color.b * 0.05);
  spiritInstancedMesh.setColorAt(idx, _instanceColor);

  const waypoints = precomputedWaypoints || computeSpiritPath(spawnPos, targetPos);
  const totalDist = pathLength(waypoints);
  const speed = SPIRIT_SPEED + (Math.random() - 0.5) * SPIRIT_SPEED_JITTER;

  const cumulativeDist = [0];
  for (let i = 1; i < waypoints.length; i++) {
    cumulativeDist.push(
      cumulativeDist[i - 1] + waypoints[i].distanceTo(waypoints[i - 1])
    );
  }

  return {
    instanceIdx: idx,
    baseColor: color.clone(),
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
    rampProgress: 0,
    swayPhaseX: Math.random() * Math.PI * 2,
    swayPhaseZ: Math.random() * Math.PI * 2,
    swayFreqX: 2 + Math.random() * 2,
    swayFreqZ: 2 + Math.random() * 2,
    swayAmpX: 0.08 + Math.random() * 0.08,
    swayAmpZ: 0.08 + Math.random() * 0.08,
    settleTime: 0, // timestamp when spirit settled (for arrival glow)
    light: null, // PointLight reference (only for select spirits)
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

/** Reusable vectors for update loop (avoids GC pressure) */
const _spiritBase = new THREE.Vector3();

function setSpiritInstance(spirit, x, y, z, brightness) {
  const idx = spirit.instanceIdx;
  _instanceMatrix.makeTranslation(x, y, z);
  spiritInstancedMesh.setMatrixAt(idx, _instanceMatrix);
  // Encode opacity/brightness via instance color intensity
  const c = spirit.baseColor;
  _instanceColor.setRGB(c.r * brightness, c.g * brightness, c.b * brightness);
  spiritInstancedMesh.setColorAt(idx, _instanceColor);
}

function updateSpiritJourney(spirit, dt) {
  if (spirit.removed) return;

  // Ramp up intensity from zero (avoids hard pop-in)
  if (spirit.rampProgress < 1) {
    spirit.rampProgress = Math.min(spirit.rampProgress + dt / RAMP_DURATION, 1);
  }
  const ramp = spirit.rampProgress * spirit.rampProgress; // ease-in quadratic

  // Fade-out mode
  if (spirit.fadingOut) {
    spirit.fadeProgress += dt / 1.5;
    const fade = 1 - Math.min(spirit.fadeProgress, 1);
    setSpiritInstance(spirit, spirit.targetPos.x, spirit.targetPos.y, spirit.targetPos.z, fade * 0.85);
    // Fade PointLight intensity in sync
    if (spirit.light) {
      spirit.light.intensity = SPIRIT_LIGHT_INTENSITY * fade;
    }
    if (spirit.fadeProgress >= 1) {
      spirit.removed = true;
      // Hide by scaling to zero
      _instanceMatrix.makeScale(0, 0, 0);
      spiritInstancedMesh.setMatrixAt(spirit.instanceIdx, _instanceMatrix);
      // Remove PointLight from scene
      if (spirit.light) {
        spiritsGroup.remove(spirit.light);
        spirit.light.dispose();
        spirit.light = null;
      }
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
    // Base 0.85 brightness — no arrival glow for regular spirits
    setSpiritInstance(spirit, t.x + driftX, t.y + bob, t.z + driftZ, 0.85);
    // PointLight: ramp intensity as spirit settles, pulse gently with music cues
    if (spirit.light) {
      const settleRamp = spirit.settleTime > 0
        ? Math.min((performance.now() - spirit.settleTime) / 1500, 1)
        : 1;
      // Gentler multiplier for PointLights (sqrt dampens the 1–10 range to 1–3.2)
      const lightFlash = Math.sqrt(spiritFlashMultiplier);
      spirit.light.intensity = SPIRIT_LIGHT_INTENSITY * settleRamp * lightFlash;
      spirit.light.position.set(t.x + driftX, t.y + bob, t.z + driftZ);
    }
    return;
  }

  // Journey along path
  spirit.distanceTravelled += spirit.speed * dt;
  const progress = Math.min(spirit.distanceTravelled / spirit.totalDist, 1);

  const pathPos = positionOnPath(spirit);

  // In the final 40%, blend off navmesh toward exact chair marker
  const DETACH_START = 0.6;
  if (progress > DETACH_START) {
    const blend = (progress - DETACH_START) / (1 - DETACH_START);
    const eased = blend * blend * (3 - 2 * blend); // smoothstep
    _spiritBase.lerpVectors(pathPos, spirit.targetPos, eased);
  } else {
    _spiritBase.copy(pathPos);
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

  const sx = _spiritBase.x + swayX;
  const sy = _spiritBase.y + floatHeight + bob;
  const sz = _spiritBase.z + swayZ;
  setSpiritInstance(spirit, sx, sy, sz, ramp * 0.9);
  // PointLight follows spirit during journey (intensity stays at 0)
  if (spirit.light) {
    spirit.light.position.set(sx, sy, sz);
  }

  if (progress >= 1) {
    spirit.settled = true;
    spirit.settleTime = performance.now();
    setSpiritInstance(spirit, spirit.targetPos.x, spirit.targetPos.y, spirit.targetPos.z, 0.85);
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

  spirits = [];
  // Reset instanced mesh
  if (spiritInstancedMesh) {
    spiritsGroup.remove(spiritInstancedMesh);
    spiritInstancedMesh.dispose();
    spiritInstancedMesh = null;
  }
  spawnIndex = 0;
  spawnTimer = 0;
  spawning = true;
  reversing = false;

  // Pre-compute all navmesh paths up front (avoids per-spawn navmesh queries)
  spawnQueue = chairPositions.map((pos, i) => {
    const spawnPos = i % 2 === 0 ? spawnLeft : spawnRight;
    return {
      targetPos: pos,
      spawnPos,
      waypoints: computeSpiritPath(spawnPos, pos),
    };
  });

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

  const waypoints = computeSpiritPath(spawnPos, target);
  const lateSpirit = createSpirit(target, spawnPos, waypoints);
  if (!lateSpirit) return; // at capacity
  // Override speed to be 3x faster — in a hurry!
  lateSpirit.speed = SPIRIT_SPEED * 3;
  // Shine extra bright — this one stands out
  lateSpirit.rampProgress = 1; // skip ramp-in, fully bright immediately
  const c = lateSpirit.baseColor;
  _instanceColor.setRGB(c.r, c.g, c.b);
  if (spiritInstancedMesh) spiritInstancedMesh.setColorAt(lateSpirit.instanceIdx, _instanceColor);

  spirits.push(lateSpirit);
  console.log("Chair spirits: late guest rushes in!");
}

export function updateSpirits(dt) {
  const clamped = Math.min(dt, 0.1);

  // Spawn sequencing
  if (spawning && spawnIndex < spawnQueue.length) {
    spawnTimer += clamped;
    const interval = 0.07 + Math.random() * 0.05;
    while (spawnTimer >= interval && spawnIndex < spawnQueue.length) {
      spawnTimer -= interval;
      const { targetPos, spawnPos, waypoints } = spawnQueue[spawnIndex];
      const spirit = createSpirit(targetPos, spawnPos, waypoints);
      if (!spirit) { spawning = false; break; }
      // Assign PointLight to evenly spaced spirits
      if (spiritLights.length < SPIRIT_LIGHT_COUNT) {
        const step = Math.floor(spawnQueue.length / SPIRIT_LIGHT_COUNT);
        if (step <= 1 || spawnIndex % step === 0) {
          const light = new THREE.PointLight(
            spirit.baseColor, 0, SPIRIT_LIGHT_DISTANCE, SPIRIT_LIGHT_DECAY
          );
          light.position.copy(spawnPos);
          spiritsGroup.add(light);
          spirit.light = light;
          spiritLights.push({ light, spiritIdx: spirits.length });
        }
      }
      spirits.push(spirit);
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

  // Flag instance buffers for GPU upload (once per frame, not per spirit)
  if (spiritInstancedMesh && spirits.length > 0) {
    spiritInstancedMesh.instanceMatrix.needsUpdate = true;
    if (spiritInstancedMesh.instanceColor) spiritInstancedMesh.instanceColor.needsUpdate = true;
  }

  if (spirits.length > 0 && spirits.every((s) => s.removed)) {
    spirits = [];
    reversing = false;
    // Clean up instanced mesh
    if (spiritInstancedMesh) {
      spiritsGroup.remove(spiritInstancedMesh);
      spiritInstancedMesh.dispose();
      spiritInstancedMesh = null;
    }
    // Clean up any remaining PointLights
    for (const sl of spiritLights) {
      spiritsGroup.remove(sl.light);
      sl.light.dispose();
    }
    spiritLights.length = 0;
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
  // Room lights only — screen fade is handled separately for sequenced timing
  const directT = Math.min(t / 0.4, 1);
  const ambientT = Math.min(Math.max((t - 0.1) / 0.4, 0), 1);
  const glbT = Math.min(Math.max((t - 0.2) / 0.4, 0), 1);
  const exposureT = Math.min(Math.max((t - 0.5) / 0.5, 0), 1);

  setDirectIntensity(savedDirect * (1 - directT));
  setAmbientIntensity(savedAmbient * (1 - ambientT));

  glbLights.forEach((light, i) => {
    if (i < savedGlbIntensities.length) {
      light.intensity = savedGlbIntensities[i] * (1 - glbT);
    }
  });

  // Dim renderer exposure for deeper overall darkness
  if (savedExposure !== null) {
    renderer.toneMappingExposure = savedExposure * (1 - exposureT * 0.8);
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
  // Skip if screenFading is active — applyScreenFade handles these uniforms
  if (!screenFading) {
    const screenMat = getScreenMaterial();
    if (screenMat && screenMat.uniforms) {
      if (screenMat.uniforms.uGridFade) {
        screenMat.uniforms.uGridFade.value = screenT;
      }
      if (screenMat.uniforms.uBrightness) {
        const brightnessT = Math.min(t / 0.6, 1);
        screenMat.uniforms.uBrightness.value = brightnessT;
      }
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
    startFanfareSynth();
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

  if (screenMat.uniforms) {
    if (screenFadeIn) {
      // Fading IN (reverse/restore): grid fades in, brightness stays at 1.0
      if (screenMat.uniforms.uGridFade) {
        screenMat.uniforms.uGridFade.value = Math.min(1, t);
      }
      if (screenMat.uniforms.uBrightness) {
        screenMat.uniforms.uBrightness.value = 1.0;
      }
    } else {
      // Fading OUT (going dark before fanfare)
      if (screenMat.uniforms.uGridFade) {
        screenMat.uniforms.uGridFade.value = Math.max(0, level / 0.6);
      }
      if (screenMat.uniforms.uBrightness) {
        screenMat.uniforms.uBrightness.value = Math.min(1, level / 0.4);
      }
    }
  }
}

// (screenLightBurst removed — was dead code, never called)

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

let _lastReactiveUpdate = 0;
const REACTIVE_INTERVAL = 250; // ms between reactive light updates
const _reactiveHSL = {};
const _reactiveColor = new THREE.Color();

function updateReactiveLights() {
  if (!reactiveLightsActive || spirits.length === 0) return;

  const now = performance.now();
  if (now - _lastReactiveUpdate < REACTIVE_INTERVAL) return;
  _lastReactiveUpdate = now;

  const avgColor = sampleVideoColor();
  if (!avgColor) return;

  // Boost saturation slightly for more vivid effect
  avgColor.getHSL(_reactiveHSL);
  _reactiveColor.setHSL(_reactiveHSL.h, Math.min(_reactiveHSL.s * 1.4, 1), _reactiveHSL.l);

  for (const spirit of spirits) {
    if (spirit.removed) continue;
    spirit.baseColor.lerp(_reactiveColor, 0.15);
  }
  // Instance colors will be updated in the next updateSpiritJourney cycle
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
// ---------------------------------------------------------------------------
// Spirit light flash — pulse settled spirits in sync with fanfare cues
// ---------------------------------------------------------------------------
let spiritFlashGen = 0;
/** Brightness multiplier applied on top of base brightness in updateSpiritJourney */
let spiritFlashMultiplier = 1.0;

function flashSpiritLights(duration) {
  const gen = ++spiritFlashGen;
  const start = performance.now();
  const peakMultiplier = 10; // how much brighter spirits get at peak
  const peakAmbient = savedAmbient ? savedAmbient * 0.4 : 0.3; // ambient light pulse
  const peakExposureBoost = 0.3; // exposure boost on top of dimmed level
  const dimmedExposure = savedExposure ? savedExposure * 0.2 : 0.2;

  function tick() {
    if (gen !== spiritFlashGen) return;
    const t = Math.min((performance.now() - start) / duration, 1);
    let factor;
    if (t < 0.1) {
      factor = t / 0.1; // quick ramp up
    } else {
      factor = 1 - (t - 0.1) / 0.9;
      factor *= factor; // ease-out decay
    }
    spiritFlashMultiplier = 1.0 + (peakMultiplier - 1.0) * factor;
    // Pulse ambient light so spirits illuminate surroundings
    setAmbientIntensity(peakAmbient * factor);
    // Pulse exposure for extra bloom
    if (renderer) {
      renderer.toneMappingExposure = dimmedExposure + peakExposureBoost * factor;
    }
    if (t >= 1) {
      spiritFlashMultiplier = 1.0;
      setAmbientIntensity(0);
      if (renderer) renderer.toneMappingExposure = dimmedExposure;
    } else {
      requestAnimationFrame(tick);
    }
  }
  tick();
}

/** Pulse generation counter — only the latest pulse controls brightness */
let pulseGeneration = 0;

/** Number of radial sectors in the polar grid */
const NUM_SECTORS = 36;
/** The visual center sector (derived from original 13-char text at startSector 24 with flipX) */
const CENTER_SECTOR = 16.5;

/** Final composition layout — used by the ALL (null) cue */
const FINAL_LAYOUT = {
  1: "DOME DREAMING",
  2: "OPEN CALL",
  3: "FOR DREAMERS",
  4: "APPLY NOW",
  5: "",
};

function centerTextOnLine(lineIndex, text) {
  setTextContent(lineIndex, text);
  if (text.length > 0) {
    const sector = Math.round(CENTER_SECTOR + text.length / 2);
    setTextStartSector(lineIndex, sector % NUM_SECTORS);
  }
}

function flashWordOnDome(word, line = 3, flashDuration = 800) {
  // Pulse settled spirit lights in sync with the dome flash
  flashSpiritLights(flashDuration);

  const screenMat = getScreenMaterial();

  // Kill previous pulse and force screen dark BEFORE changing text,
  // so old text never shows through at the new cue's brightness ramp
  if (screenMat && screenMat.uniforms) {
    ++pulseGeneration;
    if (screenMat.uniforms.uBrightness) screenMat.uniforms.uBrightness.value = 0;
    if (screenMat.uniforms.uGridFade) screenMat.uniforms.uGridFade.value = 1;
  }

  if (word !== null) {
    // Solo mode: clear all lines, show word(s) centered
    // Words with \n are split across two consecutive lines
    const parts = word.split("\n");
    for (let i = 1; i <= 5; i++) {
      setTextContent(i, "");
    }
    if (parts.length === 1) {
      centerTextOnLine(line, word);
    } else {
      centerTextOnLine(line, parts[0]);
      centerTextOnLine(line + 1, parts[1]);
    }
  } else {
    // ALL mode: show all words together on their final lines
    for (let i = 1; i <= 5; i++) {
      centerTextOnLine(i, FINAL_LAYOUT[i] || "");
    }
  }

  // Brightness pump: 0 → peak → 0 (fully dark between flashes)
  // Delay start by one frame so the canvas texture has time to redraw with new text
  if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
    const gen = ++pulseGeneration;
    requestAnimationFrame(() => {
      if (gen !== pulseGeneration) return;
      const startTime = performance.now();
      function pulse() {
        if (gen !== pulseGeneration) return; // superseded by a newer pulse
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / flashDuration, 1);
        let brightness;
        if (t < 0.15) {
          brightness = (t / 0.15) * 1.2; // quick ramp to 1.2
        } else if (t < 0.4) {
          brightness = 1.2 - (t - 0.15) / 0.25 * 0.2; // settle to 1.0
        } else {
          brightness = 1.0 * (1 - (t - 0.4) / 0.6);
          brightness *= brightness; // ease-in for smooth fade to black
        }
        screenMat.uniforms.uBrightness.value = Math.max(0, brightness);
        if (t < 1) requestAnimationFrame(pulse);
        else screenMat.uniforms.uBrightness.value = 0;
      }
      pulse();
    });
  }
}

/**
 * Play the fanfare with words synced to MIDI-timed cues from fanfare-synth.js.
 * Words appear on different text lines for visual variety.
 * No scramble effect — clean text with brightness pumps.
 */
/** Incremented each time playFanfareWithWords starts — older runs check and bail */
let fanfareRunId = 0;
/** Module-level start time so pause/resume can adjust it */
let fanfareStartTime = 0;

export async function playFanfareWithWords({ startFromMs = 0 } = {}) {
  // Stop any existing fanfare (audio + abort previous word loop)
  disposeFanfare();
  const runId = ++fanfareRunId;
  fanfarePlaying = true;
  updatePlayButton();

  // Stop any ongoing animations that could overwrite our uniforms
  screenFading = false;
  restoring = false;
  dimming = false;

  // Clear all text lines, ensure screen starts fully dark
  for (let i = 1; i <= 5; i++) {
    setTextContent(i, "");
  }
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms) {
    if (screenMat.uniforms.uGridFade) screenMat.uniforms.uGridFade.value = 0;
    if (screenMat.uniforms.uBrightness) screenMat.uniforms.uBrightness.value = 0;
  }
  // Start the fanfare synth (MP3 + Web Audio processing + MIDI-timed cues)
  // startFanfareSynth re-asserts gridFade=0, brightness=0 at the end
  await startFanfareSynth({ startFromMs });
  fanfarePlaying = true;
  updatePlayButton();

  // Build word sequence from GUI-editable fanfareCues, sorted by time
  const wordSequence = Object.values(fanfareCues)
    .slice()
    .sort((a, b) => a.time - b.time);

  // Helper: get current playback position in ms, synced to audio.currentTime
  const audioEl = fanfareSynthHandle && fanfareSynthHandle.audio;
  function getElapsedMs() {
    if (audioEl && audioEl.currentTime > 0) {
      return audioEl.currentTime * 1000;
    }
    return performance.now() - fanfareStartTime;
  }

  fanfareStartTime = performance.now() - (audioEl ? audioEl.currentTime * 1000 : startFromMs);

  for (const entry of wordSequence) {
    // Abort if a newer run started
    if (runId !== fanfareRunId) return;

    // Skip cues before our start point
    if (entry.time < startFromMs) continue;

    // Wait until cue time, respecting pause
    let remaining = entry.time - getElapsedMs();
    while (remaining > 0) {
      if (runId !== fanfareRunId) return;
      if (timelinePaused) {
        // Spin-wait while paused (check every 100ms)
        await new Promise((r) => setTimeout(r, 100));
        remaining = entry.time - getElapsedMs();
        continue;
      }
      const sleepMs = Math.min(remaining, 50);
      await new Promise((r) => setTimeout(r, sleepMs));
      remaining = entry.time - getElapsedMs();
    }
    if (runId !== fanfareRunId) return;

    if (entry.word === null) {
      // Flash all accumulated words together
      const isFinalHit = entry === wordSequence[wordSequence.length - 1];
      console.log(`Chair spirits: ALL WORDS flash${isFinalHit ? " (FINAL)" : ""}`);
      const screenMat = getScreenMaterial();
      if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
        // Show all words on their final lines (cancel any previous fade-to-black)
        ++pulseGeneration;
        for (let i = 1; i <= 5; i++) {
          centerTextOnLine(i, FINAL_LAYOUT[i] || "");
        }
        flashSpiritLights(entry.flash);
        const gen2 = ++pulseGeneration;
        const t0 = performance.now();
        if (isFinalHit) {
          // Final hit: hard punch to 1.8 then fade to black like the others
          function finalPump() {
            if (gen2 !== pulseGeneration) return;
            const t = Math.min((performance.now() - t0) / entry.flash, 1);
            let brightness;
            if (t < 0.1) {
              brightness = (t / 0.1) * 1.8;
            } else if (t < 0.3) {
              brightness = 1.8 - (t - 0.1) / 0.2 * 0.8;
            } else {
              brightness = 1.0 * Math.pow(1 - (t - 0.3) / 0.7, 2);
            }
            screenMat.uniforms.uBrightness.value = Math.max(0, brightness);
            if (t < 1) requestAnimationFrame(finalPump);
            else screenMat.uniforms.uBrightness.value = 0;
          }
          finalPump();
        } else {
          // Intermediate "all" flash: punch hard then fade to black (like word cues)
          function holdPulse() {
            if (gen2 !== pulseGeneration) return;
            const t = Math.min((performance.now() - t0) / entry.flash, 1);
            let b;
            if (t < 0.1) b = (t / 0.1) * 1.5;
            else if (t < 0.3) b = 1.5 - (t - 0.1) / 0.2 * 0.5;
            else {
              b = 1.0 * Math.pow(1 - (t - 0.3) / 0.7, 2); // ease-out to 0
            }
            screenMat.uniforms.uBrightness.value = b;
            if (t < 1) requestAnimationFrame(holdPulse);
            else screenMat.uniforms.uBrightness.value = 0;
          }
          holdPulse();
        }
      }
    } else {
      console.log(`Chair spirits: "${entry.word}" (line ${entry.line})`);
      flashWordOnDome(entry.word, entry.line, entry.flash);
    }
  }

  // Hold the final combined display briefly, then hand off to announcement
  await new Promise((r) => setTimeout(r, 2000));
  fanfarePlaying = false;
  updatePlayButton();
  // Grid lines stay hidden — they'll be restored with the rest of the state
  // when reverseTrailer runs or the next scene loads.
  // Brightness stays at 1.0 — the announcement scramble-in happens seamlessly
}

export async function runTrailerSequence() {
  if (window._trailerRunning) return;
  window._trailerRunning = true;
  console.log("Chair spirits: trailer sequence started");

  // Safari requires audio to originate from a user gesture. Unlock an
  // AudioContext NOW (during gesture) so Tone.js can use it later when
  // the fanfare starts. Also pre-fetch the MP3 to avoid load delays.
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Pre-fetch the fanfare MP3 into browser cache
      await fetch("assets/audio/fanfare.mp3");
      // Ensure Tone.js is loaded and shares this unlocked context
      await initAudio();
      console.log("Chair spirits: AudioContext unlocked for Safari");
    } catch (e) {
      console.warn("Chair spirits: Safari audio pre-load failed:", e.message);
    }
  }

  // Enter dome mode (canvas sizing, overflow, button state) + start audio
  if (window.enterDomeModeWithAudio) {
    await window.enterDomeModeWithAudio();
  } else {
    setTrailerMode(true);
  }

  // Wait for chair positions to load (model may still be loading on slow connections)
  if (chairPositions.length === 0) {
    console.log("Chair spirits: waiting for chair markers to load...");
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (chairPositions.length > 0) {
          clearInterval(check);
          resolve();
        }
      }, 200);
    });
  }

  // 1. Spirits float in immediately
  startSpiritsSequence();

  // 3. Save current rotation, text, and image state for later restore
  savedGridRotationSpeed = textureRotationSettings.speed;
  savedTextRotationEnabled = polarGridSettings.textRotationEnabled;
  savedTextRotationBPM = polarGridSettings.textRotationBPM;
  savedTextScrambleEnabled = polarGridSettings.textScrambleEnabled;
  savedImageCellsEnabled = polarGridSettings.imageCellsEnabled;
  savedGridLinesEnabled = polarGridSettings.gridLinesEnabled;
  savedPulsesEnabled = polarGridSettings.pulsesEnabled;
  savedPulseSize = polarGridSettings.pulseSize;
  savedPulseSpeed = polarGridSettings.pulseSpeed;
  savedTextContents = {};
  savedTextStartSectors = {};
  for (let i = 1; i <= 5; i++) {
    savedTextContents[i] = polarGridSettings[`text${i}Content`];
    savedTextStartSectors[i] = polarGridSettings[`text${i}StartSector`];
  }

  // Make sure any previous fanfare is cleaned up
  disposeFanfare();

  // 4. Wait for ~40% spirits seated — then begin the cinematic buildup
  const earlyCount = Math.floor(chairPositions.length * 0.25);
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

  // 5. Fade out pulse audio AND visual pulse dots in background
  const pulseAudioFadeDuration = 5;
  const fadeSteps = 20;
  const stepTime = (pulseAudioFadeDuration * 1000) / fadeSteps;
  let step = 0;
  const origPulseSize = polarGridSettings.pulseSize;
  const origPulseSpeed = polarGridSettings.pulseSpeed;
  const audioFadePromise = new Promise((resolve) => {
    const fadeInterval = setInterval(() => {
      step++;
      const level = 1 - step / fadeSteps;
      setMasterVolume(Math.max(0, level * 0.5));
      // Fade visual pulse dots (size + speed) in sync with audio
      polarGridSettings.pulseSize = origPulseSize * level;
      polarGridSettings.pulseSpeed = origPulseSpeed * level;
      if (step >= fadeSteps) {
        clearInterval(fadeInterval);
        stopPulseAudio();
        polarGridSettings.pulseSize = 0;
        polarGridSettings.pulseSpeed = 0;
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

  // 7. Dim room lights — delayed 6s from cinematic buildup start, then 5s duration
  const dimDur = 5;
  await new Promise((r) => setTimeout(r, 6000));
  dimRoomLights(dimDur, { playFanfare: false });

  // Fire late guest during the dim — rushes in while lights are still going down
  setTimeout(() => spawnLateGuest(), (dimDur - 2) * 1000);

  // 8. Wait for lights to finish dimming
  await new Promise((resolve) => {
    const dimCheck = setInterval(() => {
      if (!dimming) {
        clearInterval(dimCheck);
        resolve();
      }
    }, 100);
  });

  // 9. THEN fade screen/grid out over 2s (sequenced after lights)

  const screenMat = getScreenMaterial();
  await new Promise((resolve) => {
    const fadeStart = performance.now();
    const fadeDur = 2000;
    function fadeScreen() {
      const t = Math.min((performance.now() - fadeStart) / fadeDur, 1);
      if (screenMat && screenMat.uniforms) {
        if (screenMat.uniforms.uGridFade) {
          screenMat.uniforms.uGridFade.value = 1.0 - t;
        }
        if (screenMat.uniforms.uBrightness) {
          screenMat.uniforms.uBrightness.value = 1.0 - t;
        }
      }
      if (t < 1) requestAnimationFrame(fadeScreen);
      else resolve();
    }
    fadeScreen();
  });

  // Screen is now fully dark — safe to regenerate texture without images
  // Await the async regeneration so the new material exists before we touch its uniforms
  await setImageCellsEnabled(false);
  // Regeneration creates a new ShaderMaterial with default uniforms (gridFade=1, brightness=1)
  // Force them to 0 so the screen stays dark until the first cue
  const postRegenMat = getScreenMaterial();
  if (postRegenMat && postRegenMat.uniforms) {
    if (postRegenMat.uniforms.uGridFade) postRegenMat.uniforms.uGridFade.value = 0;
    if (postRegenMat.uniforms.uBrightness) postRegenMat.uniforms.uBrightness.value = 0;
  }

  // 9. Start fanfare IMMEDIATELY — room is dark, music begins
  console.log("Chair spirits: starting fanfare word sequence");
  await playFanfareWithWords();

  console.log("Chair spirits: fanfare word sequence complete");

  // All words are now displayed together from the final ALL cue.
  // Hold the display, then reverse.
  await new Promise((r) => setTimeout(r, 2500));

  // Reverse everything
  await reverseTrailer(4);
}

/**
 * Dev shortcut: skip straight to the fanfare portion.
 * Instantly dims lights, darkens screen, and starts the fanfare word sequence.
 * Call via console: skipToFanfare()
 */
export async function skipToFanfare() {
  if (window._trailerRunning) {
    console.log("Trailer already running — disposing and restarting at fanfare");
    disposeFanfare();
  }
  window._trailerRunning = true;

  // Ensure Tone.js is loaded
  await initAudio();

  // Enter dome mode
  if (window.enterDomeModeWithAudio) {
    await window.enterDomeModeWithAudio();
  } else {
    setTrailerMode(true);
  }

  // Save state for restore
  savedGridRotationSpeed = textureRotationSettings.speed;
  savedTextRotationEnabled = polarGridSettings.textRotationEnabled;
  savedTextRotationBPM = polarGridSettings.textRotationBPM;
  savedTextScrambleEnabled = polarGridSettings.textScrambleEnabled;
  savedImageCellsEnabled = polarGridSettings.imageCellsEnabled;
  savedGridLinesEnabled = polarGridSettings.gridLinesEnabled;
  savedPulsesEnabled = polarGridSettings.pulsesEnabled;
  savedPulseSize = polarGridSettings.pulseSize;
  savedPulseSpeed = polarGridSettings.pulseSpeed;
  savedTextContents = {};
  savedTextStartSectors = {};
  for (let i = 1; i <= 5; i++) {
    savedTextContents[i] = polarGridSettings[`text${i}Content`];
    savedTextStartSectors[i] = polarGridSettings[`text${i}StartSector`];
  }

  // Instantly set everything to "dimmed" state
  stopPulseAudio();
  setMasterVolume(0);
  textureRotationSettings.speed = 0;
  setTextRotationEnabled(false);
  polarGridSettings.pulseSize = 0;
  polarGridSettings.pulseSpeed = 0;
  setImageCellsEnabled(false);

  // Dim room lights instantly
  saveCurrentLightValues();
  setAmbientIntensity(lightingSettings.ambientIntensity * 0.1);
  setDirectIntensity(lightingSettings.directIntensity * 0.1);

  // Darken screen
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms) {
    if (screenMat.uniforms.uGridFade) screenMat.uniforms.uGridFade.value = 0;
    if (screenMat.uniforms.uBrightness) screenMat.uniforms.uBrightness.value = 0;
  }

  // Start fanfare immediately
  console.log("skipToFanfare: starting fanfare word sequence");
  await playFanfareWithWords();
  console.log("skipToFanfare: fanfare complete");

  await new Promise((r) => setTimeout(r, 2500));
  await reverseTrailer(4);
}

// Expose on window + hotkeys (F = skip to fanfare, T = toggle timeline)
window.skipToFanfare = skipToFanfare;
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "f" || e.key === "F") {
    skipToFanfare();
  } else if (e.key === "t" || e.key === "T") {
    toggleTimeline();
  }
});

export async function reverseTrailer(duration = 3) {
  console.log("Chair spirits: reversing trailer");

  // Fade fanfare music out over the reverse duration (runs in background)
  fadeFanfareOut(duration);

  // Restore start sectors and scramble text back to original content
  if (savedTextStartSectors) {
    for (let i = 1; i <= 5; i++) {
      setTextStartSector(i, savedTextStartSectors[i]);
    }
  }
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

  // Restore images and grid lines in the grid texture
  if (savedGridLinesEnabled !== null) {
    setGridLinesEnabled(savedGridLinesEnabled);
  }
  if (savedImageCellsEnabled !== null) {
    setImageCellsEnabled(savedImageCellsEnabled);
  }

  // Gradually restore pulse dots (size + speed ease-in to match room restore)
  if (savedPulsesEnabled !== null) setPulsesEnabled(savedPulsesEnabled);
  const pulseRestoreStart = performance.now();
  const pulseRestoreDur = duration * 1000;
  const tgtPulseSize = savedPulseSize ?? 0;
  const tgtPulseSpeed = savedPulseSpeed ?? 0;
  function restorePulse() {
    const t = Math.min((performance.now() - pulseRestoreStart) / pulseRestoreDur, 1);
    const eased = t * t; // ease-in quadratic — gentle start
    polarGridSettings.pulseSize = tgtPulseSize * eased;
    polarGridSettings.pulseSpeed = tgtPulseSpeed * eased;
    if (t < 1) requestAnimationFrame(restorePulse);
  }
  restorePulse();

  // Restart pulse audio (was stopped during trailer) and restore master volume
  setMasterVolume(0.5);
  if (window.startAudio) {
    try { await window.startAudio(); } catch (e) { /* ignore */ }
  }

  // Exit dome mode (fades text back in via CSS transition, restores layout)
  window._trailerRunning = false;
  if (window.exitDomeMode) {
    window.exitDomeMode();
  } else {
    setTrailerMode(false);
  }
}
