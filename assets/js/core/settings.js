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
export let startCameraRotation = { x: -3, y: 0, z: 3.121154018741333 };
export let currentCameraPosition = { x: 0, y: 0, z: 0 };
export let currentCameraRotation = { x: 0, y: 0, z: 0 };
export let bloomSettings = {
  enabled: true,
  strength: 1.5,
  radius: 0.4,
  threshold: 0.85,
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
  defaultImage: "assets/img/background-dome-dreaming.jpg",
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
    } catch (error) {
      console.warn("Failed to load settings from localStorage:", error);
      // Apply default page colors on error
      applyPageColors();
    }
  } else if (jsonLoaded) {
    // Ensure page colors are applied after loading from JSON
    applyPageColors();
  }

  // Apply page backgrounds after loading settings
  applyPageBackgrounds();
}

/**
 * Predefined color palette: purple, teal/blue, orange-amber
 * Colors are in RGB 0-1 format for Three.js
 */
const COLOR_PALETTE = [
  // Purple
  { r: 0.4, g: 0.2, b: 0.6 },
  // Teal/Blue
  { r: 0.2, g: 0.5, b: 0.6 },
  // Orange-amber
  { r: 0.7, g: 0.4, b: 0.2 },
];

/**
 * Generate a random color from the predefined palette
 * Returns RGB values between 0 and 1
 */
function generateRandomMutedColor() {
  // Randomly select from the color palette
  const randomIndex = Math.floor(Math.random() * COLOR_PALETTE.length);
  return COLOR_PALETTE[randomIndex];
}

/**
 * Create a more muted version of a color for CSS backgrounds
 * Reduces saturation while maintaining better lightness for visibility
 */
function muteColorForCSS(color) {
  // Convert RGB to HSL for easier manipulation
  const threeColor = new THREE.Color(color.r, color.g, color.b);
  const hsl = { h: 0, s: 0, l: 0 };
  threeColor.getHSL(hsl);

  // Reduce saturation to 40-50% of original (more visible than before)
  const mutedSaturation = Math.max(0.15, hsl.s * 0.5); // Reduce saturation to 50% of original
  // Keep lightness in a better range (0.25-0.45) so colors are visible but still muted
  const mutedLightness = Math.max(0.25, Math.min(0.45, hsl.l * 1.1)); // Slightly lighter for visibility

  // Convert back to RGB
  const mutedColor = new THREE.Color();
  mutedColor.setHSL(hsl.h, mutedSaturation, mutedLightness);

  return {
    r: mutedColor.r,
    g: mutedColor.g,
    b: mutedColor.b,
  };
}

/**
 * Create a darker version of a color
 * @param {Object} color - Color object with r, g, b values (0-1)
 * @param {number} darkenFactor - Factor to darken by (0-1, lower = darker)
 * @returns {Object} Darker color object
 */
function darkenColor(color, darkenFactor = 0.5) {
  return {
    r: color.r * darkenFactor,
    g: color.g * darkenFactor,
    b: color.b * darkenFactor,
  };
}

/**
 * Mute a color by reducing saturation
 * @param {Object} color - Color object with r, g, b values (0-1)
 * @param {number} saturationFactor - Factor to reduce saturation by (0-1, lower = more muted)
 * @returns {Object} Muted color object
 */
function muteColor(color, saturationFactor = 0.3) {
  // Convert RGB to HSL, reduce saturation, convert back
  const threeColor = new THREE.Color(color.r, color.g, color.b);
  const hsl = { h: 0, s: 0, l: 0 };
  threeColor.getHSL(hsl);

  // Reduce saturation
  hsl.s = hsl.s * saturationFactor;

  // Convert back to RGB
  threeColor.setHSL(hsl.h, hsl.s, hsl.l);

  return {
    r: threeColor.r,
    g: threeColor.g,
    b: threeColor.b,
  };
}

/**
 * Apply Main_Structure color from 3D scene to alternating sections
 * Even sections (2, 4, 6): black → Main_Structure color
 * Odd sections (3, 5, 7): Main_Structure color → black
 */
function applyBackgroundColors() {
  // Helper function to convert RGB (0-1) to CSS rgb string
  const rgbToCSS = (color) => {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Get Main_Structure color directly from 3D scene material (more accurate than saved settings)
  let mainColor = null;

  // Try to get Main_Structure mesh from 3D scene and read its actual material color
  import("../3d/model.js").then((model) => {
    if (model.fbxMeshes && model.fbxMeshes.length > 0) {
      const mainMesh = model.fbxMeshes.find((item) => item.name === "Main_Structure");
      if (mainMesh) {
        const material = getMaterial(mainMesh.mesh);
        if (material && material.color) {
          // Read the actual color from the material (what's displayed in 3D)
          mainColor = {
            r: material.color.r,
            g: material.color.g,
            b: material.color.b,
          };
        }
      }
    }

    // Fallback to savedColorSettings if material color not available
    if (!mainColor) {
      if (window.savedColorSettings && window.savedColorSettings.Main_Structure) {
        mainColor = window.savedColorSettings.Main_Structure;
      } else {
        // If Main_Structure color not available yet, generate a random color as fallback
        mainColor = generateRandomMutedColor();
      }
    }

    // Create a muted version of the Main_Structure color for CSS backgrounds
    const mutedMainColor = muteColorForCSS(mainColor);

    // Set Main_Structure color CSS variable (muted version for backgrounds)
    // CSS nth-child selectors will automatically apply gradients to alternating sections
    document.documentElement.style.setProperty(`--bg-floor-color`, rgbToCSS(mutedMainColor));
  });
}

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

            // Generate random color for Main_Structure (interior), Floor, and Screen on each load
            if (item.name === "Main_Structure" || item.name === "Floor" || item.name === "Screen") {
              colorToApply = generateRandomMutedColor();
              // Update saved settings so it persists for this session
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
  });
}

export async function reloadFromJSON() {
  await loadSettings(true);
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
