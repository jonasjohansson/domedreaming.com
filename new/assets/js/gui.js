import * as THREE from "three";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm";
import { getMaterial, colorToHex } from "./utils.js";
import * as settings from "./settings.js";
import { camera } from "./scene.js";
import { fbxMeshes, glbLights } from "./model.js";
import { toggleDayNightMode } from "./daynight.js";

let gui = null;

export function createColorGUI() {
  if (gui) gui.destroy();

  if (fbxMeshes.length === 0) return;

  gui = new GUI({ title: "Scene Controls" });
  gui.domElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // Day/Night mode toggle
  const modeActions = {
    toggleMode: () => {
      toggleDayNightMode(createColorGUI);
    },
  };
  gui.add(modeActions, "toggleMode").name(settings.isNightMode ? "Switch to Day" : "Switch to Night");

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

      // Store original intensity for night mode calculations
      const originalIntensity = light.intensity / (settings.isNightMode ? 0.1 : 1.0);

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
        // Apply intensity with night mode multiplier if needed
        light.intensity = settings.isNightMode ? value * 0.1 : value;
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
  movementFolder
    .add({ moveSpeed: settings.moveSpeed }, "moveSpeed", 0.001, 0.2, 0.001)
    .name("Move Speed")
    .onChange((value) => {
      settings.moveSpeed = value;
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
}
