import * as settings from "./settings.js";
import { setIsNightMode } from "./settings.js";
import { glbLights } from "./model.js";

export function createGradientOverlay() {
  // Gradients removed - no longer needed
}

export function updateGradientOverlay() {
  // Gradients removed - no longer needed
}

export function updateLightingForMode(glbLights) {
  const intensityMultiplier = settings.isNightMode ? 0.1 : 1.0;

  // Update GLB lights
  glbLights.forEach((light) => {
    if (window.savedLightSettings) {
      const lightName = light.name || `light_${glbLights.indexOf(light)}`;
      const saved = window.savedLightSettings[lightName];
      if (saved) {
        light.intensity = saved.intensity * intensityMultiplier;
      } else {
        light.intensity *= intensityMultiplier;
      }
    } else {
      light.intensity *= intensityMultiplier;
    }
  });
}

export function updateSiteColors() {
  const body = document.body;
  const infoPanel = document.getElementById("info-panel");

  if (!infoPanel) return;

  if (settings.isNightMode) {
    // Night mode: black background, white text
    body.classList.remove("day-mode");
    body.classList.add("night-mode");
    infoPanel.classList.remove("day-mode");
    infoPanel.classList.add("night-mode");
  } else {
    // Day mode: white background, black text (default)
    body.classList.remove("night-mode");
    body.classList.add("day-mode");
    infoPanel.classList.remove("night-mode");
    infoPanel.classList.add("day-mode");
  }
}

export function toggleDayNightMode(createColorGUICallback) {
  setIsNightMode(!settings.isNightMode);
  if (glbLights && glbLights.length > 0) {
    updateLightingForMode(glbLights);
  }
  updateSiteColors();
  // Refresh GUI to update button text and light intensity displays
  if (createColorGUICallback) {
    createColorGUICallback();
  }
}
