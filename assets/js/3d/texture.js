import * as THREE from "three";
import { configureTexture, applyTextureToScreen, getMaterial, rgbToHex } from "./utils.js";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";
import { screenSettings, textureRotationSettings, randomizeColors, dofSettings } from "../core/settings.js";
import { isMobile } from "../core/utils.js";
import { getBokehPass } from "./postprocessing.js";
import { camera } from "./scene.js";
import { generatePolarGridTexture, polarGridSettings, startPulseAnimation, stopPulseAnimation, reinitializePulses, preloadCellImages, triggerScrambleBurst } from "./polar-grid-texture.js";
import { createPulseShaderMaterial, startPulseShaderAnimation, stopPulseShaderAnimation, updateBaseTexture } from "./pulse-shader.js";
import { audioSettings, startAudio, stopAudio, setMasterVolume, setReverbWet, setSpatialSpread, initAudio, setScrambleTrigger } from "./pulse-audio.js";
import { lightingSettings, setAmbientIntensity, setAmbientColor, setFogEnabled, setFogColor, setFogNear, setFogFar, setToneMapping, setExposure, setDirectLightEnabled, setDirectIntensity, setDirectColor, getToneMappingOptions, setGradientStart, setGradientEnd, setSection1FadeStart, setSection2FadeEnd } from "./lighting.js";

// Connect audio ticks to scramble effect
setScrambleTrigger(triggerScrambleBurst);
import GUI from "lil-gui";

let screenObject = null;
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;
let currentWebcamStream = null;

export function setScreenObject(obj) {
  screenObject = obj;
}

export function getScreenObject() {
  return screenObject;
}

export function getCurrentVideoTexture() {
  return currentVideoTexture;
}

export function getCurrentVideo() {
  return currentVideo;
}

export function getCurrentImageTexture() {
  return currentImageTexture;
}

export function loadDefaultScreenTexture(imagePath = screenSettings.defaultImage || "assets/media/background.png") {
  if (!screenObject) {
    return Promise.resolve();
  }

  // Dispose of previous texture to prevent memory leaks
  if (currentImageTexture) {
    currentImageTexture.dispose();
    currentImageTexture = null;
  }

  // Generate polar grid texture with mesh colors
  return new Promise(async (resolve) => {
    // Preload cell images first
    await preloadCellImages();

    // Get colors from saved settings or use defaults
    const colors = window.savedColorSettings || {};
    const mainColor = colors.Main_Structure || { r: 0.4, g: 0.45, b: 0.5 };
    const chairsColor = colors.Chairs || { r: 0.55, g: 0.32, b: 0.38 };
    const floorColor = colors.Floor || { r: 0.65, g: 0.52, b: 0.25 };

    // Lower resolution for better performance (2048 for all devices)
    const textureSize = 2048;

    const texture = generatePolarGridTexture(textureSize, {
      backgroundColor: "#000000",
      numCircles: 8,
      numRadialLines: 36,
      showLabels: true,
      labelColor: "#ffffff",
      mainColor,
      chairsColor,
      floorColor,
      curvedTexts: [
        {
          text: polarGridSettings.text1Content,
          row: polarGridSettings.text1Row,
          startSector: polarGridSettings.text1StartSector,
          textFontSize: polarGridSettings.text1FontSize,
          color: "#ffffff",
          flipX: polarGridSettings.text1FlipX,
          flipY: polarGridSettings.text1FlipY,
          cellMode: polarGridSettings.text1CellMode,
        },
        {
          text: polarGridSettings.text2Content,
          row: polarGridSettings.text2Row,
          startSector: polarGridSettings.text2StartSector,
          textFontSize: polarGridSettings.text2FontSize,
          color: "#ffffff",
          flipX: polarGridSettings.text2FlipX,
          flipY: polarGridSettings.text2FlipY,
          cellMode: polarGridSettings.text2CellMode,
        },
        {
          text: polarGridSettings.text3Content,
          row: polarGridSettings.text3Row,
          startSector: polarGridSettings.text3StartSector,
          textFontSize: polarGridSettings.text3FontSize,
          color: "#ffffff",
          flipX: polarGridSettings.text3FlipX,
          flipY: polarGridSettings.text3FlipY,
          cellMode: polarGridSettings.text3CellMode,
        },
        {
          text: polarGridSettings.text4Content,
          row: polarGridSettings.text4Row,
          startSector: polarGridSettings.text4StartSector,
          textFontSize: polarGridSettings.text4FontSize,
          color: "#ffffff",
          flipX: polarGridSettings.text4FlipX,
          flipY: polarGridSettings.text4FlipY,
          cellMode: polarGridSettings.text4CellMode,
        },
        {
          text: polarGridSettings.text5Content,
          row: polarGridSettings.text5Row,
          startSector: polarGridSettings.text5StartSector,
          textFontSize: polarGridSettings.text5FontSize,
          color: "#ffffff",
          flipX: polarGridSettings.text5FlipX,
          flipY: polarGridSettings.text5FlipY,
          cellMode: polarGridSettings.text5CellMode,
        },
      ],
    });

    configureTexture(texture);
    texture.rotation = 0;

    // Use WebGL shader for pulse animation (much better performance)
    if (polarGridSettings.pulsesEnabled) {
      // Create shader material with pulses rendered on GPU
      const shaderMaterial = createPulseShaderMaterial(texture);
      screenObject.material = shaderMaterial;

      // Start shader-based pulse animation
      startPulseShaderAnimation({
        pulseCount: polarGridSettings.pulseCount,
        numCircles: 8,
        pulseSpeed: polarGridSettings.pulseSpeed,
        pulseIntensity: 1.0
      });
    } else {
      applyTextureToScreen(texture, screenObject);
    }

    currentImageTexture = texture;

    // Setup GUI on first load
    setupPolarGridGUI();

    resolve(texture);
  });
}

