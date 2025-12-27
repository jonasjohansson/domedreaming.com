import { getMaterial } from "./3d/utils.js";

export let constants = {
  cameraHeight: 1.6,
  navmeshSearchBox: { x: 5, y: 10, z: 5 },
  screenMaterialSettings: {
    emissive: [1.0, 1.0, 1.0],
    emissiveIntensity: 1.0,
    color: [1.0, 1.0, 1.0],
    toneMapped: false,
    transparent: false,
    opacity: 1.0,
  },
  ledCount: 384,
  ledRadius: 0.03,
};

export let moveSpeed = 0.02;
export let cameraSettings = {
  sensitivity: 0.002,
  rotationSpeed: 120,
};
export let startCameraPosition = { x: 0, y: 5.4, z: -4.3 };
export let startCameraRotation = { x: -3, y: 0, z: 3.121154018741333 };
export let currentCameraPosition = { x: 0, y: 0, z: 0 };
export let currentCameraRotation = { x: 0, y: 0, z: 0 };
export let bloomSettings = {
  enabled: true,
  strength: 1.5,
  radius: 0.4,
  threshold: 0.85,
};
export let ledStripSettings = {
  pulseSpeed: 2.0,
  pulseWidth: 0.3,
  baseIntensity: 0.0,
  maxIntensity: 4.0,
  mirrored: false,
  rimVisible: false,
  hueStart: 0.5,
  hueRange: 0.3,
  saturation: 1.0,
  lightness: 0.5,
};
export let pageColorSettings = {
  backgroundColor: "#000000",
  textColor: "#ffffff",
  dotColor: "#ffffff",
  sidebarColor: "#333333",
  sidebarVisible: true,
  headerIslandVisible: false,
  blendMode: "normal",
  vignette: {
    enabled: false,
    size: 8, // percentage
    fadeWidth: 2, // percentage for the fade transition
  },
};
export let scrollSettings = {
  enabled: true,
  scrollTimeout: 25,
  touchThreshold: 30,
  snapThreshold: 0.5,
  initialSnapThreshold: 1,
  gridColumns: 16,
  gridRows: 16,
};

export let canvasSettings = {
  rows: 8,
};

export let screenSettings = {
  defaultImage: "assets/img/background-text.jpg",
};

export let textureRotationSettings = {
  enabled: true,
  speed: 0.02,
};

export let pageBackgroundSettings = {
  canvas: {
    backgroundColor: "#000000",
    backgroundImage: null,
  },
  about: {
    backgroundColor: "#463434",
    backgroundImage: null,
  },
  team: {
    backgroundColor: "#000000",
    backgroundImage: null,
  },
};

export function setMoveSpeed(value) {
  moveSpeed = value;
}

export function setBloomSettings(strength, radius, threshold) {
  bloomSettings.strength = strength;
  bloomSettings.radius = radius;
  bloomSettings.threshold = threshold;
}

async function loadDefaultSettings(forceReload = false) {
  try {
    // Use import.meta.url to get the current module's directory
    const moduleUrl = new URL(import.meta.url);
    const jsonUrl = new URL("./default-settings.json", moduleUrl);
    // Add cache busting if forcing reload
    const url = forceReload ? `${jsonUrl}?t=${Date.now()}` : jsonUrl;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("Could not load data.json, using hardcoded defaults");
      return false;
    }
    const defaultSettings = await response.json();

    // Load constants (always from JSON)
    if (defaultSettings.constants) {
      constants = { ...constants, ...defaultSettings.constants };
    }

    // Load default settings values from JSON (always, as base)
    if (defaultSettings.settings) {
      applySettings(defaultSettings.settings);
    }

    return true;
  } catch (error) {
    console.warn("Failed to load default settings from JSON:", error);
    return false;
  }
}

function applySettings(settings) {
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

  if (settings.bloomSettings) {
    Object.assign(bloomSettings, settings.bloomSettings);
  }

  if (settings.ledStripSettings) {
    Object.assign(ledStripSettings, settings.ledStripSettings);
  }

  if (settings.pageColorSettings) {
    // Merge page color settings, including nested vignette object
    if (settings.pageColorSettings.vignette) {
      pageColorSettings.vignette = { ...pageColorSettings.vignette, ...settings.pageColorSettings.vignette };
    }
    Object.assign(pageColorSettings, settings.pageColorSettings);
    // Ensure vignette object exists
    if (!pageColorSettings.vignette) {
      pageColorSettings.vignette = { enabled: true, size: 8, fadeWidth: 2 };
    }
    // Apply page colors immediately
    applyPageColors();
  }

  if (settings.scrollSettings) {
    Object.assign(scrollSettings, settings.scrollSettings);
  }

  if (settings.canvasSettings) {
    Object.assign(canvasSettings, settings.canvasSettings);
  }

  if (settings.screenSettings) {
    Object.assign(screenSettings, settings.screenSettings);
  }

  if (settings.textureRotationSettings) {
    Object.assign(textureRotationSettings, settings.textureRotationSettings);
  }

  if (settings.pageBackgroundSettings) {
    Object.assign(pageBackgroundSettings, settings.pageBackgroundSettings);
    applyPageBackgrounds();
  }
}

