import * as THREE from "three";
import GUI from "./libs/lil-gui/lil-gui.esm.min.js";
import { getMaterial, colorToHex } from "./utils.js";
import * as settings from "./settings.js";
import { camera } from "./scene.js";
import { fbxMeshes, glbLights } from "./model.js";

let gui = null;

export function createColorGUI() {
  if (gui) gui.destroy();

  if (fbxMeshes.length === 0) return;

  gui = new GUI({ title: "Scene Controls", autoPlace: true });

  // Mesh colors
  const meshFolder = gui.addFolder("Mesh Colors");
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
    const lightFolder = gui.addFolder("GLB Lights");
    glbLights.forEach((light, index) => {
      const lightName = light.name || `Light ${index + 1}`;
      const lightType = light.constructor.name || "Light";

      // Store original intensity
      const originalIntensity = light.intensity;

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
  const movementFolder = gui.addFolder("Movement Settings");
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
  const cameraFolder = gui.addFolder("Camera Settings");

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
  const postProcFolder = gui.addFolder("Post-Processing");
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
  const ledFolder = gui.addFolder("LED Strip Animation");
  import("./led-strip.js").then((ledStrip) => {
    // Ensure settings are loaded
    ledStrip.loadLEDStripSettings();

    const ledAnimObj = {
      pulseSpeed: ledStrip.pulseSpeed,
      pulseWidth: ledStrip.pulseWidth,
      baseIntensity: ledStrip.baseIntensity,
      maxIntensity: ledStrip.maxIntensity,
      mirrored: ledStrip.mirrored,
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