/**
 * Regenerate the polar grid texture with current mesh colors
 * Call this after colors change to update the screen texture
 */
export function regeneratePolarGridTexture() {
  if (!screenObject) return;
  // Stop current animations before regenerating
  stopPulseAnimation();
  stopPulseShaderAnimation();
  loadDefaultScreenTexture();
}

// Store reference to GUI
let polarGridGUI = null;

/**
 * Helper to convert hex color to RGB object (0-1 range)
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : null;
}

/**
 * Apply a color to a mesh by name
 */
async function applyColorToMesh(meshName, color) {
  const model = await import("./model.js");
  const { getMaterial } = await import("./utils.js");

  if (model.fbxMeshes) {
    const meshItem = model.fbxMeshes.find(item => item.name === meshName);
    if (meshItem) {
      const material = getMaterial(meshItem.mesh);
      if (material) {
        material.color.setRGB(color.r, color.g, color.b);
        material.needsUpdate = true;
      }
    }
  }

  // Also update savedColorSettings
  if (!window.savedColorSettings) {
    window.savedColorSettings = {};
  }
  window.savedColorSettings[meshName] = color;
}

/**
 * Setup GUI for polar grid texture controls
 */
export function setupPolarGridGUI() {
  if (polarGridGUI) return; // Already setup

  polarGridGUI = new GUI({ title: "Dome Dreaming" });
  polarGridGUI.domElement.style.position = "fixed";
  polarGridGUI.domElement.style.top = "10px";
  polarGridGUI.domElement.style.left = "10px";
  polarGridGUI.domElement.style.zIndex = "99999";

  // Hide GUI by default
  polarGridGUI.domElement.style.display = "none";

  // Toggle GUI with CMD/CTRL + G
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
      e.preventDefault();
      const isHidden = polarGridGUI.domElement.style.display === "none";
      polarGridGUI.domElement.style.display = isHidden ? "" : "none";
    }
  });

  // ============ TYPOGRAPHY GROUP ============
  const typographyFolder = polarGridGUI.addFolder("Typography");

  // Global font size at the top level
  typographyFolder.add(polarGridSettings, "globalFontSize", 50, 200, 5)
    .name("Global Font Size %")
    .onChange(() => regeneratePolarGridTexture());

  // Text 1 subfolder
  const text1Folder = typographyFolder.addFolder("Text 1");
  text1Folder.add(polarGridSettings, "text1Content")
    .name("Text")
    .onChange(() => regeneratePolarGridTexture());
  text1Folder.add(polarGridSettings, "text1Row", 1, 8, 1)
    .name("Row (Circle)")
    .onChange(() => regeneratePolarGridTexture());
  text1Folder.add(polarGridSettings, "text1StartSector", 0, 35, 1)
    .name("Start Sector")
    .onChange(() => regeneratePolarGridTexture());
  text1Folder.add(polarGridSettings, "text1FontSize", 20, 200, 5)
    .name("Font Size %")
    .onChange(() => regeneratePolarGridTexture());
  text1Folder.close();

  // Text 2 subfolder
  const text2Folder = typographyFolder.addFolder("Text 2");
  text2Folder.add(polarGridSettings, "text2Content")
    .name("Text")
    .onChange(() => regeneratePolarGridTexture());
  text2Folder.add(polarGridSettings, "text2Row", 1, 8, 1)
    .name("Row (Circle)")
    .onChange(() => regeneratePolarGridTexture());
  text2Folder.add(polarGridSettings, "text2StartSector", 0, 35, 1)
    .name("Start Sector")
    .onChange(() => regeneratePolarGridTexture());
  text2Folder.add(polarGridSettings, "text2FontSize", 20, 200, 5)
    .name("Font Size %")
    .onChange(() => regeneratePolarGridTexture());
  text2Folder.close();

  // Text 3 subfolder
  const text3Folder = typographyFolder.addFolder("Text 3");
  text3Folder.add(polarGridSettings, "text3Content")
    .name("Text")
    .onChange(() => regeneratePolarGridTexture());
  text3Folder.add(polarGridSettings, "text3Row", 1, 8, 1)
    .name("Row (Circle)")
    .onChange(() => regeneratePolarGridTexture());
  text3Folder.add(polarGridSettings, "text3StartSector", 0, 35, 1)
    .name("Start Sector")
    .onChange(() => regeneratePolarGridTexture());
  text3Folder.add(polarGridSettings, "text3FontSize", 20, 200, 5)
    .name("Font Size %")
    .onChange(() => regeneratePolarGridTexture());
  text3Folder.close();

  // Text 4 subfolder
  const text4Folder = typographyFolder.addFolder("Text 4");
  text4Folder.add(polarGridSettings, "text4Content")
    .name("Text")
    .onChange(() => regeneratePolarGridTexture());
  text4Folder.add(polarGridSettings, "text4Row", 1, 8, 1)
    .name("Row (Circle)")
    .onChange(() => regeneratePolarGridTexture());
  text4Folder.add(polarGridSettings, "text4StartSector", 0, 35, 1)
    .name("Start Sector")
    .onChange(() => regeneratePolarGridTexture());
  text4Folder.add(polarGridSettings, "text4FontSize", 20, 200, 5)
    .name("Font Size %")
    .onChange(() => regeneratePolarGridTexture());
  text4Folder.close();

  // Text 5 subfolder
  const text5Folder = typographyFolder.addFolder("Text 5");
  text5Folder.add(polarGridSettings, "text5Content")
    .name("Text")
    .onChange(() => regeneratePolarGridTexture());
  text5Folder.add(polarGridSettings, "text5Row", 1, 8, 1)
    .name("Row (Circle)")
    .onChange(() => regeneratePolarGridTexture());
  text5Folder.add(polarGridSettings, "text5StartSector", 0, 35, 1)
    .name("Start Sector")
    .onChange(() => regeneratePolarGridTexture());
  text5Folder.add(polarGridSettings, "text5FontSize", 20, 200, 5)
    .name("Font Size %")
    .onChange(() => regeneratePolarGridTexture());
  text5Folder.close();

  // Style subfolder under Typography
  const textStyleFolder = typographyFolder.addFolder("Style");
  textStyleFolder.add(polarGridSettings, "textOutline")
    .name("Outline")
    .onChange(() => regeneratePolarGridTexture());
  textStyleFolder.addColor(polarGridSettings, "textOutlineColor")
    .name("Outline Color")
    .onChange(() => regeneratePolarGridTexture());
  textStyleFolder.add(polarGridSettings, "textOutlineWidth", 1, 10, 1)
    .name("Outline Width")
    .onChange(() => regeneratePolarGridTexture());
  textStyleFolder.add(polarGridSettings, "textShadow")
    .name("Shadow")
    .onChange(() => regeneratePolarGridTexture());
  textStyleFolder.add(polarGridSettings, "textShadowBlur", 0, 20, 1)
    .name("Shadow Blur")
    .onChange(() => regeneratePolarGridTexture());
  textStyleFolder.add(polarGridSettings, "textVerticalOffset", 0.1, 0.9, 0.05)
    .name("Radial Position")
    .onChange(() => regeneratePolarGridTexture());
  textStyleFolder.close();

  typographyFolder.close();

  // ============ GRID GROUP ============
  const gridFolder = polarGridGUI.addFolder("Grid");

  // Lines subfolder
  const linesFolder = gridFolder.addFolder("Lines");
  linesFolder.addColor(polarGridSettings, "gridLineColor")
    .name("Color")
    .onChange(() => regeneratePolarGridTexture());
  linesFolder.add(polarGridSettings, "lineWidth", 0.5, 5, 0.5)
    .name("Width")
    .onChange(() => regeneratePolarGridTexture());
  linesFolder.add(polarGridSettings, "tickWidth", 0.5, 4, 0.5)
    .name("Tick Width")
    .onChange(() => regeneratePolarGridTexture());
  linesFolder.add(polarGridSettings, "rimOffset", 0, 0.2, 0.01)
    .name("Rim Offset")
    .onChange(() => regeneratePolarGridTexture());
  linesFolder.add(polarGridSettings, "dotSize", 1, 20, 1)
    .name("Dot Size")
    .onChange(() => regeneratePolarGridTexture());
  linesFolder.close();

  // Images subfolder under Grid
  const imageFolder = gridFolder.addFolder("Images");
  imageFolder.add(polarGridSettings, "imageCellsEnabled")
    .name("Enable")
    .onChange(() => regeneratePolarGridTexture());
  imageFolder.add(polarGridSettings, "imageCellCount", 1, 12, 1)
    .name("Count")
    .onChange(() => regeneratePolarGridTexture());
  imageFolder.add(polarGridSettings, "imageThreshold")
    .name("Threshold")
    .onChange(() => regeneratePolarGridTexture());
  imageFolder.add(polarGridSettings, "imageThresholdLevel", 0.2, 0.8, 0.05)
    .name("Threshold Level")
    .onChange(() => regeneratePolarGridTexture());
  imageFolder.close();

  // Rendering subfolder under Grid
  const renderFolder = gridFolder.addFolder("Rendering");
  renderFolder.add(polarGridSettings, "antialias")
    .name("Antialiasing")
    .onChange(() => regeneratePolarGridTexture());
  renderFolder.close();

  gridFolder.close();

  // ============ ANIMATION GROUP ============
  const animationFolder = polarGridGUI.addFolder("Animation");

  // Rotation subfolder
  const rotationFolder = animationFolder.addFolder("Rotation");
  rotationFolder.add(polarGridSettings, "textRotationEnabled")
    .name("Rotate Text");
  rotationFolder.add(polarGridSettings, "textStepRotation")
    .name("Step Mode (BPM)");
  rotationFolder.add(polarGridSettings, "textRotationBPM", 10, 120, 5)
    .name("Text BPM");
  rotationFolder.add(polarGridSettings, "textRotationSpeed", -2, 2, 0.1)
    .name("Continuous Speed");
  rotationFolder.add(textureRotationSettings, "enabled")
    .name("Rotate Grid");
  rotationFolder.add(textureRotationSettings, "speed", -0.1, 0.1, 0.005)
    .name("Grid Speed");
  rotationFolder.close();

  // Pulses subfolder
  const pulseFolder = animationFolder.addFolder("Pulses");
  pulseFolder.add(polarGridSettings, "pulsesEnabled")
    .name("Enable")
    .onChange((enabled) => {
      if (enabled && currentImageTexture) {
        startPulseAnimation(currentImageTexture);
      } else {
        stopPulseAnimation();
      }
    });
  pulseFolder.add(polarGridSettings, "pulseCount", 1, 20, 1)
    .name("Count")
    .onChange(() => reinitializePulses());
  pulseFolder.add(polarGridSettings, "pulseSpeed", 0.1, 2, 0.1)
    .name("Speed");
  pulseFolder.add(polarGridSettings, "pulseSize", 4, 30, 1)
    .name("Size");
  pulseFolder.add(polarGridSettings, "pulseGlow")
    .name("Glow");
  pulseFolder.close();

  animationFolder.close();

  // ============ AUDIO GROUP ============
  const audioFolder = polarGridGUI.addFolder("Audio");
  audioFolder.add(audioSettings, "enabled")
    .name("Enable Sound")
    .onChange(async (enabled) => {
      if (enabled) {
        await startAudio();
      } else {
        stopAudio();
      }
    });
  audioFolder.add(audioSettings, "masterVolume", 0, 1, 0.05)
    .name("Volume")
    .onChange((v) => setMasterVolume(v));
  audioFolder.add(audioSettings, "tickBPM", 20, 180, 5)
    .name("Tick BPM");
  audioFolder.add(audioSettings, "reverbWet", 0, 1, 0.05)
    .name("Reverb")
    .onChange((v) => setReverbWet(v));
  audioFolder.add(audioSettings, "spatialSpread", 1, 20, 1)
    .name("3D Spread")
    .onChange((v) => setSpatialSpread(v));
  audioFolder.close();

  // Colors folder - editable colors that update 3D scene and texture
  const colorsFolder = polarGridGUI.addFolder("Colors");

  // Create color object with getters/setters for live editing
  const colorControls = {
    get mainColor() {
      const c = polarGridSettings.mainColor || { r: 0.4, g: 0.45, b: 0.5 };
      return rgbToHex(c);
    },
    set mainColor(hex) {
      const rgb = hexToRgb(hex);
      if (rgb) {
        polarGridSettings.mainColor = rgb;
        window.savedColorSettings = window.savedColorSettings || {};
        window.savedColorSettings.Main_Structure = rgb;
        applyColorToMesh("Main_Structure", rgb);
        regeneratePolarGridTexture();
      }
    },
    get chairsColor() {
      const c = polarGridSettings.chairsColor || { r: 0.55, g: 0.32, b: 0.38 };
      return rgbToHex(c);
    },
    set chairsColor(hex) {
      const rgb = hexToRgb(hex);
      if (rgb) {
        polarGridSettings.chairsColor = rgb;
        window.savedColorSettings = window.savedColorSettings || {};
        window.savedColorSettings.Chairs = rgb;
        applyColorToMesh("Chairs", rgb);
        regeneratePolarGridTexture();
      }
    },
    get floorColor() {
      const c = polarGridSettings.floorColor || { r: 0.65, g: 0.52, b: 0.25 };
      return rgbToHex(c);
    },
    set floorColor(hex) {
      const rgb = hexToRgb(hex);
      if (rgb) {
        polarGridSettings.floorColor = rgb;
        window.savedColorSettings = window.savedColorSettings || {};
        window.savedColorSettings.Floor = rgb;
        applyColorToMesh("Floor", rgb);
        regeneratePolarGridTexture();
      }
    },
  };

  colorsFolder.addColor(colorControls, "mainColor").name("Main Structure");
  colorsFolder.addColor(colorControls, "chairsColor").name("Chairs");
  colorsFolder.addColor(colorControls, "floorColor").name("Floor");
  colorsFolder.add({ randomize: () => {
    randomizeColors().then(() => {
      regeneratePolarGridTexture();
    });
  }}, "randomize").name("Randomise Colors");
  colorsFolder.close();

  // ============ LIGHTING GROUP ============
  const lightingFolder = polarGridGUI.addFolder("Lighting");

  // Exposure/Tonemapping subfolder
  const exposureFolder = lightingFolder.addFolder("Exposure");
  exposureFolder.add(lightingSettings, "toneMapping", getToneMappingOptions())
    .name("Tone Mapping")
    .onChange((v) => setToneMapping(v));
  exposureFolder.add(lightingSettings, "exposure", 0, 3, 0.1)
    .name("Exposure")
    .onChange((v) => setExposure(v));
  exposureFolder.close();

  // Ambient light subfolder
  const ambientFolder = lightingFolder.addFolder("Ambient");
  ambientFolder.add(lightingSettings, "ambientIntensity", 0, 2, 0.1)
    .name("Intensity")
    .onChange((v) => setAmbientIntensity(v));
  ambientFolder.addColor(lightingSettings, "ambientColor")
    .name("Color")
    .onChange((v) => setAmbientColor(v));
  ambientFolder.close();

  // Direct light subfolder
  const directFolder = lightingFolder.addFolder("Direct Light");
  directFolder.add(lightingSettings, "directLightEnabled")
    .name("Enable")
    .onChange((v) => setDirectLightEnabled(v));
  directFolder.add(lightingSettings, "directIntensity", 0, 5, 0.1)
    .name("Intensity")
    .onChange((v) => setDirectIntensity(v));
  directFolder.addColor(lightingSettings, "directColor")
    .name("Color")
    .onChange((v) => setDirectColor(v));
  directFolder.close();

  // Fog subfolder
  const fogFolder = lightingFolder.addFolder("Fog");
  fogFolder.add(lightingSettings, "fogEnabled")
    .name("Enable")
    .onChange((v) => setFogEnabled(v));
  fogFolder.addColor(lightingSettings, "fogColor")
    .name("Color")
    .onChange((v) => setFogColor(v));
  fogFolder.add(lightingSettings, "fogNear", 1, 50, 1)
    .name("Near")
    .onChange((v) => setFogNear(v));
  fogFolder.add(lightingSettings, "fogFar", 20, 100, 5)
    .name("Far")
    .onChange((v) => setFogFar(v));
  fogFolder.close();

  // Section gradient subfolder
  const gradientFolder = lightingFolder.addFolder("Section Gradient");
  gradientFolder.add(lightingSettings, "section1FadeStart", 0, 100, 5)
    .name("Section 1 Fade %")
    .onChange((v) => setSection1FadeStart(v));
  gradientFolder.add(lightingSettings, "section2FadeEnd", 0, 100, 5)
    .name("Section 2 Fade %")
    .onChange((v) => setSection2FadeEnd(v));
  gradientFolder.close();

  lightingFolder.close();

  // ============ DOF (DEPTH OF FIELD) GROUP ============
  const dofFolder = polarGridGUI.addFolder("Depth of Field");

  dofFolder.add(dofSettings, "enabled")
    .name("Enable")
    .onChange((v) => {
      const bokehPass = getBokehPass();
      if (bokehPass) bokehPass.enabled = v;
    });

  dofFolder.add(dofSettings, "focus", 0.1, 50, 0.1)
    .name("Focus Distance")
    .onChange((v) => {
      const bokehPass = getBokehPass();
      if (bokehPass) bokehPass.uniforms["focus"].value = v;
    });

  dofFolder.add(dofSettings, "aperture", 0, 0.01, 0.0001)
    .name("Aperture")
    .onChange((v) => {
      const bokehPass = getBokehPass();
      if (bokehPass) bokehPass.uniforms["aperture"].value = v;
    });

  dofFolder.add(dofSettings, "maxblur", 0, 0.05, 0.001)
    .name("Max Blur")
    .onChange((v) => {
      const bokehPass = getBokehPass();
      if (bokehPass) bokehPass.uniforms["maxblur"].value = v;
    });

  dofFolder.open(); // Keep open for easy adjustment

  // ============ CAMERA GROUP ============
  const cameraFolder = polarGridGUI.addFolder("Camera");

  // Position subfolder
  const positionFolder = cameraFolder.addFolder("Position");
  positionFolder.add(camera.position, "x", -20, 20, 0.01).name("X").listen();
  positionFolder.add(camera.position, "y", -20, 20, 0.01).name("Y").listen();
  positionFolder.add(camera.position, "z", -20, 20, 0.01).name("Z").listen();
  positionFolder.close();

  // Rotation subfolder
  const cameraRotationFolder = cameraFolder.addFolder("Rotation");
  cameraRotationFolder.add(camera.rotation, "x", -Math.PI, Math.PI, 0.01).name("X").listen();
  cameraRotationFolder.close();

  cameraFolder.close();

  // Main GUI panel stays open

  // Store regenerate function for external use
  polarGridSettings.regenerate = regeneratePolarGridTexture;
}