/**
 * Convert hex color to rgba with 0.5 alpha
 */
function hexToRgba(hex, alpha = 0.5) {
  if (!hex) return null;
  if (hex.startsWith("rgba")) return hex;
  if (hex.startsWith("rgb")) {
    const rgb = hex.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }
  }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

/**
 * Apply page background settings to DOM elements
 */
export function applyPageBackgrounds() {
  // Canvas page background settings removed - handled by CSS

  // About page (first page-section after canvas)
  // Background is now handled by CSS in layout.css
  const pageSections = document.querySelectorAll(".page-section");
  if (pageSections.length > 0) {
    // Skip first page-section - handled by CSS

    // Apply team background to remaining sections if needed
    if (pageSections.length > 1 && pageBackgroundSettings.team) {
      for (let i = 1; i < pageSections.length; i++) {
        const section = pageSections[i];
        if (pageBackgroundSettings.team.backgroundColor && pageBackgroundSettings.team.backgroundColor !== "#000000") {
          const rgbaColor = hexToRgba(pageBackgroundSettings.team.backgroundColor, 0.5);
          section.style.setProperty("background-color", rgbaColor, "important");
        } else {
          section.style.removeProperty("background-color");
        }
        if (pageBackgroundSettings.team.backgroundImage) {
          section.style.setProperty("background-image", `url(${pageBackgroundSettings.team.backgroundImage})`, "important");
          section.style.setProperty("background-size", "cover", "important");
          section.style.setProperty("background-position", "center", "important");
          section.style.setProperty("background-repeat", "no-repeat", "important");
        } else {
          section.style.removeProperty("background-image");
        }
      }
    }
  }
}

function applyVignette() {
  const canvasContainer = document.getElementById("canvas-container");
  if (!canvasContainer) return;

  const vignette = pageColorSettings.vignette || { enabled: true, size: 8, fadeWidth: 2 };

  if (!vignette.enabled) {
    canvasContainer.style.maskImage = "none";
    canvasContainer.style.webkitMaskImage = "none";
    return;
  }

  const size = `${vignette.size}%`;
  const fade1 = `${vignette.size + vignette.fadeWidth}%`;
  const fade2 = `${vignette.size + vignette.fadeWidth * 2}%`;
  const fade3 = `${100 - vignette.size - vignette.fadeWidth * 2}%`;
  const fade4 = `${100 - vignette.size - vignette.fadeWidth}%`;
  const fade5 = `${100 - vignette.size}%`;

  const horizontalGradient = `linear-gradient(to right, transparent 0%, transparent ${size}, rgba(0, 0, 0, 0.5) ${fade1}, black ${fade2}, black ${fade3}, rgba(0, 0, 0, 0.5) ${fade4}, transparent ${fade5}, transparent 100%)`;
  const verticalGradient = `linear-gradient(to bottom, transparent 0%, transparent ${size}, rgba(0, 0, 0, 0.5) ${fade1}, black ${fade2}, black ${fade3}, rgba(0, 0, 0, 0.5) ${fade4}, transparent ${fade5}, transparent 100%)`;

  canvasContainer.style.maskImage = `${horizontalGradient}, ${verticalGradient}`;
  canvasContainer.style.maskComposite = "intersect";
  canvasContainer.style.webkitMaskImage = `${horizontalGradient}, ${verticalGradient}`;
  canvasContainer.style.webkitMaskComposite = "source-in";
}

export function applyPageColors() {
  document.documentElement.style.setProperty("--color-bg", pageColorSettings.backgroundColor);
  document.documentElement.style.setProperty("--color-text", pageColorSettings.textColor);
  document.documentElement.style.setProperty("--color-dot", pageColorSettings.dotColor);
  // Color is set via CSS custom property and will be inherited by all elements, no inline styles needed
  // Apply vignette
  applyVignette();
}

export function applyVignetteSettings() {
  applyVignette();
}

