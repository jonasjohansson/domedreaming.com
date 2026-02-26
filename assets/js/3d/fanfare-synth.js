/**
 * Fanfare Synth — BeepBox MP3 + MIDI-timed cues
 *
 * Plays the BeepBox-rendered fanfare as an MP3 at native speed (112 BPM).
 * Cues are fired from a requestAnimationFrame loop synced to audio.currentTime,
 * aligned to the BeepBox MIDI tick positions (96 tpq, 112 BPM).
 *
 * The MP3 runs through a Web Audio processing chain (chorus, EQ,
 * saturation, reverb) and a Tone.js sub-bass synth for richness.
 */

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

/** BeepBox MIDI tempo */
const MIDI_BPM = 112;
/** Playback rate — native speed */
const PLAYBACK_RATE = 1.0;
/** Ticks per beat in the BeepBox MIDI */
const TICKS_PER_BEAT = 96;
/** Ms per tick at native BPM */
const TICK_MS = 60000 / (MIDI_BPM * TICKS_PER_BEAT); // ~5.5804

/** Audio file path */
const FANFARE_MP3 = "assets/audio/beepbox-song.mp3";

// ---------------------------------------------------------------------------
// Cue map — MIDI tick positions aligned to words
// ---------------------------------------------------------------------------

export const MIDI_CUES = [
  // Drum intro — "DOME" / "DREAMING"
  { tick:  384,  word: "DOME",                    line: 1, flash:  250 },
  { tick:  455,  word: "DOME",                    line: 1, flash:  500 },
  { tick:  576,  word: "DREAMING",                line: 2, flash:  250 },
  { tick:  633,  word: "DREAMING",                line: 2, flash:  500 },
  // Build — "DOME DREAMING"
  { tick:  777,  word: "DOME DREAMING",           line: 1, flash:  760 },
  { tick:  962,  word: "DOME DREAMING",           line: 1, flash:  250 },
  { tick: 1009,  word: "DOME DREAMING",           line: 1, flash:  250 },
  // Chords enter — "OPEN CALL / FOR ARTISTS"
  { tick: 1152,  word: "OPEN CALL\nFOR ARTISTS",  line: 2, flash:  250 },
  { tick: 1216,  word: "OPEN CALL\nFOR ARTISTS",  line: 2, flash:  500 },
  // "SUBMISSIONS / OPEN"
  { tick: 1376,  word: "SUBMISSIONS\nOPEN",       line: 2, flash:  250 },
  { tick: 1442,  word: "SUBMISSIONS\nOPEN",       line: 2, flash:  250 },
  // Categories
  { tick: 2024,  word: "WORKS IN\nPROGRESS",      line: 2, flash:  250 },
  { tick: 2130,  word: "FULLDOME\nFILMS",         line: 2, flash:  800 },
  { tick: 2415,  word: "INSTALLATIONS",            line: 2, flash:  800 },
  { tick: 2482,  word: "AV LIVE",                  line: 2, flash:  800 },
  // APPLY
  { tick: 2806,  word: "✦ APPLY ✦\n8TH OF MARCH", line: 2, flash:  250 },
  { tick: 2868,  word: "✦ APPLY ✦\n8TH OF MARCH", line: 2, flash:  500 },
  // ALL words together
  { tick: 3187,  word: null,                       line: 2, flash:  500 },
  { tick: 3283,  word: null,                       line: 2, flash:  500 },
  { tick: 3476,  word: null,                       line: 2, flash:  250 },
];

// Convert to ms for export (used by timeline editor)
export const midiFanfareCues = {};
MIDI_CUES.forEach((cue, i) => {
  const key = `cue${i + 1}`;
  midiFanfareCues[key] = {
    time: Math.round(cue.tick * TICK_MS),
    word: cue.word,
    line: cue.line,
    flash: cue.flash,
  };
});

// Total duration in ms (~21.4s audio + 2s reverb tail)
export const FANFARE_DURATION_MS = Math.round(3840 * TICK_MS) + 2000;

// ---------------------------------------------------------------------------
// Tone.js loader
// ---------------------------------------------------------------------------

let Tone = null;