export function loadImage(file) {
  if (!screenObject) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      e.target.result,
      (texture) => {
        if (currentVideoTexture) {
          currentVideoTexture.dispose();
          currentVideoTexture = null;
        }
        if (currentVideo) {
          currentVideo.pause();
          currentVideo.src = "";
          URL.revokeObjectURL(currentVideo.src);
          currentVideo = null;
        }
        if (currentImageTexture) {
          currentImageTexture.dispose();
        }

        textureRotationSettings.enabled = false;
        configureTexture(texture);
        texture.rotation = 0;
        applyTextureToScreen(texture, screenObject);
        currentImageTexture = texture;

        const material = getMaterial(screenObject);
        if (material) {
          setTimeout(() => {
            Object.assign(material, SCREEN_MATERIAL_SETTINGS);
            material.needsUpdate = true;
          }, 200);
        }
      },
      undefined,
      () => {}
    );
  };
  reader.readAsDataURL(file);
}

export function loadVideo(file) {
  if (!screenObject) return;

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  video.addEventListener("loadedmetadata", () => {
    video.play();

    if (currentVideoTexture) currentVideoTexture.dispose();
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.src = "";
      URL.revokeObjectURL(currentVideo.src);
    }
    if (currentImageTexture) {
      currentImageTexture.dispose();
      currentImageTexture = null;
    }

    textureRotationSettings.enabled = false;
    const videoTexture = new THREE.VideoTexture(video);
    configureTexture(videoTexture);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.rotation = 0;

    applyTextureToScreen(videoTexture, screenObject);
    currentVideoTexture = videoTexture;
    currentVideo = video;

    const material = getMaterial(screenObject);
    if (material) {
      setTimeout(() => {
        Object.assign(material, SCREEN_MATERIAL_SETTINGS);
        material.needsUpdate = true;
      }, 200);
    }
  });

  video.addEventListener("error", () => {});
}

