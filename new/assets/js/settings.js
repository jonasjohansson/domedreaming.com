import { getMaterial } from "./utils.js";

// State variables that need to be shared
export let moveSpeed = 0.02;
export let isNightMode = false;
export let cameraSettings = {
  sensitivity: 0.002,
  rotationSpeed: 120,
};
export let startCameraPosition = { x: 0, y: 4.698056077957153, z: -3 };
export let startCameraRotation = { x: -3, y: 0, z: 3.121154018741333 };
export let currentCameraPosition = { x: 0, y: 0, z: 0 };
export let currentCameraRotation = { x: 0, y: 0, z: 0 };
export let bloomSettings = {
  strength: 1.5,
  radius: 0.4,
  threshold: 0.85,
};
export let ledStripSettings = {
  pulseSpeed: 2.0,
  pulseWidth: 0.3,
  baseIntensity: 0.0, // Off when not pulsing
  maxIntensity: 4.0,
  mirrored: false,
  hueStart: 0.5,
  hueRange: 0.3,
  saturation: 1.0,
  lightness: 0.5,
};

export function setIsNightMode(value) {
  isNightMode = value;
}

export function setMoveSpeed(value) {
  moveSpeed = value;
}

export function setBloomSettings(strength, radius, threshold) {
  bloomSettings.strength = strength;
  bloomSettings.radius = radius;
  bloomSettings.threshold = threshold;
}

export function loadSettings() {
  try {
    const saved = localStorage.getItem("domeDreamingSettings");
    if (!saved) return;

    const settings = JSON.parse(saved);

    if (settings.moveSpeed !== undefined) moveSpeed = settings.moveSpeed;

    if (settings.cameraSettings) {
      Object.assign(cameraSettings, settings.cameraSettings);
    }

    if (settings.startCameraPosition) {
      Object.assign(startCameraPosition, settings.startCameraPosition);
    }

    if (settings.startCameraRotation) {
      Object.assign(startCameraRotation, settings.startCameraRotation);
    }

    if (settings.colorSettings) {
      window.savedColorSettings = settings.colorSettings;
    } else {
      window.savedColorSettings = null;
    }

    if (settings.lightSettings) {
      window.savedLightSettings = settings.lightSettings;
    } else {
      window.savedLightSettings = null;
    }

    if (settings.isNightMode !== undefined) {
      setIsNightMode(settings.isNightMode);
    }

    if (settings.bloomSettings) {
      Object.assign(bloomSettings, settings.bloomSettings);
    }

    if (settings.ledStripSettings) {
      Object.assign(ledStripSettings, settings.ledStripSettings);
    }
  } catch (error) {
    console.warn("Failed to load settings:", error);
  }
}

export function saveSettings(fbxMeshes, glbLights) {
  try {
    const colorSettings = {};
    fbxMeshes.forEach((item, index) => {
      const material = getMaterial(item.mesh);
      if (material?.color) {
        const meshName = item.name || `mesh_${index}`;
        colorSettings[meshName] = {
          r: material.color.r,
          g: material.color.g,
          b: material.color.b,
        };
      }
    });

    const lightSettings = {};
    glbLights.forEach((light, index) => {
      const lightName = light.name || `light_${index}`;
      lightSettings[lightName] = {
        r: light.color.r,
        g: light.color.g,
        b: light.color.b,
        intensity: light.intensity,
      };
    });

    const settings = {
      moveSpeed,
      cameraSettings,
      startCameraPosition,
      startCameraRotation,
      colorSettings,
      lightSettings,
      isNightMode,
      bloomSettings,
      ledStripSettings,
    };

    localStorage.setItem("domeDreamingSettings", JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save settings:", error);
  }
}
