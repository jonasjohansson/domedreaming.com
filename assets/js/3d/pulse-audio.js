/**
 * Pulse Audio System - Spatial 3D Audio
 * Each pulse has a positioned sound in 3D space
 */

// Import scramble trigger (will be set dynamically to avoid circular dependency)
let triggerScrambleBurst = null;

export function setScrambleTrigger(fn) {
  triggerScrambleBurst = fn;
}

// Track tick events for pulse pulsation
let lastTickTime = 0;
let tickIntensity = 0; // 0-1, decays over time
let activePulseIndex = -1; // Which pulse is currently reacting (-1 = none)

/**
 * Get current tick intensity for pulse pulsation effect
 * Returns a value 0-1 that decays after each tick
 */
export function getTickIntensity() {
  return tickIntensity;
}

/**
 * Get which pulse index should currently react to the tick
 * Returns -1 if no pulse should react
 */
export function getActivePulseIndex() {
  return activePulseIndex;
}

/**
 * Set the number of pulses (called when pulses are initialized)
 */
let totalPulseCount = 8;
export function setTotalPulseCount(count) {
  totalPulseCount = count;
}

/**
 * Update tick intensity (call in animation loop)
 * Decays the intensity over time for smooth pulsation
 */
export function updateTickIntensity() {
  const decayRate = 0.15; // How fast the intensity decays per frame
  tickIntensity = Math.max(0, tickIntensity - decayRate);
  // Reset active pulse when intensity fades
  if (tickIntensity <= 0) {
    activePulseIndex = -1;
  }
}

let Tone = null;
let audioInitialized = false;
let audioEnabled = false;

// Audio nodes
let synths = [];
let masterGain = null;
let reverb = null;

// Drone frequencies - audible bass for ambient drones
const DRONE_FREQUENCIES = [
  55,    // A1
  65.41, // C2
  73.42, // D2
  82.41, // E2
];

// Tick frequencies - pentatonic scale for melodic feel
const TICK_FREQUENCIES = [
  392.00, // G4
  440.00, // A4
  493.88, // B4
  587.33, // D5
  659.25, // E5
  783.99, // G5
];

// Audio settings (exported for GUI control)
export const audioSettings = {
  enabled: true,
  masterVolume: 0.5,
  reverbWet: 0.5,
  spatialSpread: 15, // How spread out the sounds are in 3D space
  tickBPM: 60, // BPM for tick sounds
};

/**
 * Load Tone.js dynamically
 */
