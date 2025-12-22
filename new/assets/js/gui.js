import * as THREE from "three";
import GUI from "./libs/lil-gui/lil-gui.esm.min.js";
import { getMaterial, colorToHex } from "./3d/utils.js";
import * as settings from "./settings.js";
import { camera } from "./3d/scene.js";
import { fbxMeshes, glbLights } from "./3d/model.js";
import { loadDefaultScreenTexture } from "./3d/texture.js";

let gui = null;
let guiVisible = false;
let guiKeyListenerAttached = false;

export function createColorGUI() {
  if (gui) gui.destroy();

  if (fbxMeshes.length === 0) return;

  gui = new GUI({ title: "Controls", autoPlace: true });

  // Hide GUI by default
  guiVisible = false;
  gui.domElement.style.display = "none";

  // Global keyboard toggle: press "G" to show/hide GUI
  if (!guiKeyListenerAttached) {
    guiKeyListenerAttached = true;
    window.addEventListener("keydown", (event) => {
      if (event.key === "g" || event.key === "G") {
        // Prevent interfering with form inputs etc. only if no modifier keys
        if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.isContentEditable)) {
          return;
        }
        guiVisible = !guiVisible;
        if (gui) {
          gui.domElement.style.display = guiVisible ? "" : "none";
        }
      }
    });
  }

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
  }

  const dotColorControl = pageColorsFolder.addColor(pageColorsObj, "dotColor");
  dotColorControl.name("Dot Color");
  dotColorControl.onChange((value) => {
    updateCSSVariable("--color-dot", value);
    // Update the dot pattern
    document.body.style.setProperty("--color-dot", value);
    settings.pageColorSettings.dotColor = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  // No sidebar or header island controls – layout simplified

  // Scroll increment settings - DISABLED (removed scroll increment functionality)
  // const scrollFolder = websiteFolder.addFolder("Scroll Increment");
  // const scrollObj = {
  //   enabled: settings.scrollSettings.enabled,
  // };

  // const scrollEnabledControl = scrollFolder.add(scrollObj, "enabled");
  // scrollEnabledControl.name("Enabled");
  // scrollEnabledControl.onChange((value) => {
  //   settings.scrollSettings.enabled = value;
  //   settings.saveSettings(fbxMeshes, glbLights);
  // });

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

  // Texture rotation controls
  const textureRotationObj = {
    enabled: settings.textureRotationSettings?.enabled || false,
    speed: settings.textureRotationSettings?.speed || 0.1,
    direction: settings.textureRotationSettings?.direction || 1,
  };

  const rotationEnabledControl = screenFolder.add(textureRotationObj, "enabled");
  rotationEnabledControl.name("Texture Rotation Enabled");
  rotationEnabledControl.onChange((value) => {
    settings.textureRotationSettings.enabled = value;
    settings.saveSettings(fbxMeshes, glbLights);
  });

  screenFolder
    .add(textureRotationObj, "speed", 0, 2, 0.01)
    .name("Rotation Speed (rad/s)")
    .onChange((value) => {
      settings.textureRotationSettings.speed = value;
      settings.saveSettings(fbxMeshes, glbLights);
    });

  screenFolder
    .add(textureRotationObj, "direction", { Clockwise: 1, "Counter-Clockwise": -1 })
    .name("Rotation Direction")
    .onChange((value) => {
      settings.textureRotationSettings.direction = value;
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
  vignetteFolder.close();

  // Page Backgrounds
  const pageBackgroundsFolder = websiteFolder.addFolder("Page Backgrounds");

  // Helper function to handle image upload
  function handleImageUpload(pageName, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      settings.pageBackgroundSettings[pageName].backgroundImage = dataUrl;
      settings.applyPageBackgrounds();
      settings.saveSettings(fbxMeshes, glbLights);
    };
    reader.readAsDataURL(file);
  }

  // Canvas page background
  const canvasPageFolder = pageBackgroundsFolder.addFolder("Canvas Page");
  const canvasPageObj = {
    backgroundColor: settings.pageBackgroundSettings?.canvas?.backgroundColor || "#000000",
    uploadImage: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImageUpload("canvas", file);
      };
      input.click();
    },
    clearImage: () => {
      settings.pageBackgroundSettings.canvas.backgroundImage = null;
      settings.applyPageBackgrounds();
      settings.saveSettings(fbxMeshes, glbLights);
    },
  };
  const canvasBgColorControl = canvasPageFolder.addColor(canvasPageObj, "backgroundColor");
  canvasBgColorControl.name("Background Color");
  canvasBgColorControl.onChange((value) => {
    settings.pageBackgroundSettings.canvas.backgroundColor = value;
    settings.applyPageBackgrounds();
    settings.saveSettings(fbxMeshes, glbLights);
  });
  canvasPageFolder.add(canvasPageObj, "uploadImage").name("Upload Image");
  canvasPageFolder.add(canvasPageObj, "clearImage").name("Clear Image");

  // About page background
  const aboutPageFolder = pageBackgroundsFolder.addFolder("About Page");
  const aboutPageObj = {
    backgroundColor: settings.pageBackgroundSettings?.about?.backgroundColor || "#000000",
    uploadImage: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImageUpload("about", file);
      };
      input.click();
    },
    clearImage: () => {
      settings.pageBackgroundSettings.about.backgroundImage = null;
      settings.applyPageBackgrounds();
      settings.saveSettings(fbxMeshes, glbLights);
    },
  };
  const aboutBgColorControl = aboutPageFolder.addColor(aboutPageObj, "backgroundColor");
  aboutBgColorControl.name("Background Color");
  aboutBgColorControl.onChange((value) => {
    settings.pageBackgroundSettings.about.backgroundColor = value;
    settings.applyPageBackgrounds();
    settings.saveSettings(fbxMeshes, glbLights);
  });
  aboutPageFolder.add(aboutPageObj, "uploadImage").name("Upload Image");
  aboutPageFolder.add(aboutPageObj, "clearImage").name("Clear Image");

  // Team page background
  const teamPageFolder = pageBackgroundsFolder.addFolder("Team Page");
  const teamPageObj = {
    backgroundColor: settings.pageBackgroundSettings?.team?.backgroundColor || "#000000",
    uploadImage: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleImageUpload("team", file);
      };
      input.click();
    },
    clearImage: () => {
      settings.pageBackgroundSettings.team.backgroundImage = null;
      settings.applyPageBackgrounds();
      settings.saveSettings(fbxMeshes, glbLights);
    },
  };
  const teamBgColorControl = teamPageFolder.addColor(teamPageObj, "backgroundColor");
  teamBgColorControl.name("Background Color");
  teamBgColorControl.onChange((value) => {
    settings.pageBackgroundSettings.team.backgroundColor = value;
    settings.applyPageBackgrounds();
    settings.saveSettings(fbxMeshes, glbLights);
  });
  teamPageFolder.add(teamPageObj, "uploadImage").name("Upload Image");
  teamPageFolder.add(teamPageObj, "clearImage").name("Clear Image");

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

  // Camera Debug Mode - Manual positioning
  const cameraDebugFolder = cameraFolder.addFolder("Camera Debug (Manual Control)");
  cameraDebugFolder.open();

  // Debug mode state
  let cameraDebugMode = false;
  let cameraLookAtEnabled = false;
  const domeCenterDebug = { x: 0, y: 5, z: 0 };

  // Manual camera position controls
  const manualCameraPos = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };

  // Manual camera rotation controls
  const manualCameraRot = {
    x: camera.rotation.x,
    y: camera.rotation.y,
    z: camera.rotation.z,
  };

  const debugPosFolder = cameraDebugFolder.addFolder("Manual Position");
  const posXControl = debugPosFolder.add(manualCameraPos, "x", -50, 50, 0.1).name("X");
  const posYControl = debugPosFolder.add(manualCameraPos, "y", -50, 50, 0.1).name("Y");
  const posZControl = debugPosFolder.add(manualCameraPos, "z", -50, 50, 0.1).name("Z");

  const updateManualPosition = () => {
    if (cameraDebugMode) {
      camera.position.set(manualCameraPos.x, manualCameraPos.y, manualCameraPos.z);
      if (cameraLookAtEnabled) {
        camera.lookAt(new THREE.Vector3(domeCenterDebug.x, domeCenterDebug.y, domeCenterDebug.z));
        // Update rotation display after lookAt
        manualCameraRot.x = camera.rotation.x;
        manualCameraRot.y = camera.rotation.y;
        manualCameraRot.z = camera.rotation.z;
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
      // Update current position display
      settings.currentCameraPosition.x = camera.position.x;
      settings.currentCameraPosition.y = camera.position.y;
      settings.currentCameraPosition.z = camera.position.z;
    }
  };

  posXControl.onChange(updateManualPosition);
  posYControl.onChange(updateManualPosition);
  posZControl.onChange(updateManualPosition);

  const debugRotFolder = cameraDebugFolder.addFolder("Manual Rotation");
  const rotXControl = debugRotFolder.add(manualCameraRot, "x", -Math.PI, Math.PI, 0.01).name("Rot X");
  const rotYControl = debugRotFolder.add(manualCameraRot, "y", -Math.PI, Math.PI, 0.01).name("Rot Y");
  const rotZControl = debugRotFolder.add(manualCameraRot, "z", -Math.PI, Math.PI, 0.01).name("Rot Z");

  const updateManualRotation = () => {
    if (cameraDebugMode && !cameraLookAtEnabled) {
      camera.rotation.set(manualCameraRot.x, manualCameraRot.y, manualCameraRot.z);
      // Update current rotation display
      settings.currentCameraRotation.x = camera.rotation.x;
      settings.currentCameraRotation.y = camera.rotation.y;
      settings.currentCameraRotation.z = camera.rotation.z;
    }
  };

  rotXControl.onChange(updateManualRotation);
  rotYControl.onChange(updateManualRotation);
  rotZControl.onChange(updateManualRotation);

  // LookAt controls
  const lookAtFolder = cameraDebugFolder.addFolder("LookAt Target");
  lookAtFolder
    .add(domeCenterDebug, "x", -50, 50, 0.1)
    .name("Center X")
    .onChange(() => {
      if (cameraDebugMode && cameraLookAtEnabled) {
        camera.lookAt(new THREE.Vector3(domeCenterDebug.x, domeCenterDebug.y, domeCenterDebug.z));
        manualCameraRot.x = camera.rotation.x;
        manualCameraRot.y = camera.rotation.y;
        manualCameraRot.z = camera.rotation.z;
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
    });
  lookAtFolder
    .add(domeCenterDebug, "y", -50, 50, 0.1)
    .name("Center Y")
    .onChange(() => {
      if (cameraDebugMode && cameraLookAtEnabled) {
        camera.lookAt(new THREE.Vector3(domeCenterDebug.x, domeCenterDebug.y, domeCenterDebug.z));
        manualCameraRot.x = camera.rotation.x;
        manualCameraRot.y = camera.rotation.y;
        manualCameraRot.z = camera.rotation.z;
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
    });
  lookAtFolder
    .add(domeCenterDebug, "z", -50, 50, 0.1)
    .name("Center Z")
    .onChange(() => {
      if (cameraDebugMode && cameraLookAtEnabled) {
        camera.lookAt(new THREE.Vector3(domeCenterDebug.x, domeCenterDebug.y, domeCenterDebug.z));
        manualCameraRot.x = camera.rotation.x;
        manualCameraRot.y = camera.rotation.y;
        manualCameraRot.z = camera.rotation.z;
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
    });

  // Enable/disable debug mode
  const debugModeObj = { enabled: cameraDebugMode };
  const debugModeControl = cameraDebugFolder.add(debugModeObj, "enabled").name("Enable Debug Mode");
  debugModeControl.onChange((value) => {
    cameraDebugMode = value;
    window.cameraDebugControls.enabled = value;
    if (value) {
      // Sync manual controls with current camera
      manualCameraPos.x = camera.position.x;
      manualCameraPos.y = camera.position.y;
      manualCameraPos.z = camera.position.z;
      manualCameraRot.x = camera.rotation.x;
      manualCameraRot.y = camera.rotation.y;
      manualCameraRot.z = camera.rotation.z;
      posXControl.updateDisplay();
      posYControl.updateDisplay();
      posZControl.updateDisplay();
      rotXControl.updateDisplay();
      rotYControl.updateDisplay();
      rotZControl.updateDisplay();
      // Update rotation controls state
      rotXControl.disable(cameraLookAtEnabled);
      rotYControl.disable(cameraLookAtEnabled);
      rotZControl.disable(cameraLookAtEnabled);
    }
  });

  // Toggle lookAt
  const lookAtControlObj = { enabled: cameraLookAtEnabled };
  const lookAtControl = cameraDebugFolder.add(lookAtControlObj, "enabled").name("Use LookAt");
  lookAtControl.onChange((value) => {
    cameraLookAtEnabled = value;
    window.cameraDebugControls.lookAtEnabled = value;
    if (cameraDebugMode) {
      if (value) {
        camera.lookAt(new THREE.Vector3(domeCenterDebug.x, domeCenterDebug.y, domeCenterDebug.z));
        manualCameraRot.x = camera.rotation.x;
        manualCameraRot.y = camera.rotation.y;
        manualCameraRot.z = camera.rotation.z;
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
      // Disable rotation controls when lookAt is enabled
      rotXControl.disable(value);
      rotYControl.disable(value);
      rotZControl.disable(value);
    }
  });

  // Initially disable rotation controls if lookAt starts enabled
  if (cameraLookAtEnabled) {
    rotXControl.disable(true);
    rotYControl.disable(true);
    rotZControl.disable(true);
  }

  // Camera position/rotation capture buttons
  const captureActions = {
    captureToStart: () => {
      settings.startCameraPosition.x = camera.position.x;
      settings.startCameraPosition.y = camera.position.y;
      settings.startCameraPosition.z = camera.position.z;
      settings.startCameraRotation.x = camera.rotation.x;
      settings.startCameraRotation.y = camera.rotation.y;
      settings.startCameraRotation.z = camera.rotation.z;
      settings.saveSettings(fbxMeshes, glbLights);
      createColorGUI();
    },
    captureToExterior: () => {
      settings.exteriorCameraPosition.x = camera.position.x;
      settings.exteriorCameraPosition.y = camera.position.y;
      settings.exteriorCameraPosition.z = camera.position.z;
      settings.exteriorCameraRotation.x = camera.rotation.x;
      settings.exteriorCameraRotation.y = camera.rotation.y;
      settings.exteriorCameraRotation.z = camera.rotation.z;
      settings.saveSettings(fbxMeshes, glbLights);
      createColorGUI();
    },
    loadStart: () => {
      if (cameraDebugMode) {
        manualCameraPos.x = settings.startCameraPosition.x;
        manualCameraPos.y = settings.startCameraPosition.y;
        manualCameraPos.z = settings.startCameraPosition.z;
        manualCameraRot.x = settings.startCameraRotation.x;
        manualCameraRot.y = settings.startCameraRotation.y;
        manualCameraRot.z = settings.startCameraRotation.z;
        updateManualPosition();
        if (!cameraLookAtEnabled) {
          updateManualRotation();
        }
        posXControl.updateDisplay();
        posYControl.updateDisplay();
        posZControl.updateDisplay();
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
    },
    loadExterior: () => {
      if (cameraDebugMode) {
        manualCameraPos.x = settings.exteriorCameraPosition.x;
        manualCameraPos.y = settings.exteriorCameraPosition.y;
        manualCameraPos.z = settings.exteriorCameraPosition.z;
        manualCameraRot.x = settings.exteriorCameraRotation.x;
        manualCameraRot.y = settings.exteriorCameraRotation.y;
        manualCameraRot.z = settings.exteriorCameraRotation.z;
        updateManualPosition();
        if (!cameraLookAtEnabled) {
          updateManualRotation();
        }
        posXControl.updateDisplay();
        posYControl.updateDisplay();
        posZControl.updateDisplay();
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
    },
  };

  const captureFolder = cameraDebugFolder.addFolder("Capture & Load");
  captureFolder.add(captureActions, "captureToStart").name("Capture → Start (Interior)");
  captureFolder.add(captureActions, "captureToExterior").name("Capture → Exterior");
  captureFolder.add(captureActions, "loadStart").name("Load Start Position");
  captureFolder.add(captureActions, "loadExterior").name("Load Exterior Position");

  // Store controls for update loop
  window.cameraDebugControls = {
    enabled: cameraDebugMode,
    lookAtEnabled: cameraLookAtEnabled,
    setEnabled: (value) => {
      cameraDebugMode = value;
      window.cameraDebugControls.enabled = value;
      debugModeControl.setValue(value);
    },
    update: () => {
      if (cameraDebugMode) {
        // Update manual controls from camera (for live updates)
        manualCameraPos.x = camera.position.x;
        manualCameraPos.y = camera.position.y;
        manualCameraPos.z = camera.position.z;
        manualCameraRot.x = camera.rotation.x;
        manualCameraRot.y = camera.rotation.y;
        manualCameraRot.z = camera.rotation.z;
        posXControl.updateDisplay();
        posYControl.updateDisplay();
        posZControl.updateDisplay();
        rotXControl.updateDisplay();
        rotYControl.updateDisplay();
        rotZControl.updateDisplay();
      }
    },
  };

  // Original camera settings (for reference)
  const startPosFolder = cameraFolder.addFolder("Starting Position (Interior)");
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

  const startRotFolder = cameraFolder.addFolder("Starting Rotation (Interior)");
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

  const exteriorPosFolder = cameraFolder.addFolder("Exterior Position");
  exteriorPosFolder
    .add(settings.exteriorCameraPosition, "x")
    .name("Exterior X")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  exteriorPosFolder
    .add(settings.exteriorCameraPosition, "y")
    .name("Exterior Y")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  exteriorPosFolder
    .add(settings.exteriorCameraPosition, "z")
    .name("Exterior Z")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));

  const exteriorRotFolder = cameraFolder.addFolder("Exterior Rotation");
  exteriorRotFolder
    .add(settings.exteriorCameraRotation, "x")
    .name("Exterior Rot X")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  exteriorRotFolder
    .add(settings.exteriorCameraRotation, "y")
    .name("Exterior Rot Y")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));
  exteriorRotFolder
    .add(settings.exteriorCameraRotation, "z")
    .name("Exterior Rot Z")
    .onChange(() => settings.saveSettings(fbxMeshes, glbLights));

  const currentPosFolder = cameraFolder.addFolder("Current Position");
  currentPosFolder.add(settings.currentCameraPosition, "x").name("Current X").listen();
  currentPosFolder.add(settings.currentCameraPosition, "y").name("Current Y").listen();
  currentPosFolder.add(settings.currentCameraPosition, "z").name("Current Z").listen();

  const currentRotFolder = cameraFolder.addFolder("Current Rotation");
  currentRotFolder.add(settings.currentCameraRotation, "x").name("Current Rot X").listen();
  currentRotFolder.add(settings.currentCameraRotation, "y").name("Current Rot Y").listen();
  currentRotFolder.add(settings.currentCameraRotation, "z").name("Current Rot Z").listen();

  // ===== CAMERA TRANSITION DEBUG TOOL =====
  const transitionDebugFolder = cameraFolder.addFolder("Camera Transition Debug");
  transitionDebugFolder.open();

  // Transition debug settings
  const transitionDebugSettings = {
    // Start (Exterior) position
    startPosX: settings.exteriorCameraPosition.x,
    startPosY: settings.exteriorCameraPosition.y,
    startPosZ: settings.exteriorCameraPosition.z,
    // Start (Exterior) rotation
    startRotX: settings.exteriorCameraRotation.x,
    startRotY: settings.exteriorCameraRotation.y,
    startRotZ: settings.exteriorCameraRotation.z,
    // End (Interior) position
    endPosX: settings.startCameraPosition.x,
    endPosY: settings.startCameraPosition.y,
    endPosZ: settings.startCameraPosition.z,
    // End (Interior) rotation
    endRotX: settings.startCameraRotation.x,
    endRotY: settings.startCameraRotation.y,
    endRotZ: settings.startCameraRotation.z,
    // Slerp options for position
    slerpPosX: true,
    slerpPosY: true,
    slerpPosZ: true,
    // Slerp options for rotation
    slerpRotX: true,
    slerpRotY: true,
    slerpRotZ: true,
    // Easing function
    easingFunction: "easeInOutCubic",
  };

  // Start Position Controls
  const transitionStartPosFolder = transitionDebugFolder.addFolder("Start Position (Exterior)");
  transitionStartPosFolder
    .add(transitionDebugSettings, "startPosX", -100, 100, 0.1)
    .name("X")
    .onChange(() => {
      settings.exteriorCameraPosition.x = transitionDebugSettings.startPosX;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionStartPosFolder
    .add(transitionDebugSettings, "startPosY", -100, 100, 0.1)
    .name("Y")
    .onChange(() => {
      settings.exteriorCameraPosition.y = transitionDebugSettings.startPosY;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionStartPosFolder
    .add(transitionDebugSettings, "startPosZ", -100, 100, 0.1)
    .name("Z")
    .onChange(() => {
      settings.exteriorCameraPosition.z = transitionDebugSettings.startPosZ;
      settings.saveSettings(fbxMeshes, glbLights);
    });

  // Start Rotation Controls
  const transitionStartRotFolder = transitionDebugFolder.addFolder("Start Rotation (Exterior)");
  transitionStartRotFolder
    .add(transitionDebugSettings, "startRotX", -Math.PI, Math.PI, 0.01)
    .name("Rot X")
    .onChange(() => {
      settings.exteriorCameraRotation.x = transitionDebugSettings.startRotX;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionStartRotFolder
    .add(transitionDebugSettings, "startRotY", -Math.PI, Math.PI, 0.01)
    .name("Rot Y")
    .onChange(() => {
      settings.exteriorCameraRotation.y = transitionDebugSettings.startRotY;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionStartRotFolder
    .add(transitionDebugSettings, "startRotZ", -Math.PI, Math.PI, 0.01)
    .name("Rot Z")
    .onChange(() => {
      settings.exteriorCameraRotation.z = transitionDebugSettings.startRotZ;
      settings.saveSettings(fbxMeshes, glbLights);
    });

  // End Position Controls
  const transitionEndPosFolder = transitionDebugFolder.addFolder("End Position (Interior)");
  transitionEndPosFolder
    .add(transitionDebugSettings, "endPosX", -100, 100, 0.1)
    .name("X")
    .onChange(() => {
      settings.startCameraPosition.x = transitionDebugSettings.endPosX;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionEndPosFolder
    .add(transitionDebugSettings, "endPosY", -100, 100, 0.1)
    .name("Y")
    .onChange(() => {
      settings.startCameraPosition.y = transitionDebugSettings.endPosY;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionEndPosFolder
    .add(transitionDebugSettings, "endPosZ", -100, 100, 0.1)
    .name("Z")
    .onChange(() => {
      settings.startCameraPosition.z = transitionDebugSettings.endPosZ;
      settings.saveSettings(fbxMeshes, glbLights);
    });

  // End Rotation Controls
  const transitionEndRotFolder = transitionDebugFolder.addFolder("End Rotation (Interior)");
  transitionEndRotFolder
    .add(transitionDebugSettings, "endRotX", -Math.PI, Math.PI, 0.01)
    .name("Rot X")
    .onChange(() => {
      settings.startCameraRotation.x = transitionDebugSettings.endRotX;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionEndRotFolder
    .add(transitionDebugSettings, "endRotY", -Math.PI, Math.PI, 0.01)
    .name("Rot Y")
    .onChange(() => {
      settings.startCameraRotation.y = transitionDebugSettings.endRotY;
      settings.saveSettings(fbxMeshes, glbLights);
    });
  transitionEndRotFolder
    .add(transitionDebugSettings, "endRotZ", -Math.PI, Math.PI, 0.01)
    .name("Rot Z")
    .onChange(() => {
      settings.startCameraRotation.z = transitionDebugSettings.endRotZ;
      settings.saveSettings(fbxMeshes, glbLights);
    });

  // Slerp Options for Position
  const slerpPosFolder = transitionDebugFolder.addFolder("Slerp Position Axes");
  slerpPosFolder
    .add(transitionDebugSettings, "slerpPosX")
    .name("Slerp X")
    .onChange(() => {
      if (window.cameraTransitionDebug) {
        window.cameraTransitionDebug.slerpPosX = transitionDebugSettings.slerpPosX;
      }
    });
  slerpPosFolder
    .add(transitionDebugSettings, "slerpPosY")
    .name("Slerp Y")
    .onChange(() => {
      if (window.cameraTransitionDebug) {
        window.cameraTransitionDebug.slerpPosY = transitionDebugSettings.slerpPosY;
      }
    });
  slerpPosFolder
    .add(transitionDebugSettings, "slerpPosZ")
    .name("Slerp Z")
    .onChange(() => {
      if (window.cameraTransitionDebug) {
        window.cameraTransitionDebug.slerpPosZ = transitionDebugSettings.slerpPosZ;
      }
    });

  // Slerp Options for Rotation
  const slerpRotFolder = transitionDebugFolder.addFolder("Slerp Rotation Axes");
  slerpRotFolder
    .add(transitionDebugSettings, "slerpRotX")
    .name("Slerp Rot X")
    .onChange(() => {
      if (window.cameraTransitionDebug) {
        window.cameraTransitionDebug.slerpRotX = transitionDebugSettings.slerpRotX;
      }
    });
  slerpRotFolder
    .add(transitionDebugSettings, "slerpRotY")
    .name("Slerp Rot Y")
    .onChange(() => {
      if (window.cameraTransitionDebug) {
        window.cameraTransitionDebug.slerpRotY = transitionDebugSettings.slerpRotY;
      }
    });
  slerpRotFolder
    .add(transitionDebugSettings, "slerpRotZ")
    .name("Slerp Rot Z")
    .onChange(() => {
      if (window.cameraTransitionDebug) {
        window.cameraTransitionDebug.slerpRotZ = transitionDebugSettings.slerpRotZ;
      }
    });

  // Sync initial values from settings
  transitionDebugSettings.startPosX = settings.exteriorCameraPosition.x;
  transitionDebugSettings.startPosY = settings.exteriorCameraPosition.y;
  transitionDebugSettings.startPosZ = settings.exteriorCameraPosition.z;
  transitionDebugSettings.startRotX = settings.exteriorCameraRotation.x;
  transitionDebugSettings.startRotY = settings.exteriorCameraRotation.y;
  transitionDebugSettings.startRotZ = settings.exteriorCameraRotation.z;
  transitionDebugSettings.endPosX = settings.startCameraPosition.x;
  transitionDebugSettings.endPosY = settings.startCameraPosition.y;
  transitionDebugSettings.endPosZ = settings.startCameraPosition.z;
  transitionDebugSettings.endRotX = settings.startCameraRotation.x;
  transitionDebugSettings.endRotY = settings.startCameraRotation.y;
  transitionDebugSettings.endRotZ = settings.startCameraRotation.z;

  // Add current values display (read-only, updates live)
  const currentStartPosFolder = transitionDebugFolder.addFolder("Current Start Position (Live)");
  currentStartPosFolder.add(settings.exteriorCameraPosition, "x").name("Start X").listen();
  currentStartPosFolder.add(settings.exteriorCameraPosition, "y").name("Start Y").listen();
  currentStartPosFolder.add(settings.exteriorCameraPosition, "z").name("Start Z").listen();

  const currentStartRotFolder = transitionDebugFolder.addFolder("Current Start Rotation (Live)");
  currentStartRotFolder.add(settings.exteriorCameraRotation, "x").name("Start Rot X").listen();
  currentStartRotFolder.add(settings.exteriorCameraRotation, "y").name("Start Rot Y").listen();
  currentStartRotFolder.add(settings.exteriorCameraRotation, "z").name("Start Rot Z").listen();

  const currentEndPosFolder = transitionDebugFolder.addFolder("Current End Position (Live)");
  currentEndPosFolder.add(settings.startCameraPosition, "x").name("End X").listen();
  currentEndPosFolder.add(settings.startCameraPosition, "y").name("End Y").listen();
  currentEndPosFolder.add(settings.startCameraPosition, "z").name("End Z").listen();

  const currentEndRotFolder = transitionDebugFolder.addFolder("Current End Rotation (Live)");
  currentEndRotFolder.add(settings.startCameraRotation, "x").name("End Rot X").listen();
  currentEndRotFolder.add(settings.startCameraRotation, "y").name("End Rot Y").listen();
  currentEndRotFolder.add(settings.startCameraRotation, "z").name("End Rot Z").listen();

  // Expose settings to window for use in main.js
  window.cameraTransitionDebug = {
    slerpPosX: transitionDebugSettings.slerpPosX,
    slerpPosY: transitionDebugSettings.slerpPosY,
    slerpPosZ: transitionDebugSettings.slerpPosZ,
    slerpRotX: transitionDebugSettings.slerpRotX,
    slerpRotY: transitionDebugSettings.slerpRotY,
    slerpRotZ: transitionDebugSettings.slerpRotZ,
  };

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
  import("./3d/postprocessing.js").then((postProc) => {
    const bloomPass = postProc.getBloomPass();
    if (bloomPass) {
      const bloomObj = {
        enabled: settings.bloomSettings?.enabled !== false ? true : false,
        strength: bloomPass.strength,
        radius: bloomPass.radius,
        threshold: bloomPass.threshold,
      };

      const saveBloomSettings = () => {
        settings.saveSettings(fbxMeshes, glbLights);
        // Apply bloom settings to scene
        settings.applySettingsToScene();
      };

      const enabledControl = postProcFolder.add(bloomObj, "enabled");
      enabledControl.name("Bloom Enabled");
      enabledControl.onChange((value) => {
        settings.bloomSettings.enabled = value;
        if (bloomPass) {
          bloomPass.enabled = value;
          if (!value) {
            bloomPass.strength = 0;
          } else {
            bloomPass.strength = settings.bloomSettings.strength;
          }
        }
        saveBloomSettings();
      });

      postProcFolder
        .add(bloomObj, "strength", 0, 3, 0.1)
        .name("Bloom Strength")
        .onChange((value) => {
          if (bloomPass && settings.bloomSettings.enabled) {
            bloomPass.strength = value;
          }
          settings.bloomSettings.strength = value;
          saveBloomSettings();
        });
      postProcFolder
        .add(bloomObj, "radius", 0, 2, 0.1)
        .name("Bloom Radius")
        .onChange((value) => {
          if (bloomPass) {
            bloomPass.radius = value;
          }
          settings.bloomSettings.radius = value;
          saveBloomSettings();
        });
      postProcFolder
        .add(bloomObj, "threshold", 0, 2, 0.1)
        .name("Bloom Threshold")
        .onChange((value) => {
          if (bloomPass) {
            bloomPass.threshold = value;
          }
          settings.bloomSettings.threshold = value;
          saveBloomSettings();
        });
    }
    postProcFolder.open();
  });

  // LED Strip animation settings
  const ledFolder = sceneFolder.addFolder("LED Strip Animation");
  import("./3d/led-strip.js").then((ledStrip) => {
    // Ensure settings are loaded
    ledStrip.loadLEDStripSettings();

    const ledAnimObj = {
      pulseSpeed: ledStrip.pulseSpeed,
      pulseWidth: ledStrip.pulseWidth,
      baseIntensity: ledStrip.baseIntensity,
      maxIntensity: ledStrip.maxIntensity,
      mirrored: ledStrip.mirrored,
      rimVisible: settings.ledStripSettings.rimVisible !== undefined ? settings.ledStripSettings.rimVisible : false, // Default to false
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
