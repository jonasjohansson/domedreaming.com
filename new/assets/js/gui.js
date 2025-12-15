import * as THREE from "three";
import GUI from "./libs/lil-gui/lil-gui.esm.min.js";
import { getMaterial, colorToHex } from "./utils.js";
import * as settings from "./settings.js";
import { camera } from "./scene.js";
import { fbxMeshes, glbLights } from "./model.js";
import { loadDefaultScreenTexture } from "./texture.js";

let gui = null;

export function createColorGUI() {
  if (gui) gui.destroy();

  if (fbxMeshes.length === 0) return;

  gui = new GUI({ title: "Controls", autoPlace: true });

  // Export settings button (at top level)
  const fileActions = {
    exportSettings: () => {
      settings.exportSettingsFile(fbxMeshes, glbLights);
    },
    reloadFromJSON: () => {
      settings.reloadFromJSON();
    },
  };
  gui.add(fileActions, "exportSettings").name("Export Settings File");
  gui.add(fileActions, "reloadFromJSON").name("Reload from JSON File");

  // ===== WEBSITE SECTION =====
  const websiteFolder = gui.addFolder("Website");
  websiteFolder.close();
  const pageColorsFolder = websiteFolder.addFolder("Page Colors");
  const getComputedColor = (property) => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
    // Convert CSS variable or hex to hex format
    if (value.startsWith("#")) return value;
    if (value.startsWith("rgb")) {
      // Convert rgb/rgba to hex
      const matches = value.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = parseInt(matches[0]).toString(16).padStart(2, "0");
        const g = parseInt(matches[1]).toString(16).padStart(2, "0");
        const b = parseInt(matches[2]).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
      }
    }
    // Default values
    if (property === "--color-bg") return "#000000";
    if (property === "--color-text") return "#ffffff";
    if (property === "--color-dot") return "#ffffff";
    if (property === "--color-bar") return "#333333";
    return "#000000";
  };

  const pageColorsObj = {
    backgroundColor: getComputedColor("--color-bg"),
    textColor: getComputedColor("--color-text"),
    dotColor: getComputedColor("--color-dot"),
    sidebarColor: getComputedColor("--color-bar"),
  };

  const sidebarVisibleObj = {
    visible: settings.pageColorSettings?.sidebarVisible !== false, // Default to true
  };

  const updateCSSVariable = (variable, hexColor) => {
    document.documentElement.style.setProperty(variable, hexColor);
  };

  // Load saved page colors if available
  if (settings.pageColorSettings) {
    if (settings.pageColorSettings.backgroundColor) {
      pageColorsObj.backgroundColor = settings.pageColorSettings.backgroundColor;
      updateCSSVariable("--color-bg", settings.pageColorSettings.backgroundColor);
      document.body.style.backgroundColor = settings.pageColorSettings.backgroundColor;
    }
    if (settings.pageColorSettings.textColor) {
      pageColorsObj.textColor = settings.pageColorSettings.textColor;
      updateCSSVariable("--color-text", settings.pageColorSettings.textColor);
      const main = document.querySelector("main");
      if (main) main.style.color = settings.pageColorSettings.textColor;
      const intro = document.querySelector("section.intro");
      if (intro) intro.style.color = settings.pageColorSettings.textColor;
      const introText = document.querySelector(".intro-text");
      if (introText) introText.style.color = settings.pageColorSettings.textColor;
    }
    if (settings.pageColorSettings.dotColor) {
      pageColorsObj.dotColor = settings.pageColorSettings.dotColor;
      updateCSSVariable("--color-dot", settings.pageColorSettings.dotColor);
    }
    if (settings.pageColorSettings.sidebarColor) {
      pageColorsObj.sidebarColor = settings.pageColorSettings.sidebarColor;
      updateCSSVariable("--color-bar", settings.pageColorSettings.sidebarColor);
    }
    if (settings.pageColorSettings.sidebarVisible !== undefined) {
      sidebarVisibleObj.visible = settings.pageColorSettings.sidebarVisible;
      const verticalBars = document.querySelector(".vertical-bars");
      if (verticalBars) {
        verticalBars.style.display = settings.pageColorSettings.sidebarVisible ? "block" : "none";
      }
    }
  }

  const bgColorControl = pageColorsFolder.addColor(pageColorsObj, "backgroundColor");
  bgColorControl.name("Background Color");
  bgColorControl.onChange((value) => {
    updateCSSVariable("--color-bg", value);
    document.body.style.backgroundColor = value;
    settings.pageColorSettings.backgroundColor = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  const textColorControl = pageColorsFolder.addColor(pageColorsObj, "textColor");
  textColorControl.name("Text Color");
  textColorControl.onChange((value) => {
    updateCSSVariable("--color-text", value);
    // Update all text elements
    const main = document.querySelector("main");
    if (main) main.style.color = value;
    const intro = document.querySelector("section.intro");
    if (intro) intro.style.color = value;
    const introText = document.querySelector(".intro-text");
    if (introText) introText.style.color = value;
    settings.pageColorSettings.textColor = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  const dotColorControl = pageColorsFolder.addColor(pageColorsObj, "dotColor");
  dotColorControl.name("Dot Color");
  dotColorControl.onChange((value) => {
    updateCSSVariable("--color-dot", value);
    // Update the dot pattern
    document.body.style.setProperty("--color-dot", value);
    settings.pageColorSettings.dotColor = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  const sidebarColorControl = pageColorsFolder.addColor(pageColorsObj, "sidebarColor");
  sidebarColorControl.name("Sidebar Color");
  sidebarColorControl.onChange((value) => {
    updateCSSVariable("--color-bar", value);
    settings.pageColorSettings.sidebarColor = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  const sidebarVisibleControl = pageColorsFolder.add(sidebarVisibleObj, "visible");
  sidebarVisibleControl.name("Sidebar Visible");
  sidebarVisibleControl.onChange((value) => {
    settings.pageColorSettings.sidebarVisible = value;
    const verticalBars = document.querySelector(".vertical-bars");
    if (verticalBars) {
      verticalBars.style.display = value ? "block" : "none";
    }
    settings.saveSettings(fbxMeshes, glbLights);
  });

  // Scroll increment settings
  const scrollFolder = websiteFolder.addFolder("Scroll Increment");
  const scrollObj = {
    enabled: settings.scrollSettings.enabled,
  };

  const scrollEnabledControl = scrollFolder.add(scrollObj, "enabled");
  scrollEnabledControl.name("Enabled");
  scrollEnabledControl.onChange((value) => {
    settings.scrollSettings.enabled = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  // Canvas blending mode (moved to Website section)
  const blendingModes = {
    normal: "normal",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    darken: "darken",
    lighten: "lighten",
    "color-dodge": "color-dodge",
    "color-burn": "color-burn",
    "hard-light": "hard-light",
    "soft-light": "soft-light",
    difference: "difference",
    exclusion: "exclusion",
  };

  const canvasObj = {
    blendMode: settings.pageColorSettings?.blendMode || "normal",
  };

  // Apply initial blend mode
  const canvasWrapper = document.querySelector(".canvas-wrapper");
  if (canvasWrapper && canvasObj.blendMode) {
    canvasWrapper.style.mixBlendMode = canvasObj.blendMode;
  }

  const blendControl = websiteFolder.add(canvasObj, "blendMode", Object.keys(blendingModes));
  blendControl.name("Canvas Blend Mode");
  blendControl.onChange((value) => {
    const canvasWrapper = document.querySelector(".canvas-wrapper");
    if (canvasWrapper) {
      canvasWrapper.style.mixBlendMode = value;
    }
    settings.pageColorSettings.blendMode = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  // Screen background image
  const screenFolder = websiteFolder.addFolder("Screen");
  const screenObj = {
    defaultImage: settings.screenSettings?.defaultImage || "assets/img/background-text.jpg",
  };
  const screenControl = screenFolder.add(screenObj, "defaultImage");
  screenControl.name("Background Image");
  screenControl.onFinishChange((value) => {
    settings.screenSettings.defaultImage = value;
    loadDefaultScreenTexture(value);
    settings.saveSettings(fbxMeshes, glbLights);
  });

  // Canvas vignette settings
  // Ensure vignette settings exist
  if (!settings.pageColorSettings.vignette) {
    settings.pageColorSettings.vignette = {
      enabled: true,
      size: 8,
      fadeWidth: 2,
    };
  }

  const vignetteObj = {
    enabled: settings.pageColorSettings.vignette.enabled,
    size: settings.pageColorSettings.vignette.size,
    fadeWidth: settings.pageColorSettings.vignette.fadeWidth,
  };

  // Apply initial vignette settings
  settings.applyVignetteSettings();

  const vignetteFolder = websiteFolder.addFolder("Canvas Vignette");

  const vignetteEnabledControl = vignetteFolder.add(vignetteObj, "enabled");
  vignetteEnabledControl.name("Enabled");
  vignetteEnabledControl.onChange((value) => {
    if (!settings.pageColorSettings.vignette) {
      settings.pageColorSettings.vignette = { enabled: true, size: 8, fadeWidth: 2 };
    }
    settings.pageColorSettings.vignette.enabled = value;
    settings.applyVignetteSettings();
    settings.saveSettings(fbxMeshes, glbLights);
  });

  const vignetteSizeControl = vignetteFolder.add(vignetteObj, "size", 0, 20, 0.5);
  vignetteSizeControl.name("Size (%)");
  vignetteSizeControl.onChange((value) => {
    if (!settings.pageColorSettings.vignette) {
      settings.pageColorSettings.vignette = { enabled: true, size: 8, fadeWidth: 2 };
    }
    settings.pageColorSettings.vignette.size = value;
    settings.applyVignetteSettings();
    settings.saveSettings(fbxMeshes, glbLights);
  });

  const vignetteFadeControl = vignetteFolder.add(vignetteObj, "fadeWidth", 0, 10, 0.5);
  vignetteFadeControl.name("Fade Width (%)");
  vignetteFadeControl.onChange((value) => {
    if (!settings.pageColorSettings.vignette) {
      settings.pageColorSettings.vignette = { enabled: true, size: 8, fadeWidth: 2 };
    }
    settings.pageColorSettings.vignette.fadeWidth = value;
    settings.applyVignetteSettings();
    settings.saveSettings(fbxMeshes, glbLights);
  });

  // ===== 3D SCENE SECTION =====
  const sceneFolder = gui.addFolder("3D Scene");
  sceneFolder.close();

  // Mesh colors
  const meshFolder = sceneFolder.addFolder("Mesh Colors");
  fbxMeshes.forEach((item, index) => {
    const mesh = item.mesh;
    const material = getMaterial(mesh);
    if (!material) return;

    if (!material.color) {
      material.color = new THREE.Color(0xffffff);
    }

    const meshName = item.name || `mesh_${index}`;
    let colorToUse = material.color;

    if (window.savedColorSettings?.[meshName]) {
      const saved = window.savedColorSettings[meshName];
      colorToUse = new THREE.Color(saved.r, saved.g, saved.b);
      material.color = colorToUse;
      material.needsUpdate = true;
    }

    const colorObj = { color: colorToHex(colorToUse) };
    const folder = meshFolder.addFolder(item.name || `Mesh ${index + 1}`);
    const colorControl = folder.addColor(colorObj, "color");

    colorControl.onChange((value) => {
      const newColor = new THREE.Color(value);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if (mat) {
            mat.color = newColor;
            mat.needsUpdate = true;
          }
        });
      } else if (mesh.material) {
        mesh.material.color = newColor;
        mesh.material.needsUpdate = true;
      }
      settings.saveSettings(fbxMeshes, glbLights);
    });

    folder.open();
  });

  const resetObj = {
    reset: () => {
      fbxMeshes.forEach((item) => {
        const material = getMaterial(item.mesh);
        if (material) {
          material.color = item.originalColor.clone();
          material.needsUpdate = true;
        }
      });
      settings.saveSettings(fbxMeshes, glbLights);
      createColorGUI();
    },
  };
  meshFolder.add(resetObj, "reset").name("Reset All Colors");
  meshFolder.open();

  // Light colors (if GLB lights exist)
  if (glbLights.length > 0) {
    console.log(`Creating GUI for ${glbLights.length} lights`);
    const lightFolder = sceneFolder.addFolder("GLB Lights");
    glbLights.forEach((light, index) => {
      const lightName = light.name || `Light ${index + 1}`;
      const lightType = light.constructor.name || "Light";

      // Apply saved light settings if available
      if (window.savedLightSettings?.[lightName]) {
        const saved = window.savedLightSettings[lightName];
        light.color.setRGB(saved.r, saved.g, saved.b);
        // Clamp to avoid extreme persisted values
        const clampedIntensity = Math.max(0, Math.min(saved.intensity ?? light.intensity, 10));
        light.intensity = clampedIntensity;
      }

      // Store original intensity (use saved if available, otherwise current)
      const originalIntensity = Math.max(0, Math.min(window.savedLightSettings?.[lightName]?.intensity ?? light.intensity, 10));

      const lightObj = {
        color: colorToHex(light.color),
        intensity: originalIntensity, // Use original intensity (not night-mode adjusted)
      };

      const folder = lightFolder.addFolder(`${lightName} (${lightType})`);
      const colorControl = folder.addColor(lightObj, "color");
      const intensityControl = folder.add(lightObj, "intensity", 0, 10, 0.1);

      colorControl.onChange((value) => {
        light.color.setHex(value.replace("#", "0x"));
        settings.saveSettings(fbxMeshes, glbLights);
      });

      intensityControl.onChange((value) => {
        light.intensity = value;
        settings.saveSettings(fbxMeshes, glbLights);
      });

      folder.open();
    });
    lightFolder.open();
  } else {
    console.log("No lights available for GUI - glbLights array is empty");
  }

  // Movement settings
  const movementFolder = sceneFolder.addFolder("Movement Settings");
  const moveSpeedObj = { moveSpeed: settings.moveSpeed };
  movementFolder
    .add(moveSpeedObj, "moveSpeed", 0.001, 0.2, 0.001)
    .name("Move Speed")
    .onChange((value) => {
      settings.setMoveSpeed(value);
      moveSpeedObj.moveSpeed = value; // Keep GUI in sync
      settings.saveSettings(fbxMeshes, glbLights);
    });
  movementFolder
    .add(settings.cameraSettings, "sensitivity", 0.0001, 0.01, 0.0001)
    .name("Mouse Sensitivity")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  movementFolder
    .add(settings.cameraSettings, "rotationSpeed", 30, 360, 10)
    .name("Q/E Rotation Speed (deg/sec)")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  movementFolder.open();

  // Camera settings
  const cameraFolder = sceneFolder.addFolder("Camera Settings");

  const startPosFolder = cameraFolder.addFolder("Starting Position");
  startPosFolder
    .add(settings.startCameraPosition, "x")
    .name("Start X")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  startPosFolder
    .add(settings.startCameraPosition, "y")
    .name("Start Y")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  startPosFolder
    .add(settings.startCameraPosition, "z")
    .name("Start Z")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));

  const startRotFolder = cameraFolder.addFolder("Starting Rotation");
  startRotFolder
    .add(settings.startCameraRotation, "x")
    .name("Start Rot X")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  startRotFolder
    .add(settings.startCameraRotation, "y")
    .name("Start Rot Y")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  startRotFolder
    .add(settings.startCameraRotation, "z")
    .name("Start Rot Z")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));

  const currentPosFolder = cameraFolder.addFolder("Current Position");
  currentPosFolder.add(settings.currentCameraPosition, "x").name("Current X").listen();
  currentPosFolder.add(settings.currentCameraPosition, "y").name("Current Y").listen();
  currentPosFolder.add(settings.currentCameraPosition, "z").name("Current Z").listen();

  const currentRotFolder = cameraFolder.addFolder("Current Rotation");
  currentRotFolder.add(settings.currentCameraRotation, "x").name("Current Rot X").listen();
  currentRotFolder.add(settings.currentCameraRotation, "y").name("Current Rot Y").listen();
  currentRotFolder.add(settings.currentCameraRotation, "z").name("Current Rot Z").listen();

  const cameraActions = {
    copyCurrentToStart: () => {
      Object.assign(settings.startCameraPosition, settings.currentCameraPosition);
      Object.assign(settings.startCameraRotation, settings.currentCameraRotation);
      settings.saveSettings(fbxMeshes, glbLights);
      createColorGUI();
    },
    logCurrentValues: () => {
      console.log("Camera Position:", camera.position);
      console.log("Camera Rotation:", camera.rotation);
    },
  };

  cameraFolder.add(cameraActions, "copyCurrentToStart").name("Copy Current → Start");
  cameraFolder.add(cameraActions, "logCurrentValues").name("Log Current Values");
  cameraFolder.open();

  // Post-processing settings
  const postProcFolder = sceneFolder.addFolder("Post-Processing");
  import("./postprocessing.js").then((postProc) => {
    const bloomPass = postProc.getBloomPass();
    if (bloomPass) {
      const bloomObj = {
        strength: bloomPass.strength,
        radius: bloomPass.radius,
        threshold: bloomPass.threshold,
      };

      const saveBloomSettings = () => {
        settings.saveSettings(fbxMeshes, glbLights);
      };

      postProcFolder
        .add(bloomObj, "strength", 0, 3, 0.1)
        .name("Bloom Strength")
        .onChange((value) => {
          bloomPass.strength = value;
          settings.bloomSettings.strength = value;
          saveBloomSettings();
        });
      postProcFolder
        .add(bloomObj, "radius", 0, 2, 0.1)
        .name("Bloom Radius")
        .onChange((value) => {
          bloomPass.radius = value;
          settings.bloomSettings.radius = value;
          saveBloomSettings();
        });
      postProcFolder
        .add(bloomObj, "threshold", 0, 2, 0.1)
        .name("Bloom Threshold")
        .onChange((value) => {
          bloomPass.threshold = value;
          settings.bloomSettings.threshold = value;
          saveBloomSettings();
        });
    }
    postProcFolder.open();
  });

  // LED Strip animation settings
  const ledFolder = sceneFolder.addFolder("LED Strip Animation");
  import("./led-strip.js").then((ledStrip) => {
    // Ensure settings are loaded
    ledStrip.loadLEDStripSettings();

    const ledAnimObj = {
      pulseSpeed: ledStrip.pulseSpeed,
      pulseWidth: ledStrip.pulseWidth,
      baseIntensity: ledStrip.baseIntensity,
      maxIntensity: ledStrip.maxIntensity,
      mirrored: ledStrip.mirrored,
      rimVisible: settings.ledStripSettings.rimVisible !== false, // Default to true
      hueStart: ledStrip.colorPalette.hueStart,
      hueRange: ledStrip.colorPalette.hueRange,
      saturation: ledStrip.colorPalette.saturation,
      lightness: ledStrip.colorPalette.lightness,
    };

    const pulseFolder = ledFolder.addFolder("Pulse Settings");
    pulseFolder
      .add(ledAnimObj, "pulseSpeed", 0.1, 10, 0.1)
      .name("Pulse Speed")
      .onChange((value) => {
        ledStrip.setPulseSpeed(value);
      });
    pulseFolder
      .add(ledAnimObj, "pulseWidth", 0.1, 1.0, 0.05)
      .name("Pulse Width")
      .onChange((value) => {
        ledStrip.setPulseWidth(value);
      });
    pulseFolder
      .add(ledAnimObj, "baseIntensity", 0.1, 2.0, 0.1)
      .name("Base Intensity")
      .onChange((value) => {
        ledStrip.setBaseIntensity(value);
      });
    pulseFolder
      .add(ledAnimObj, "maxIntensity", 1.0, 10.0, 0.5)
      .name("Max Intensity")
      .onChange((value) => {
        ledStrip.setMaxIntensity(value);
      });
    pulseFolder
      .add(ledAnimObj, "mirrored")
      .name("Mirror Animation")
      .onChange((value) => {
        ledStrip.setMirrored(value);
      });
    pulseFolder.open();

    const rimControl = ledFolder.add(ledAnimObj, "rimVisible");
    rimControl.name("Rim Visible");
    rimControl.onChange((value) => {
      settings.ledStripSettings.rimVisible = value;
      ledStrip.setRimVisible(value);
      settings.saveSettings(fbxMeshes, glbLights);
    });

    const colorFolder = ledFolder.addFolder("Color Palette");
    colorFolder
      .add(ledAnimObj, "hueStart", 0, 1, 0.01)
      .name("Hue Start")
      .onChange((value) => {
        ledStrip.setColorPalette(value, ledStrip.colorPalette.hueRange, ledStrip.colorPalette.saturation, ledStrip.colorPalette.lightness);
      });
    colorFolder
      .add(ledAnimObj, "hueRange", 0, 1, 0.01)
      .name("Hue Range")
      .onChange((value) => {
        ledStrip.setColorPalette(ledStrip.colorPalette.hueStart, value, ledStrip.colorPalette.saturation, ledStrip.colorPalette.lightness);
      });
    colorFolder
      .add(ledAnimObj, "saturation", 0, 1, 0.01)
      .name("Saturation")
      .onChange((value) => {
        ledStrip.setColorPalette(ledStrip.colorPalette.hueStart, ledStrip.colorPalette.hueRange, value, ledStrip.colorPalette.lightness);
      });
    colorFolder
      .add(ledAnimObj, "lightness", 0, 1, 0.01)
      .name("Lightness")
      .onChange((value) => {
        ledStrip.setColorPalette(ledStrip.colorPalette.hueStart, ledStrip.colorPalette.hueRange, ledStrip.colorPalette.saturation, value);
      });
    colorFolder.open();
    ledFolder.open();
  });
}