export function connectWebcam() {
  if (!screenObject) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Webcam access is not available in your browser.");
    return;
  }

  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      if (currentVideoTexture) {
        currentVideoTexture.dispose();
        currentVideoTexture = null;
      }
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.srcObject = null;
        currentVideo = null;
      }
      if (currentImageTexture) {
        currentImageTexture.dispose();
        currentImageTexture = null;
      }
      if (currentWebcamStream) {
        currentWebcamStream.getTracks().forEach((track) => track.stop());
        currentWebcamStream = null;
      }

      textureRotationSettings.enabled = false;
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      video.addEventListener("loadedmetadata", () => {
        video.play();

        const videoTexture = new THREE.VideoTexture(video);
        configureTexture(videoTexture);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.rotation = 0;

        applyTextureToScreen(videoTexture, screenObject);
        currentVideoTexture = videoTexture;
        currentVideo = video;
        currentWebcamStream = stream;

        const material = getMaterial(screenObject);
        if (material) {
          setTimeout(() => {
            Object.assign(material, SCREEN_MATERIAL_SETTINGS);
            material.needsUpdate = true;
          }, 200);
        }
      });

      video.addEventListener("error", () => {
        alert("Error accessing webcam.");
      });
    })
    .catch((error) => {
      console.error("Error accessing webcam:", error);
      alert("Could not access webcam. Please check permissions.");
    });
}

