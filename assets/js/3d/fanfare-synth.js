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
const FANFARE_MP3 = "assets/audio/fanfare.mp3";

// ---------------------------------------------------------------------------
// Live-tweakable settings (exposed to GUI, persist across plays)
// ---------------------------------------------------------------------------

export const fanfareSettings = {
  // Playback
  playbackRate: 1.0,
  volume: 1.0,
  // Chorus
  chorusMix: 0.45,    // wet amount (0 = dry, 1 = full chorus)
  chorusDepth: 0.003, // LFO modulation depth
  chorusRate: 0.6,    // base LFO rate
  // EQ
  lowBoost: 5,        // dB shelf boost below 250 Hz
  lowFreq: 250,       // low shelf frequency
  midGain: -1,        // dB peaking at midFreq
  midFreq: 1200,      // mid EQ center frequency
  midQ: 1.0,          // mid EQ bandwidth
  highGain: -1,       // dB shelf above highFreq
  highFreq: 5000,     // high shelf frequency
  // Saturation
  drive: 1.8,         // waveshaper drive amount
  // Reverb
  reverbMix: 0.45,    // wet amount (0 = dry, 1 = full reverb)
  reverbDecay: 2.0,   // decay power curve
  reverbLength: 3.5,  // IR length in seconds
  // Sub bass
  subVolume: -12,     // dB
  subNote: "Bb0",     // root note
};

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
  audio.playbackRate = fanfareSettings.playbackRate;

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

  const s = fanfareSettings;

  // 1. Master gain
  const gain = rawCtx.createGain();
  gain.gain.value = s.volume;

  // 2. Chorus — 3 detuned delay lines for width
  const chorusDry = rawCtx.createGain();
  chorusDry.gain.value = 1 - s.chorusMix;
  const chorusWet = rawCtx.createGain();
  chorusWet.gain.value = s.chorusMix;
  const chorusMerge = rawCtx.createGain();

  const chorusDelays = [];
  const chorusLFOs = [];
  const chorusLfoGains = [];
  for (let i = 0; i < 3; i++) {
    const delay = rawCtx.createDelay(0.05);
    delay.delayTime.value = 0.012 + i * 0.008;
    const lfoGain = rawCtx.createGain();
    lfoGain.gain.value = s.chorusDepth;
    const lfo = rawCtx.createOscillator();
    lfo.frequency.value = s.chorusRate + i * 0.4;
    lfo.type = "sine";
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();
    delay.connect(chorusWet);
    chorusDelays.push(delay);
    chorusLFOs.push(lfo);
    chorusLfoGains.push(lfoGain);
  }

  // 3. EQ — warm bottom, clear top
  const lowBoost = rawCtx.createBiquadFilter();
  lowBoost.type = "lowshelf";
  lowBoost.frequency.value = s.lowFreq;
  lowBoost.gain.value = s.lowBoost;

  const midScoop = rawCtx.createBiquadFilter();
  midScoop.type = "peaking";
  midScoop.frequency.value = s.midFreq;
  midScoop.Q.value = s.midQ;
  midScoop.gain.value = s.midGain;

  const highCut = rawCtx.createBiquadFilter();
  highCut.type = "highshelf";
  highCut.frequency.value = s.highFreq;
  highCut.gain.value = s.highGain;

  // 4. Soft-clip saturation
  const waveshaper = rawCtx.createWaveShaper();
  function buildSatCurve(drive) {
    const len = 4096;
    const c = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * 2 - 1;
      c[i] = Math.tanh(x * drive) * 0.9 + x * 0.1;
    }
    return c;
  }
  waveshaper.curve = buildSatCurve(s.drive);
  waveshaper.oversample = "2x";

  // 5. Convolution reverb (synthesized hall IR)
  const convolver = rawCtx.createConvolver();
  function buildIR(length, decay) {
    const irLen = Math.floor(rawCtx.sampleRate * length);
    const buf = rawCtx.createBuffer(2, irLen, rawCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const noise = Math.random() * 2 - 1;
        const earlyBoost = i < rawCtx.sampleRate * 0.08 ? 1.5 : 1.0;
        data[i] = noise * earlyBoost * Math.pow(1 - i / irLen, decay);
      }
    }
    return buf;
  }
  convolver.buffer = buildIR(s.reverbLength, s.reverbDecay);

  const dryGain = rawCtx.createGain();
  dryGain.gain.value = 1 - s.reverbMix;
  const wetGain = rawCtx.createGain();
  wetGain.gain.value = s.reverbMix;

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
    ...chorusDelays, ...chorusLFOs, ...chorusLfoGains,
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
      volume: s.subVolume,
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
    if (subSynth) try { subSynth.triggerAttack(s.subNote); } catch (_) {}
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
    /** Live audio nodes for real-time GUI tweaking */
    nodes: {
      gain, chorusDry, chorusWet, chorusLFOs, chorusLfoGains,
      lowBoost, midScoop, highCut, waveshaper, convolver,
      dryGain, wetGain, subSynth, buildSatCurve, buildIR,
    },
  };
}