export async function loadSettings(forceFromJSON = false) {
  // First load defaults from JSON (always, as primary source)
  const jsonLoaded = await loadDefaultSettings(forceFromJSON);

  // Only use localStorage as fallback if JSON failed to load
  if (!jsonLoaded && !forceFromJSON) {
    try {
      const saved = localStorage.getItem("domeDreamingSettings");
      if (!saved) {
        // Apply default page colors even if no saved settings
        applyPageColors();
        return;
      }

      const settings = JSON.parse(saved);
      applySettings(settings);
      console.log("Loaded settings from localStorage (JSON file not available)");
    } catch (error) {
      console.warn("Failed to load settings from localStorage:", error);
      // Apply default page colors on error
      applyPageColors();
    }
  } else if (jsonLoaded) {
    console.log("Loaded settings from data.json");
    // Ensure page colors are applied after loading from JSON
    applyPageColors();
  }

  // Apply page backgrounds after loading settings
  applyPageBackgrounds();
}

export async function applySettingsToScene() {
  // Apply colors to meshes
  import("./3d/model.js").then((model) => {
    if (window.savedColorSettings && model.fbxMeshes) {
      model.fbxMeshes.forEach((item) => {
        const material = getMaterial(item.mesh);
        if (material && window.savedColorSettings[item.name]) {
          const saved = window.savedColorSettings[item.name];
          material.color.setRGB(saved.r, saved.g, saved.b);
          material.needsUpdate = true;
        }
      });
    }

    // Apply light settings
    if (window.savedLightSettings && model.glbLights) {
      model.glbLights.forEach((light, index) => {
        const lightName = light.name || `light_${index}`;
        if (window.savedLightSettings[lightName]) {
          const saved = window.savedLightSettings[lightName];
          light.color.setRGB(saved.r, saved.g, saved.b);
          // Clamp to avoid extreme persisted values blowing out the scene
          const clampedIntensity = Math.max(0, Math.min(saved.intensity ?? light.intensity, 10));
          light.intensity = clampedIntensity;
        }
      });
    }
  });

  // Update bloom settings
  import("./3d/postprocessing.js").then((postProc) => {
    const bloomPass = postProc.getBloomPass();
    if (bloomPass) {
      // Enable/disable bloom based on settings
      bloomPass.enabled = bloomSettings.enabled !== false;
      if (bloomSettings.enabled) {
        bloomPass.strength = bloomSettings.strength;
        bloomPass.radius = bloomSettings.radius;
        bloomPass.threshold = bloomSettings.threshold;
      } else {
        // Set to 0 when disabled
        bloomPass.strength = 0;
      }
    }
  });

  // Reload LED strip settings
  import("./3d/led-strip.js").then((ledStrip) => {
    ledStrip.loadLEDStripSettings();
    // Apply rim visibility
    if (ledStripSettings.rimVisible !== undefined) {
      ledStrip.setRimVisible(ledStripSettings.rimVisible);
    }
  });
}

export async function reloadFromJSON() {
  await loadSettings(true);
  await applySettingsToScene();

  console.log("Settings reloaded from JSON file");
}

export function saveSettings(fbxMeshes, glbLights) {
  try {
    const colorSettings = {};
    if (fbxMeshes && Array.isArray(fbxMeshes)) {
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
    }

    const lightSettings = {};
    if (glbLights && Array.isArray(glbLights)) {
      glbLights.forEach((light, index) => {
        const lightName = light.name || `light_${index}`;
        lightSettings[lightName] = {
          r: light.color.r,
          g: light.color.g,
          b: light.color.b,
          intensity: light.intensity,
        };
      });
    }

    const settings = {
      moveSpeed,
      cameraSettings,
      startCameraPosition,
      startCameraRotation,
      colorSettings,
      lightSettings,
      bloomSettings,
      ledStripSettings,
      pageColorSettings,
      scrollSettings,
      canvasSettings,
      screenSettings,
      textureRotationSettings,
      pageBackgroundSettings,
    };

    localStorage.setItem("domeDreamingSettings", JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save settings:", error);
  }
}

export function exportSettingsFile(fbxMeshes, glbLights) {
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

    const settingsFile = {
      version: "1.0.0",
      constants: constants,
      settings: {
        moveSpeed,
        pageColorSettings,
        scrollSettings,
        canvasSettings,
        cameraSettings,
        startCameraPosition,
        startCameraRotation,
        bloomSettings,
        ledStripSettings,
        colorSettings,
        lightSettings,
        screenSettings,
        textureRotationSettings,
        pageBackgroundSettings,
      },
    };

    // Create a blob and download
    const blob = new Blob([JSON.stringify(settingsFile, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dome-dreaming-settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("Settings file exported successfully");
  } catch (error) {
    console.error("Failed to export settings file:", error);
  }
}
