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
  setTextStartSector,
  setTextRotationEnabled,
  setTextRotationBPM,
  setTextScrambleEnabled,
  setImageCellsEnabled,
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
export const fanfareCues = {
  cue1:  { time:   210, word: "DOME",      line: 3, flash:  400 },
  cue2:  { time:   560, word: "DOME",      line: 3, flash:  800 },
  cue3:  { time:  1435, word: "DREAMING",  line: 3, flash:  250 },
  cue4:  { time:  1799, word: "DREAMING",  line: 3, flash:  800 },
  cue5:  { time:  3720, word: "OPEN CALL", line: 3, flash:  250 },
  cue6:  { time:  4061, word: "OPEN CALL", line: 3, flash: 1000 },
  cue7:  { time:  5119, word: "LIVE NOW",  line: 3, flash:  500 },
  cue8:  { time:  5629, word: "LIVE NOW",  line: 3, flash:  800 },
  cue9:  { time:  6320, word: "LIVE NOW",  line: 3, flash: 1500 },
  cue10: { time:  9550, word: "LIVE NOW",  line: 3, flash:  650 },
  cue11: { time: 10780, word: "LIVE NOW",  line: 3, flash:  700 },
  cue12: { time: 12340, word: "APPLY",     line: 3, flash:  500 },
  cue13: { time: 13150, word: "APPLY",     line: 3, flash:  900 },
  cue14: { time: 14820, word: "APPLY",     line: 3, flash:  450 },
  cue15: { time: 15470, word: "APPLY",     line: 3, flash:  850 },
  cue16: { time: 18200, word: null,        line: 0, flash: 2750 },
  cue17: { time: 21760, word: null,        line: 0, flash: 3000 },
};

// ---------------------------------------------------------------------------
// Timeline visualisation overlay
// ---------------------------------------------------------------------------

const TIMELINE_DURATION = 24000; // ms — total timeline length for display
const WORD_COLORS = {
  "DOME": "#FF6B6B",
  "DREAMING": "#4ECDC4",
  "OPEN CALL": "#FFE66D",
  "LIVE NOW": "#A8E6CF",
  "APPLY": "#DDA0DD",
  null: "#FFFFFF",
};

let timelineOverlay = null;
let timelinePlayhead = null;
let timelineAnimId = null;
let timelineStartTime = null;
/** Pause state for timeline playback */
let timelinePaused = false;
let timelinePausedElapsed = 0;

function saveCuesToStorage() {
  try {
    const data = {};
    for (const [key, cue] of Object.entries(fanfareCues)) {
      data[key] = { time: cue.time, flash: cue.flash, line: cue.line };
    }
    localStorage.setItem("fanfareCues", JSON.stringify(data));
    localStorage.setItem("fanfareCuesVersion", String(CUES_VERSION));
  } catch (e) {}
}

/** Bump this when hardcoded cue defaults change to invalidate stale localStorage */
const CUES_VERSION = 2;

function loadCuesFromStorage() {
  try {
    const ver = localStorage.getItem("fanfareCuesVersion");
    if (ver !== String(CUES_VERSION)) {
      // Stale or missing — clear old data and use hardcoded defaults
      localStorage.removeItem("fanfareCues");
      localStorage.setItem("fanfareCuesVersion", String(CUES_VERSION));
      return;
    }
    const raw = localStorage.getItem("fanfareCues");
    if (!raw) return;
    const data = JSON.parse(raw);
    for (const [key, saved] of Object.entries(data)) {
      if (fanfareCues[key]) {
        if (saved.time !== undefined) fanfareCues[key].time = saved.time;
        if (saved.flash !== undefined) fanfareCues[key].flash = saved.flash;
        if (saved.line !== undefined) fanfareCues[key].line = saved.line;
      }
    }
    console.log("Loaded fanfare cues from localStorage");
  } catch (e) {}
}

// Load saved cues on module init
loadCuesFromStorage();

export function toggleTimeline() {
  if (timelineOverlay) {
    closeTimeline();
  } else {
    openTimeline();
  }
}

/** Waveform data cache */
let waveformData = null; // { peaks: Float32Array, durationMs: number }
const WAVEFORM_PEAKS_COUNT = 2000;
/** Playback rate used for the fanfare (2 semitones down) */
const FANFARE_PLAYBACK_RATE = Math.pow(2, -2 / 12); // ~0.891