async function getTone() {
  if (Tone) return Tone;
  Tone = window.Tone;
  if (!Tone) {
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (window.Tone) {
          Tone = window.Tone;
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
  if (Tone.context.state !== "running") await Tone.start();
  return Tone;
}

// ---------------------------------------------------------------------------
// Main playback function
// ---------------------------------------------------------------------------

/**
 * Play the fanfare — BeepBox MP3 through Web Audio chain + MIDI-timed cues.
 *
 * @param {Object} options
 * @param {number} options.startFromMs - Start offset in ms (for seeking)
 * @param {Function} options.onCue - Callback fired for each cue: ({ word, line, flash, timeMs })
 * @returns {{ stop, fadeOut, masterGain, durationMs, disposed }}
 */
export async function playFanfareSynth({ startFromMs = 0, onCue = null } = {}) {
  const T = await getTone();
  if (!T) throw new Error("Tone.js not available");

  const rawCtx = T.context.rawContext || T.context._context || T.context;

  // --- Audio element ---
  const audio = new Audio(FANFARE_MP3);
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  audio.playbackRate = PLAYBACK_RATE;

  // Seek if starting mid-stream
  if (startFromMs > 0) {
    await new Promise((resolve) => {
      const doSeek = () => {
        audio.currentTime = (startFromMs / 1000) * PLAYBACK_RATE;
        resolve();
      };
      if (audio.readyState >= 1) doSeek();
      else audio.addEventListener("loadedmetadata", doSeek, { once: true });
    });
  }

  // --- Web Audio processing chain ---
  const mediaSource = rawCtx.createMediaElementSource(audio);

  // 1. Master gain
  const gain = rawCtx.createGain();
  gain.gain.value = 1.0;

  // 2. Chorus — 3 detuned delay lines for width
  const chorusDry = rawCtx.createGain();
  chorusDry.gain.value = 0.55;
  const chorusWet = rawCtx.createGain();
  chorusWet.gain.value = 0.45;
  const chorusMerge = rawCtx.createGain();

  const chorusDelays = [];
  const chorusLFOs = [];
  for (let i = 0; i < 3; i++) {
    const delay = rawCtx.createDelay(0.05);
    delay.delayTime.value = 0.012 + i * 0.008;
    const lfoGain = rawCtx.createGain();
    lfoGain.gain.value = 0.003;
    const lfo = rawCtx.createOscillator();
    lfo.frequency.value = 0.6 + i * 0.4;
    lfo.type = "sine";
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    delay.connect(chorusWet);
    chorusDelays.push(delay);
    chorusLFOs.push(lfo, lfoGain);
  }

  // 3. EQ — warm bottom, clear top
  const lowBoost = rawCtx.createBiquadFilter();
  lowBoost.type = "lowshelf";
  lowBoost.frequency.value = 250;
  lowBoost.gain.value = 5;

  const midScoop = rawCtx.createBiquadFilter();
  midScoop.type = "peaking";
  midScoop.frequency.value = 1200;
  midScoop.Q.value = 1.0;
  midScoop.gain.value = -1;

  const highCut = rawCtx.createBiquadFilter();
  highCut.type = "highshelf";
  highCut.frequency.value = 5000;
  highCut.gain.value = -1;

  // 4. Soft-clip saturation
  const waveshaper = rawCtx.createWaveShaper();
  const curveLen = 4096;
  const curve = new Float32Array(curveLen);
  for (let i = 0; i < curveLen; i++) {
    const x = (i / (curveLen - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8) * 0.9 + x * 0.1;
  }
  waveshaper.curve = curve;
  waveshaper.oversample = "2x";

  // 5. Convolution reverb (synthesized hall IR)
  const convolver = rawCtx.createConvolver();
  const irLength = rawCtx.sampleRate * 3.5;
  const irBuffer = rawCtx.createBuffer(2, irLength, rawCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = irBuffer.getChannelData(ch);
    for (let i = 0; i < irLength; i++) {
      const noise = Math.random() * 2 - 1;
      const earlyBoost = i < rawCtx.sampleRate * 0.08 ? 1.5 : 1.0;
      data[i] = noise * earlyBoost * Math.pow(1 - i / irLength, 2.0);
    }
  }
  convolver.buffer = irBuffer;

  const dryGain = rawCtx.createGain();
  dryGain.gain.value = 0.55;
  const wetGain = rawCtx.createGain();
  wetGain.gain.value = 0.45;

  // Wire it all up
  mediaSource.connect(gain);
  gain.connect(chorusDry);
  chorusDelays.forEach((d) => gain.connect(d));
  chorusDry.connect(chorusMerge);
  chorusWet.connect(chorusMerge);
  chorusMerge.connect(lowBoost);
  lowBoost.connect(midScoop);
  midScoop.connect(highCut);
  highCut.connect(waveshaper);
  waveshaper.connect(dryGain);
  waveshaper.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(rawCtx.destination);
  wetGain.connect(rawCtx.destination);

  const rawNodes = [
    mediaSource, gain, chorusDry, chorusWet, chorusMerge,
    ...chorusDelays, ...chorusLFOs,
    lowBoost, midScoop, highCut, waveshaper,
    convolver, dryGain, wetGain,
  ];

  // --- Sub-bass synth layer (Tone.js) ---
  const toneNodes = [];
  let subSynth = null;
  try {
    const subFilter = new T.Filter({ frequency: 100, type: "lowpass", rolloff: -24 }).toDestination();
    toneNodes.push(subFilter);
    subSynth = new T.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 2, decay: 1, sustain: 0.6, release: 3 },
      volume: -12,
    }).connect(subFilter);
    toneNodes.push(subSynth);
  } catch (_) {}

  // --- State ---
  let disposed = false;
  let cueAnimId = null;

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (cueAnimId) cancelAnimationFrame(cueAnimId);
    try { audio.pause(); } catch (_) {}
    try { audio.src = ""; } catch (_) {}
    rawNodes.forEach((n) => { try { n.disconnect(); } catch (_) {} });
    toneNodes.forEach((n) => { try { n.dispose(); } catch (_) {} });
  }

  // --- Cue scheduler (synced to audio.currentTime) ---
  const nativeTickMs = 60000 / (MIDI_BPM * TICKS_PER_BEAT);
  let nextCueIndex = 0;

  // Skip cues before start offset
  const startNativeSec = (startFromMs / 1000) * PLAYBACK_RATE;
  while (nextCueIndex < MIDI_CUES.length) {
    const nativeSec = MIDI_CUES[nextCueIndex].tick * nativeTickMs / 1000;
    if (nativeSec >= startNativeSec) break;
    nextCueIndex++;
  }

  function pollCues() {
    if (disposed || !onCue) return;
    if (audio.paused && !audio.ended) {
      cueAnimId = requestAnimationFrame(pollCues);
      return;
    }
    const currentNativeSec = audio.currentTime;
    while (nextCueIndex < MIDI_CUES.length) {
      const cue = MIDI_CUES[nextCueIndex];
      const cueNativeSec = cue.tick * nativeTickMs / 1000;
      if (currentNativeSec >= cueNativeSec) {
        const timeMs = Math.round(cue.tick * TICK_MS);
        onCue({ word: cue.word, line: cue.line, flash: cue.flash, timeMs });
        nextCueIndex++;
      } else {
        break;
      }
    }
    if (!audio.ended && nextCueIndex < MIDI_CUES.length) {
      cueAnimId = requestAnimationFrame(pollCues);
    }
  }

  // --- Start playback ---
  audio.addEventListener("playing", () => {
    if (subSynth) try { subSynth.triggerAttack("Bb0"); } catch (_) {}
    pollCues();
  }, { once: true });

  audio.addEventListener("ended", () => {
    if (subSynth) try { subSynth.triggerRelease(); } catch (_) {}
    setTimeout(() => dispose(), 3000);
  }, { once: true });

  await audio.play();
  console.log("Fanfare: playing BeepBox at native " + MIDI_BPM + " BPM");

  // --- Return handle ---
  return {
    stop() {
      dispose();
    },
    fadeOut(duration = 3) {
      if (disposed) return Promise.resolve();
      return new Promise((resolve) => {
        const startVol = gain.gain.value;
        const startTime = performance.now();
        const durMs = duration * 1000;
        function fade() {
          const t = Math.min((performance.now() - startTime) / durMs, 1);
          gain.gain.value = startVol * (1 - t);
          if (t < 1) {
            requestAnimationFrame(fade);
          } else {
            dispose();
            resolve();
          }
        }
        fade();
      });
    },
    /** For external volume control */
    masterGain: { gain },
    /** The audio element (for pause/resume) */
    audio,
    durationMs: FANFARE_DURATION_MS,
    get disposed() { return disposed; },
  };
}
