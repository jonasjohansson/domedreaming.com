import * as THREE from "three";
import { getMaterial } from "../3d/utils.js";

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
};

export let moveSpeed = 0.04;
export let cameraSettings = {
  sensitivity: 0.002,
  rotationSpeed: 120,
};
export let startCameraPosition = { x: 0, y: 5.4, z: -4.3 };
export let startCameraRotation = { x: -2.98, y: 0, z: 3.121154018741333 };
export let currentCameraPosition = { x: 0, y: 0, z: 0 };
export let currentCameraRotation = { x: 0, y: 0, z: 0 };
export let bloomSettings = {
  enabled: true,
  strength: 1.5,
  radius: 0.4,
  threshold: 0.85,
};
export let dofSettings = {
  enabled: true,
  focus: 12,       // Focus distance - objects at this distance are sharp
  aperture: 0.0014, // Aperture size - higher = more blur
  maxblur: 0.05,   // Maximum blur amount
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
  defaultImage: "assets/img/jpg/background-dome-dreaming.jpg",
};

export let textureRotationSettings = {
  enabled: true, // Grid/texture rotation enabled
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
    // Use relative path - works both locally and on GitHub Pages
    const jsonPath = "assets/js/core/default-settings.json";
    // Add cache busting if forcing reload
    const url = forceReload ? `${jsonPath}?t=${Date.now()}` : jsonPath;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("Could not load default-settings.json, using hardcoded defaults");
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

  if (settings.dofSettings) {
    Object.assign(dofSettings, settings.dofSettings);
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
  // Defer this work to avoid blocking TBT
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
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
      },
      { timeout: 200 }
    );
  } else {
    setTimeout(() => {
      const pageSections = document.querySelectorAll(".page-section");
      if (pageSections.length > 0 && pageSections.length > 1 && pageBackgroundSettings.team) {
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
    }, 50);
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
  // Colors are now set via CSS variables in :root, not inline styles
  // Apply vignette
  applyVignette();
}

export function applyVignetteSettings() {
  applyVignette();
}

export async function loadSettings(forceFromJSON = false) {
  // Load defaults from JSON
  const jsonLoaded = await loadDefaultSettings(forceFromJSON);

  // Apply page colors
  applyPageColors();

  // Apply page backgrounds after loading settings
  applyPageBackgrounds();
}

/**
 * Default colors
 * Primary (Main Structure): #667380, Secondary (Chairs): #8c5261, Tertiary (Floor): #a68540
 */
const DEFAULT_COLORS = {
  primary: { r: 0.4, g: 0.45, b: 0.5 },     // #667380 - Main Structure
  secondary: { r: 0.55, g: 0.32, b: 0.38 }, // #8c5261 - Chairs
  tertiary: { r: 0.65, g: 0.52, b: 0.25 },  // #a68540 - Floor
};

// Mesh name to color key mapping
const MESH_COLOR_MAP = {
  Main_Structure: 'primary',
  Chairs: 'secondary',
  Floor: 'tertiary',
};

// Store generated colors for random access
let generatedColors = {
  primary: null,
  secondary: null,
  tertiary: null,
};

/**
 * Get a random color from the three generated colors
 */
export function getRandomGeneratedColor() {
  const colors = Object.values(generatedColors).filter(c => c !== null);
  if (colors.length === 0) {
    return DEFAULT_COLORS.primary;
  }
  return colors[Math.floor(Math.random() * colors.length)];
}

// Flag to use default colors on first load
let useDefaultColors = true;

/**
 * Muted gray-blue tones for Main_Structure
 */
const MAIN_COLORS = [
  // Steel blue-gray (like screenshot)
  { r: 0.38, g: 0.42, b: 0.48 },
  // Slate gray
  { r: 0.45, g: 0.48, b: 0.52 },
  // Cool gray
  { r: 0.42, g: 0.45, b: 0.50 },
  // Warm gray
  { r: 0.48, g: 0.45, b: 0.42 },
];

/**
 * Muted earthy/dusty colors for Chairs/Floor
 */
const VIBRANT_COLORS = [
  // Dusty rose / mauve (like screenshot chairs)
  { r: 0.55, g: 0.32, b: 0.38 },
  // Ochre / mustard (like screenshot floor)
  { r: 0.65, g: 0.52, b: 0.25 },
  // Sage green
  { r: 0.45, g: 0.55, b: 0.42 },
  // Terracotta
  { r: 0.60, g: 0.40, b: 0.32 },
  // Dusty blue
  { r: 0.40, g: 0.50, b: 0.58 },
  // Plum
  { r: 0.48, g: 0.30, b: 0.45 },
];

/**
 * Generate a random muted/gray color for Main_Structure
 */
function generateMainColor() {
  const randomIndex = Math.floor(Math.random() * MAIN_COLORS.length);
  return MAIN_COLORS[randomIndex];
}

/**
 * Generate a random vibrant CMYK color for Chairs/Floor
 */
function generateVibrantColor() {
  const randomIndex = Math.floor(Math.random() * VIBRANT_COLORS.length);
  return VIBRANT_COLORS[randomIndex];
}

/**
 * Legacy function - returns vibrant color for backwards compatibility
 */
function generateRandomMutedColor() {
  return generateVibrantColor();
}

/**
 * Darken a color for CSS backgrounds while keeping character
 */
function darkenForCSS(color, factor = 0.4) {
  return {
    r: color.r * factor,
    g: color.g * factor,
    b: color.b * factor,
  };
}

/**
 * Apply generated colors to alternating sections
 * Uses the three colors for gradients (no black)
 */
function applyBackgroundColors() {
  // Helper function to convert RGB (0-1) to CSS rgb string
  const rgbToCSS = (color) => {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Helper to convert RGB (0-1) to hex
  const rgbToHex = (color) => {
    const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  import("../3d/model.js").then((model) => {
    // Get colors from 3D scene meshes
    let primaryColor = null;
    let secondaryColor = null;
    let tertiaryColor = null;

    if (model.fbxMeshes && model.fbxMeshes.length > 0) {
      // Get Primary (Main_Structure) color
      const mainMesh = model.fbxMeshes.find((item) => item.name === "Main_Structure");
      if (mainMesh) {
        const material = getMaterial(mainMesh.mesh);
        if (material && material.color) {
          primaryColor = { r: material.color.r, g: material.color.g, b: material.color.b };
        }
      }

      // Get Secondary (Chairs) color
      const chairsMesh = model.fbxMeshes.find((item) => item.name === "Chairs");
      if (chairsMesh) {
        const material = getMaterial(chairsMesh.mesh);
        if (material && material.color) {
          secondaryColor = { r: material.color.r, g: material.color.g, b: material.color.b };
        }
      }

      // Get Tertiary (Floor) color
      const floorMesh = model.fbxMeshes.find((item) => item.name === "Floor");
      if (floorMesh) {
        const material = getMaterial(floorMesh.mesh);
        if (material && material.color) {
          tertiaryColor = { r: material.color.r, g: material.color.g, b: material.color.b };
        }
      }
    }

    // Fallback to savedColorSettings if material colors not available
    if (!primaryColor) {
      primaryColor = window.savedColorSettings?.primary || window.savedColorSettings?.Main_Structure || generateRandomMutedColor();
    }
    if (!secondaryColor) {
      secondaryColor = window.savedColorSettings?.secondary || window.savedColorSettings?.Chairs || generateRandomMutedColor();
    }
    if (!tertiaryColor) {
      tertiaryColor = window.savedColorSettings?.tertiary || window.savedColorSettings?.Floor || generateRandomMutedColor();
    }

    // Store generated colors for random access
    generatedColors.primary = primaryColor;
    generatedColors.secondary = secondaryColor;
    generatedColors.tertiary = tertiaryColor;

    // Log color palette to console
    console.log('%c Color Palette ', 'background: #222; color: #fff; font-size: 14px; padding: 4px 8px;');
    console.log(`  Primary:   ${rgbToHex(primaryColor)}`);
    console.log(`  Secondary: ${rgbToHex(secondaryColor)}`);
    console.log(`  Tertiary:  ${rgbToHex(tertiaryColor)}`);

    // Use colors for backgrounds (darken secondary/tertiary for contrast)
    const bgPrimaryColor = primaryColor;
    const bgSecondaryColor = darkenForCSS(secondaryColor, 0.6);
    const bgTertiaryColor = darkenForCSS(tertiaryColor, 0.6);

    // Only update CSS variables if colors were randomized (not using defaults)
    // CSS already has correct default values, so we skip this on first load
    if (!useDefaultColors) {
      document.documentElement.style.setProperty(`--color-primary`, rgbToCSS(primaryColor));
      document.documentElement.style.setProperty(`--color-secondary`, rgbToCSS(secondaryColor));
      document.documentElement.style.setProperty(`--color-tertiary`, rgbToCSS(tertiaryColor));
      document.documentElement.style.setProperty(`--bg-main-color`, rgbToCSS(bgPrimaryColor));
      document.documentElement.style.setProperty(`--bg-floor-color`, rgbToCSS(bgTertiaryColor));
      document.documentElement.style.setProperty(`--bg-chairs-color`, rgbToCSS(bgSecondaryColor));
    }

    // Set 3D scene background to match Primary color so canvas blends with sections
    import("../3d/scene.js").then((sceneModule) => {
      sceneModule.setSceneBackground(bgPrimaryColor);
    });
  });
}

// Link colors are now handled purely by CSS (nth-of-type selectors in layout.css)

export async function applySettingsToScene() {
  // Ensure savedColorSettings exists
  if (!window.savedColorSettings) {
    window.savedColorSettings = {};
  }

  // Apply colors to meshes (batch to avoid long tasks)
  import("../3d/model.js").then((model) => {
    if (model.fbxMeshes && model.fbxMeshes.length > 0) {
      // Batch mesh color updates to avoid blocking
      let currentIndex = 0;
      const batchSize = 5;

      function processMeshBatch() {
        const endIndex = Math.min(currentIndex + batchSize, model.fbxMeshes.length);

        for (let i = currentIndex; i < endIndex; i++) {
          const item = model.fbxMeshes[i];
          const material = getMaterial(item.mesh);
          if (material) {
            let colorToApply;

            // Use default colors on first load, or random if randomize was called
            const colorKey = MESH_COLOR_MAP[item.name];
            if (item.name === "Main_Structure") {
              colorToApply = useDefaultColors ? DEFAULT_COLORS.primary : generateMainColor();
              window.savedColorSettings.primary = colorToApply;
              window.savedColorSettings[item.name] = colorToApply; // backwards compat
            } else if (item.name === "Chairs") {
              colorToApply = useDefaultColors ? DEFAULT_COLORS.secondary : generateVibrantColor();
              window.savedColorSettings.secondary = colorToApply;
              window.savedColorSettings[item.name] = colorToApply; // backwards compat
            } else if (item.name === "Floor") {
              colorToApply = useDefaultColors ? DEFAULT_COLORS.tertiary : generateVibrantColor();
              window.savedColorSettings.tertiary = colorToApply;
              window.savedColorSettings[item.name] = colorToApply; // backwards compat
            } else if (item.name === "Screen") {
              colorToApply = generateVibrantColor();
              window.savedColorSettings[item.name] = colorToApply;
            } else if (window.savedColorSettings[item.name]) {
              colorToApply = window.savedColorSettings[item.name];
            } else {
              // If no saved color, use original color
              colorToApply = item.originalColor
                ? {
                    r: item.originalColor.r,
                    g: item.originalColor.g,
                    b: item.originalColor.b,
                  }
                : null;
            }

            if (colorToApply) {
              material.color.setRGB(colorToApply.r, colorToApply.g, colorToApply.b);
              material.needsUpdate = true;
            }
          }
        }

        currentIndex = endIndex;

        if (currentIndex < model.fbxMeshes.length) {
          // Yield to browser between batches
          if ("requestIdleCallback" in window) {
            requestIdleCallback(processMeshBatch, { timeout: 50 });
          } else {
            setTimeout(processMeshBatch, 0);
          }
        } else {
          // All meshes processed, apply backgrounds (read colors from actual 3D scene)
          // Small delay to ensure savedColorSettings is fully populated
          setTimeout(() => {
            applyBackgroundColors();
          }, 10);
        }
      }

      processMeshBatch();
    }

    // Apply light settings (batch to avoid blocking)
    if (window.savedLightSettings && model.glbLights) {
      // Defer light updates slightly
      if ("requestIdleCallback" in window) {
        requestIdleCallback(
          () => {
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
          },
          { timeout: 100 }
        );
      } else {
        setTimeout(() => {
          model.glbLights.forEach((light, index) => {
            const lightName = light.name || `light_${index}`;
            if (window.savedLightSettings[lightName]) {
              const saved = window.savedLightSettings[lightName];
              light.color.setRGB(saved.r, saved.g, saved.b);
              const clampedIntensity = Math.max(0, Math.min(saved.intensity ?? light.intensity, 10));
              light.intensity = clampedIntensity;
            }
          });
        }, 50);
      }
    }
  });

  // Update bloom settings
  import("../3d/postprocessing.js").then((postProc) => {
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

    // Update DOF settings
    const bokehPass = postProc.getBokehPass();
    if (bokehPass) {
      bokehPass.enabled = dofSettings.enabled !== false;
      if (dofSettings.enabled) {
        bokehPass.uniforms["focus"].value = dofSettings.focus;
        bokehPass.uniforms["aperture"].value = dofSettings.aperture;
        bokehPass.uniforms["maxblur"].value = dofSettings.maxblur;
      }
    }
  });
}

export async function reloadFromJSON() {
  await loadSettings(true);
  await applySettingsToScene();
}

/**
 * Randomize colors for Main_Structure, Chairs, and Floor
 */
export async function randomizeColors() {
  useDefaultColors = false;
  await applySettingsToScene();
}

/**
 * Reset to default colors
 */
export async function resetToDefaultColors() {
  useDefaultColors = true;
  await applySettingsToScene();
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
      dofSettings,
      pageColorSettings,
      scrollSettings,
      canvasSettings,
      screenSettings,
      textureRotationSettings,
      pageBackgroundSettings,
    };

    // Settings not saved to localStorage - use JSON defaults only
  } catch (error) {
    console.warn("Failed to collect settings:", error);
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
        dofSettings,
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
  } catch (error) {
    console.error("Failed to export settings file:", error);
  }
}