async function decodeWaveform() {
  if (waveformData) return waveformData;
  try {
    const resp = await fetch("assets/audio/fanfare_002.mp3");
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
const TRACK_PX_WIDTH = 2400;

function openTimeline() {
  if (timelineOverlay) return;

  const el = document.createElement("div");
  el.id = "fanfare-timeline";
  el.innerHTML = `
    <style>
      #fanfare-timeline {
        position: fixed; bottom: 0; left: 0; right: 0;
        height: 320px; background: rgba(0,0,0,0.94);
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
        flex: 1; overflow-x: auto; overflow-y: hidden;
        padding: 8px 12px 12px;
      }
      #fanfare-timeline .tl-track {
        position: relative; height: 100%;
        width: ${TRACK_PX_WIDTH}px;
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
      <span>Fanfare Cue Timeline — drag markers | right-click flash | double-click to seek</span>
      <div>
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

  // Size the waveform canvas to match the track
  const trackH = track.clientHeight || 260;
  waveformCanvas.width = TRACK_PX_WIDTH;
  waveformCanvas.height = trackH;

  // Decode and draw waveform asynchronously
  decodeWaveform().then((data) => {
    if (data && waveformCanvas.isConnected) {
      drawWaveform(waveformCanvas, data);
    }
  });

  // Draw second ticks
  for (let s = 0; s <= TIMELINE_DURATION / 1000; s++) {
    const xPx = (s * 1000 / TIMELINE_DURATION) * TRACK_PX_WIDTH;
    const tick = document.createElement("div");
    tick.className = "tl-tick";
    tick.style.left = xPx + "px";
    track.appendChild(tick);
    const label = document.createElement("div");
    label.className = "tl-tick-label";
    label.style.left = xPx + "px";
    label.textContent = s + "s";
    track.appendChild(label);
  }

  // Assign row positions per unique word (for vertical stacking)
  const wordRows = {};
  const uniqueWords = [...new Set(Object.values(fanfareCues).map(c => c.word))];
  uniqueWords.forEach((w, i) => { wordRows[w] = i; });
  const rowCount = uniqueWords.length;
  const rowH = Math.min((trackH - 20) / rowCount, 45); // cap row height

  // Draw cues
  for (const [key, cue] of Object.entries(fanfareCues)) {
    const row = wordRows[cue.word];
    const color = WORD_COLORS[cue.word] || "#888";
    const xPx = (cue.time / TIMELINE_DURATION) * TRACK_PX_WIDTH;
    const topPx = 16 + row * rowH;

    const group = document.createElement("div");
    group.className = "tl-cue";
    group.style.left = xPx + "px";
    group.style.top = topPx + "px";
    group.style.color = color;
    group.dataset.key = key;

    // Flash duration bar
    const flash = document.createElement("div");
    flash.className = "tl-cue-flash";
    flash.style.height = (rowH - 2) + "px";
    flash.style.left = "0";

    // Resize handle on right edge of flash bar
    const flashHandle = document.createElement("div");
    flashHandle.className = "tl-cue-flash-handle";
    flashHandle.style.height = (rowH - 2) + "px";
    flash.appendChild(flashHandle);

    // Marker line
    const marker = document.createElement("div");
    marker.className = "tl-cue-marker";
    marker.style.height = (rowH - 2) + "px";

    // Label
    const label = document.createElement("div");
    label.className = "tl-cue-label";
    label.style.top = "-1px";
    label.style.left = "8px";
    label.style.color = color;
    label.textContent = cue.word || "ALL";

    // Time + flash info
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

    // Recalc flash width in px (fixed-width track, no % needed)
    const updateFlashWidth = () => {
      flash.style.width = (cue.flash / TIMELINE_DURATION * TRACK_PX_WIDTH) + "px";
    };
    updateFlashWidth();

    // Update group position from cue time
    const updateGroupPos = () => {
      group.style.left = (cue.time / TIMELINE_DURATION * TRACK_PX_WIDTH) + "px";
    };

    // Drag marker to reposition cue time
    let dragging = false;
    // Drag flash handle to resize flash duration
    let resizing = false;

    flashHandle.addEventListener("mousedown", (e) => {
      resizing = true;
      e.preventDefault();
      e.stopPropagation();
    });
    marker.addEventListener("mousedown", (e) => {
      dragging = true;
      e.preventDefault();
      e.stopPropagation();
    });
    group.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      // Remove any existing inline editor
      const old = track.querySelector(".tl-inline-edit");
      if (old) old.remove();
      // Create inline input at the cue position
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
          saveCuesToStorage();
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
        saveCuesToStorage();
      }
    });
  }

  // Double-click on track to seek and play from that position
  track.addEventListener("dblclick", (e) => {
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seekMs = Math.round((x / TRACK_PX_WIDTH) * TIMELINE_DURATION);
    console.log(`Timeline: seek to ${(seekMs / 1000).toFixed(2)}s`);
    if (window.playFanfareWithWords) {
      window.playFanfareWithWords({ startFromMs: seekMs });
      startTimelinePlayhead(seekMs);
    }
  });

  // Play button
  el.querySelector("#tl-play").addEventListener("click", () => {
    if (fanfarePlaying && timelinePaused) {
      resumeFanfare();
    } else if (fanfarePlaying) {
      pauseFanfare();
    } else if (window.playFanfareWithWords) {
      window.playFanfareWithWords();
      startTimelinePlayhead();
    }
  });

  // Copy button — copies current cue timings to clipboard
  el.querySelector("#tl-copy").addEventListener("click", () => {
    const lines = Object.entries(fanfareCues).map(([key, cue]) => {
      const w = cue.word === null ? "null" : `"${cue.word}"`;
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

  // Reset button — restore hardcoded defaults
  el.querySelector("#tl-reset").addEventListener("click", () => {
    localStorage.removeItem("fanfareCues");
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
    const elapsed = performance.now() - timelineStartTime;
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
let savedPulsesEnabled = null;
let savedPulseSize = null;
let savedPulseSpeed = null;

// ---------------------------------------------------------------------------
// Cinematic fanfare — bombastic intro sound (20th Century Fox style)
// Built entirely with Tone.js: sub-bass, brass chords, timpani, crescendo
// ---------------------------------------------------------------------------

let fanfareAudio = null; // HTMLAudioElement for fanfare
let fanfareNodes = []; // Tone nodes for any effects
let fanfarePlaying = false; // true while fanfare word sequence is active

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
  fanfarePlaying = false;
  timelinePaused = false;
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

function pauseFanfare() {
  if (!fanfarePlaying || timelinePaused) return;
  timelinePaused = true;
  // Pause the audio
  if (fanfareAudio && !fanfareAudio.paused) fanfareAudio.pause();
  // Freeze the playhead
  if (timelineStartTime !== null) {
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
  if (fanfareAudio && fanfareAudio.paused) fanfareAudio.play().catch(() => {});
  // Adjust both timeline and word-loop start times so they resume from the paused position
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

/** Raw Web Audio gain node for fanfare volume control */
let fanfareGain = null;

/**
 * Play the 20th Century Fox fanfare MP3.
 * Routes through raw Web Audio API for reverb + modulation (avoids Tone.js MediaElement issues).
 * Adds a sub-bass synth layer via Tone.js for extra weight.
 * Audio is modulated (slight pitch shift, EQ coloring) so it's not identical to the original.
 */
async function playCinematicFanfare(duration, { startOffset = 0 } = {}) {
  try {
    disposeFanfare();

    const audio = new Audio("assets/audio/fanfare_002.mp3");
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    // Slight pitch shift — 2 semitones down for a deeper, more cinematic feel
    audio.playbackRate = Math.pow(2, -2 / 12); // ~0.891
    fanfareAudio = audio;

    // Wait for audio to be ready before seeking
    if (startOffset > 0) {
      await new Promise((resolve) => {
        const doSeek = () => {
          audio.currentTime = startOffset * audio.playbackRate;
          resolve();
        };
        if (audio.readyState >= 1) doSeek();
        else audio.addEventListener("loadedmetadata", doSeek, { once: true });
      });
    }

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
/** Pulse generation counter — only the latest pulse controls brightness */
let pulseGeneration = 0;

/** Number of radial sectors in the polar grid */
const NUM_SECTORS = 36;
/** The visual center sector (derived from original 13-char text at startSector 24 with flipX) */
const CENTER_SECTOR = 16.5;

/** Final composition layout — used by the ALL (null) cue */
const FINAL_LAYOUT = {
  1: "DOME",
  2: "DREAMING",
  3: "OPEN CALL",
  4: "LIVE NOW",
  5: "APPLY",
};

function centerTextOnLine(lineIndex, text) {
  setTextContent(lineIndex, text);
  if (text.length > 0) {
    const sector = Math.round(CENTER_SECTOR + text.length / 2);
    setTextStartSector(lineIndex, sector % NUM_SECTORS);
  }
}

function flashWordOnDome(word, line = 3, flashDuration = 800) {
  const screenMat = getScreenMaterial();

  if (word !== null) {
    // Solo mode: clear all lines, show only this word centered on its line
    for (let i = 1; i <= 5; i++) {
      if (i === line) {
        centerTextOnLine(i, word);
      } else {
        setTextContent(i, "");
      }
    }
  } else {
    // ALL mode: show all words together on their final lines
    for (let i = 1; i <= 5; i++) {
      centerTextOnLine(i, FINAL_LAYOUT[i] || "");
    }
  }

  // Brightness pump: 0 → peak → 0 (fully dark between flashes)
  // Cancel any previous pulse so they don't fight over uBrightness
  if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
    const gen = ++pulseGeneration;
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
  }
}

/**
 * Play the fanfare with words synced to its musical peaks.
 * The fanfare is pitched down 2 semitones (playbackRate ~0.891) so it's ~24s.
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

  // Clear all text lines, ensure grid lines are hidden
  for (let i = 1; i <= 5; i++) {
    setTextContent(i, "");
  }
  const screenMat = getScreenMaterial();
  if (screenMat && screenMat.uniforms) {
    if (screenMat.uniforms.uGridFade) screenMat.uniforms.uGridFade.value = 0;
    if (screenMat.uniforms.uBrightness) screenMat.uniforms.uBrightness.value = 0;
  }

  // Start the fanfare audio (with seek offset in seconds)
  await playCinematicFanfare(undefined, { startOffset: startFromMs / 1000 });

  // Build word sequence from GUI-editable fanfareCues, sorted by time
  const wordSequence = Object.values(fanfareCues)
    .slice()
    .sort((a, b) => a.time - b.time);

  fanfareStartTime = performance.now() - startFromMs;

  for (const entry of wordSequence) {
    // Abort if a newer run started
    if (runId !== fanfareRunId) return;

    // Skip cues before our start point
    if (entry.time < startFromMs) continue;

    // Wait until cue time, respecting pause
    let remaining = entry.time - (performance.now() - fanfareStartTime);
    while (remaining > 0) {
      if (runId !== fanfareRunId) return;
      if (timelinePaused) {
        // Spin-wait while paused (check every 100ms)
        await new Promise((r) => setTimeout(r, 100));
        // Recalculate remaining — fanfareStartTime is adjusted on resume
        remaining = entry.time - (performance.now() - fanfareStartTime);
        continue;
      }
      const sleepMs = Math.min(remaining, 50);
      await new Promise((r) => setTimeout(r, sleepMs));
      remaining = entry.time - (performance.now() - fanfareStartTime);
    }
    if (runId !== fanfareRunId) return;

    if (entry.word === null) {
      // Flash all accumulated words together
      const isFinalHit = entry === wordSequence[wordSequence.length - 1];
      console.log(`Chair spirits: ALL WORDS flash${isFinalHit ? " (FINAL)" : ""}`);
      const screenMat = getScreenMaterial();
      if (screenMat && screenMat.uniforms && screenMat.uniforms.uBrightness) {
        if (isFinalHit) {
          // Final hit: punch to 1.5 then hold at 1.0
          const pumpStart = performance.now();
          function finalPump() {
            const t = Math.min((performance.now() - pumpStart) / 600, 1);
            let brightness;
            if (t < 0.15) {
              brightness = (t / 0.15) * 1.5;
            } else {
              brightness = 1.5 - (t - 0.15) / 0.85 * 0.5;
            }
            screenMat.uniforms.uBrightness.value = Math.max(0, brightness);
            if (t < 1) requestAnimationFrame(finalPump);
            else screenMat.uniforms.uBrightness.value = 1.0;
          }
          finalPump();
        } else {
          // Intermediate flash: same pump as individual words
          flashWordOnDome(null, 0, entry.flash);
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
  // Brightness stays at 1.0 — the announcement scramble-in happens seamlessly
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

  // 3. Spirits float in
  startSpiritsSequence();

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

  // 7. Dim room lights — delayed 3s from cinematic buildup start, then 4s duration
  const dimDur = 4;
  await new Promise((r) => setTimeout(r, 3000));
  dimRoomLights(dimDur, { playFanfare: false });

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
  setImageCellsEnabled(false);

  // Fire late guest in background (arrives during the fanfare — doesn't block)
  setTimeout(() => spawnLateGuest(), 2000);

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

export async function reverseTrailer(duration = 3) {
  console.log("Chair spirits: reversing trailer");

  // Stop fanfare if still playing
  disposeFanfare();

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

  // Restore images in the grid texture
  if (savedImageCellsEnabled !== null) {
    setImageCellsEnabled(savedImageCellsEnabled);
  }

  // Restore pulse dots on the grid (size, speed, and enabled flag)
  if (savedPulseSize !== null) polarGridSettings.pulseSize = savedPulseSize;
  if (savedPulseSpeed !== null) polarGridSettings.pulseSpeed = savedPulseSpeed;
  if (savedPulsesEnabled !== null) setPulsesEnabled(savedPulsesEnabled);

  // Fade text back in
  setTrailerMode(false);
}
