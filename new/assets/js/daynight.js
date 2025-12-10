import { canvasContainer } from "./scene.js";
import * as settings from "./settings.js";
import { setIsNightMode } from "./settings.js";
import { glbLights } from "./model.js";

let gradientOverlay = null;

export function createGradientOverlay() {
  const gradient = document.createElement("div");
  gradient.id = "gradient-overlay";
  gradient.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 30%;
    pointer-events: none;
    z-index: 100;
    transition: background 1s ease;
  `;
  updateGradientOverlay();
  canvasContainer.appendChild(gradient);
  gradientOverlay = gradient;
}

export function updateGradientOverlay() {
  if (!gradientOverlay) return;

  if (settings.isNightMode) {
    gradientOverlay.style.background = "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)";
  } else {
    gradientOverlay.style.background = "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)";
  }
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
    body.style.backgroundColor = "#000000";
    body.style.color = "#ffffff";
    infoPanel.style.backgroundColor = "#000000";
    infoPanel.style.color = "#ffffff";

    // Update all text elements in info panel
    const textElements = infoPanel.querySelectorAll("h1, h2, h3, p, strong");
    textElements.forEach((el) => {
      el.style.color = "#ffffff";
    });
  } else {
    // Day mode: white background, black text
    body.style.backgroundColor = "#000000"; // Keep body black (canvas background)
    body.style.color = "#ffffff";
    infoPanel.style.backgroundColor = "#ffffff";
    infoPanel.style.color = "#000000";

    // Update all text elements in info panel
    const textElements = infoPanel.querySelectorAll("h1, h2, h3, p, strong");
    textElements.forEach((el) => {
      el.style.color = "#000000";
    });
  }
}

export function toggleDayNightMode(createColorGUICallback) {
  setIsNightMode(!settings.isNightMode);
  updateGradientOverlay();
  if (glbLights && glbLights.length > 0) {
    updateLightingForMode(glbLights);
  }
  updateSiteColors();
  // Refresh GUI to update button text and light intensity displays
  if (createColorGUICallback) {
    createColorGUICallback();
  }
}