async function loadTone() {
  if (Tone) return Tone;
  if (window.Tone) {
    Tone = window.Tone;
    return Tone;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tone@14.7.77/build/Tone.js";
    script.onload = () => {
      Tone = window.Tone;
      console.log("Tone.js loaded for spatial audio");
      resolve(Tone);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Initialize audio (call on user interaction)
 */
export async function initAudio() {
  if (audioInitialized) return true;

  try {
    await loadTone();
    if (!Tone) return false;

    // Start audio context (requires user gesture)
    await Tone.start();
    console.log("Spatial audio context started");

    // Create reverb for atmosphere
    reverb = new Tone.Reverb({
      decay: 6,
      wet: audioSettings.reverbWet,
    }).toDestination();
    await reverb.generate();

    // Create master gain
    masterGain = new Tone.Gain(audioSettings.masterVolume).connect(reverb);

    audioInitialized = true;
    return true;
  } catch (error) {
    console.error("Error initializing spatial audio:", error);
    return false;
  }
}

/**
 * Create spatial synths for pulses
 */
export function createPulseSynths(count) {
  if (!Tone || !audioInitialized) {
    console.log("Cannot create synths - audio not initialized");
    return;
  }

  // Dispose old synths
  synths.forEach(s => {
    try {
      s.synth.dispose();
      if (s.panner) s.panner.dispose();
      if (s.panner3d) s.panner3d.dispose();
    } catch(e) {}
  });
  synths = [];

  // Create a mix of drone and tick synths for sound art installation feel
  for (let i = 0; i < count; i++) {
    // Use simple Panner for stereo positioning (more reliable than Panner3D)
    const panner = new Tone.Panner(0).connect(masterGain);

    // Alternate between drone synths (even) and tick synths (odd)
    const isTick = i % 2 === 1;
    let synth;

    if (isTick) {
      // Tick synth - melodic bell-like tones
      synth = new Tone.Synth({
        oscillator: {
          type: "sine",
        },
        envelope: {
          attack: 0.01,
          decay: 0.4,
          sustain: 0.1,
          release: 0.8,
        },
        volume: -6, // Gentle melodic ticks
      }).connect(panner);
    } else {
      // Drone synth - bass atmospheric sounds
      synth = new Tone.Synth({
        oscillator: {
          type: "triangle", // Triangle has bass with some harmonics for audibility
        },
        envelope: {
          attack: 2,
          decay: 0.5,
          sustain: 0.7,
          release: 2,
        },
        volume: -24, // Very subtle background drone
      }).connect(panner);
    }

    synths.push({
      synth,
      panner,
      playing: false,
      frequency: isTick
        ? TICK_FREQUENCIES[Math.floor(i / 2) % TICK_FREQUENCIES.length]
        : DRONE_FREQUENCIES[Math.floor(i / 2) % DRONE_FREQUENCIES.length],
      isTick,
      lastTickTime: 0,
      tickInterval: (60000 / audioSettings.tickBPM) * (1 + (i * 0.25)),
      x: 0,
      y: 0,
      z: 0,
    });
  }

  console.log(`Created ${count} spatial synths`);

  // If audio is already enabled, start the drones immediately
  if (audioEnabled) {
    synths.forEach((s, i) => {
      if (!s.playing && !s.isTick) {
        s.synth.triggerAttack(s.frequency);
        s.playing = true;
        console.log(`Started drone synth ${i} at ${s.frequency}Hz`);
      } else if (s.isTick) {
        s.playing = true;
        s.lastTickTime = performance.now();
      }
    });
  }
}

/**
 * Start audio playback
 */
export async function startAudio() {
  console.log("Starting spatial audio...");

  if (!audioInitialized) {
    const success = await initAudio();
    if (!success) {
      console.error("Failed to initialize audio");
      return false;
    }
  }

  // Create synths if needed
  if (synths.length === 0) {
    createPulseSynths(8);
  }

  audioEnabled = true;
  audioSettings.enabled = true;

  // Start drones (ticks are triggered in updatePulseAudio)
  synths.forEach((s, i) => {
    if (!s.playing && !s.isTick) {
      // Only start continuous playback for drones
      s.synth.triggerAttack(s.frequency);
      s.playing = true;
      console.log(`Started drone synth ${i} at ${s.frequency}Hz`);
    } else if (s.isTick) {
      s.playing = true; // Mark tick as ready
      s.lastTickTime = performance.now();
      console.log(`Tick synth ${i} ready at ${s.frequency}Hz`);
    }
  });

  return true;
}

/**
 * Stop audio
 */
export function stopAudio() {
  audioEnabled = false;
  audioSettings.enabled = false;

  synths.forEach(s => {
    if (s.playing) {
      try {
        s.synth.triggerRelease();
      } catch(e) {}
      s.playing = false;
    }
  });

  console.log("Spatial audio stopped");
}

/**
 * Update pulse audio positions based on pulse locations
 * @param {Array} pulses - Array of pulse objects with circle and angle
 * @param {Object} params - Grid parameters including circleStep
 */
export function updatePulseAudio(pulses, params) {
  if (!audioEnabled || synths.length === 0) return;

  const spread = audioSettings.spatialSpread;
  const { circleStep } = params;
  const currentTime = performance.now();

  pulses.forEach((pulse, i) => {
    if (i >= synths.length) return;

    const s = synths[i];

    // Convert polar coordinates to stereo pan position (-1 to 1)
    const panValue = Math.cos(pulse.angle) * 0.8; // Use angle for left/right pan

    // Update stereo panner
    if (s.panner) {
      s.panner.pan.value = panValue;
    }

    // Store position for reference
    s.x = Math.cos(pulse.angle) * pulse.circle;
    s.y = pulse.circle;
    s.z = Math.sin(pulse.angle) * pulse.circle;

    if (s.isTick) {
      // Trigger tick sounds at intervals - high pitched clicks
      const tickInterval = (60000 / audioSettings.tickBPM) * (1 + (i * 0.1));
      if (currentTime - s.lastTickTime >= tickInterval) {
        // Trigger a high-pitched tick
        try {
          s.synth.triggerAttackRelease(s.frequency, "8n");
          console.log(`Tick ${i} at ${s.frequency}Hz`);
          // Trigger scramble effect in sync with every tick
          if (triggerScrambleBurst) {
            triggerScrambleBurst();
          }
          // Set tick intensity for pulse pulsation
          tickIntensity = 1.0;
          lastTickTime = currentTime;
          // Select a random pulse to react
          activePulseIndex = Math.floor(Math.random() * totalPulseCount);
        } catch (e) {
          console.error("Tick error:", e);
        }
        s.lastTickTime = currentTime;
      }
    } else {
      // Drones - subtle volume variation based on position
      const baseVol = -6;
      const variation = Math.sin(pulse.angle * 2) * 2;
      s.synth.volume.value = baseVol + variation;
    }
  });
}

/**
 * Update listener position (call with camera position)
 * @param {Object} position - Camera position {x, y, z}
 * @param {Object} forward - Camera forward direction {x, y, z}
 */
export function updateListenerPosition(position, forward) {
  if (!Tone || !audioEnabled) return;

  try {
    const listener = Tone.Listener;

    // Update listener position
    listener.positionX.value = position.x || 0;
    listener.positionY.value = position.y || 0;
    listener.positionZ.value = position.z || 0;

    // Update listener orientation (forward and up vectors)
    if (forward) {
      listener.forwardX.value = forward.x || 0;
      listener.forwardY.value = forward.y || 0;
      listener.forwardZ.value = forward.z || -1;
    }
  } catch (e) {
    // Listener API might not be available
  }
}

export function setMasterVolume(v) {
  audioSettings.masterVolume = v;
  if (masterGain) masterGain.gain.rampTo(v, 0.1);
}

export function setReverbWet(v) {
  audioSettings.reverbWet = v;
  if (reverb) reverb.wet.rampTo(v, 0.1);
}

export function setSpatialSpread(v) {
  audioSettings.spatialSpread = v;
}

export function isAudioEnabled() {
  return audioEnabled;
}

export function isAudioInitialized() {
  return audioInitialized;
}