export function disconnectWebcam() {
  if (currentWebcamStream) {
    currentWebcamStream.getTracks().forEach((track) => track.stop());
    currentWebcamStream = null;
  }
  if (currentVideoTexture) {
    currentVideoTexture.dispose();
    currentVideoTexture = null;
  }
  if (currentVideo) {
    currentVideo.pause();
    currentVideo.srcObject = null;
    currentVideo = null;
  }
}

export function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlightScreen(isHighlight) {
    if (!screenObject) return;
    const material = getMaterial(screenObject);
    if (material) {
      if (isHighlight) {
        material.emissive = new THREE.Color(0x0096ff);
        material.emissiveIntensity = 0.8;
      } else {
        Object.assign(material, SCREEN_MATERIAL_SETTINGS);
        material.needsUpdate = true;
      }
    }
  }

  document.addEventListener(
    "dragenter",
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("drag-over");
      highlightScreen(true);
    },
    false
  );

  document.addEventListener(
    "dragover",
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("drag-over");
      highlightScreen(true);
    },
    false
  );

  document.addEventListener(
    "dragleave",
    (e) => {
      preventDefaults(e);
      if (e.clientX === 0 && e.clientY === 0) {
        dropZone.classList.remove("drag-over");
        highlightScreen(false);
      }
    },
    false
  );

  document.addEventListener(
    "drop",
    (e) => {
      preventDefaults(e);
      dropZone.classList.remove("drag-over");
      highlightScreen(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
          loadImage(file);
        } else if (file.type.startsWith("video/")) {
          loadVideo(file);
        }
      }
    },
    false
  );
}
