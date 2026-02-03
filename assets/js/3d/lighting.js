import * as THREE from "three";
import { scene, renderer } from "./scene.js";

// Lighting settings - exported for GUI control
export const lightingSettings = {
  ambientIntensity: 0.5,
  ambientColor: "#ffffff",
  fogEnabled: false,
  fogColor: "#1a1a1a",
  fogNear: 20,
  fogFar: 60,
  // Renderer/exposure settings
  toneMapping: "Linear",
  exposure: 1.0,
  // Direct light settings
  directLightEnabled: true,
  directIntensity: 1.0,
  directColor: "#ffffff",
  // Section gradient settings
  gradientStart: 20,
  gradientEnd: 80,
  // Section 1 & 2 gradient stops
  section1FadeStart: 70, // Where section 1 starts fading to floor color
  section2FadeEnd: 30, // Where section 2 finishes fading to white
};

// Tone mapping options
const TONE_MAPPING_OPTIONS = {
  "None": THREE.NoToneMapping,
  "Linear": THREE.LinearToneMapping,
  "Reinhard": THREE.ReinhardToneMapping,
  "Cineon": THREE.CineonToneMapping,
  "ACES Filmic": THREE.ACESFilmicToneMapping,
  "AgX": THREE.AgXToneMapping,
  "Neutral": THREE.NeutralToneMapping,
};

// Direct light reference
let directLight = null;

// Light references
let ambientLight = null;

export function setupLighting() {
  // Ambient light - provides overall scene brightness
  ambientLight = new THREE.AmbientLight(
    lightingSettings.ambientColor,
    lightingSettings.ambientIntensity
  );
  scene.add(ambientLight);

  // Direct light - provides directional illumination
  directLight = new THREE.DirectionalLight(
    lightingSettings.directColor,
    lightingSettings.directIntensity
  );
  directLight.position.set(5, 10, 5);
  if (lightingSettings.directLightEnabled) {
    scene.add(directLight);
  }

  // Fog for atmospheric depth
  if (lightingSettings.fogEnabled) {
    scene.fog = new THREE.Fog(
      lightingSettings.fogColor,
      lightingSettings.fogNear,
      lightingSettings.fogFar
    );
  }

  // Set up renderer tone mapping
  setToneMapping(lightingSettings.toneMapping);
  setExposure(lightingSettings.exposure);
}

// Update functions for GUI
export function setAmbientIntensity(value) {
  lightingSettings.ambientIntensity = value;
  if (ambientLight) ambientLight.intensity = value;
}

export function setAmbientColor(value) {
  lightingSettings.ambientColor = value;
  if (ambientLight) ambientLight.color.set(value);
}

export function setFogEnabled(value) {
  lightingSettings.fogEnabled = value;
  if (value) {
    scene.fog = new THREE.Fog(
      lightingSettings.fogColor,
      lightingSettings.fogNear,
      lightingSettings.fogFar
    );
  } else {
    scene.fog = null;
  }
}

export function setFogColor(value) {
  lightingSettings.fogColor = value;
  if (scene.fog) scene.fog.color.set(value);
}

export function setFogNear(value) {
  lightingSettings.fogNear = value;
  if (scene.fog) scene.fog.near = value;
}

export function setFogFar(value) {
  lightingSettings.fogFar = value;
  if (scene.fog) scene.fog.far = value;
}

// Tone mapping and exposure
export function setToneMapping(value) {
  lightingSettings.toneMapping = value;
  if (renderer && TONE_MAPPING_OPTIONS[value] !== undefined) {
    renderer.toneMapping = TONE_MAPPING_OPTIONS[value];
  }
}

export function setExposure(value) {
  lightingSettings.exposure = value;
  if (renderer) {
    renderer.toneMappingExposure = value;
  }
}

// Direct light controls
export function setDirectLightEnabled(value) {
  lightingSettings.directLightEnabled = value;
  if (directLight) {
    if (value && !directLight.parent) {
      scene.add(directLight);
    } else if (!value && directLight.parent) {
      scene.remove(directLight);
    }
  }
}

export function setDirectIntensity(value) {
  lightingSettings.directIntensity = value;
  if (directLight) directLight.intensity = value;
}

export function setDirectColor(value) {
  lightingSettings.directColor = value;
  if (directLight) directLight.color.set(value);
}

// Export tone mapping options for GUI
export function getToneMappingOptions() {
  return Object.keys(TONE_MAPPING_OPTIONS);
}

// Section gradient controls
export function setGradientStart(value) {
  lightingSettings.gradientStart = value;
  document.documentElement.style.setProperty('--bg-gradient-start', `${value}%`);
}

export function setGradientEnd(value) {
  lightingSettings.gradientEnd = value;
  document.documentElement.style.setProperty('--bg-gradient-end', `${value}%`);
}

// Section 1 & 2 gradient stops
export function setSection1FadeStart(value) {
  lightingSettings.section1FadeStart = value;
  document.documentElement.style.setProperty('--section1-fade-start', `${value}%`);
}

export function setSection2FadeEnd(value) {
  lightingSettings.section2FadeEnd = value;
  document.documentElement.style.setProperty('--section2-fade-end', `${value}%`);
}
