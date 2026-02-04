// All Three.js and 3D modules are now lazy-loaded for better performance
// These are assigned when modules load dynamically
let THREE;
let scene, camera, renderer, canvas, resetCamera, setupLighting;
let initPostProcessing, updatePostProcessing, setupCameraControls, euler;
let loadModel, updateMovement, updateRotation, fbxMeshes, glbLights;
let getCurrentImageTexture, getCurrentVideoTexture, connectWebcam;
let loadImage, loadVideo, disconnectWebcam, loadDefaultScreenTexture;
let updateScreenLighting, touchMovement;
let updateListenerPosition;
let startAudio, stopAudio;
let threeJsLoaded = false;

import {
  loadSettings,
  currentCameraPosition,
  currentCameraRotation,
  startCameraPosition,
  startCameraRotation,
  saveSettings,
  textureRotationSettings,
} from "./core/settings.js";
import { initScrollIncrement } from "./layout/scroll-increment.js";
import { initGridDotsSystem } from "./layout/grid-dots.js";
import { initDashboard } from "./ui/dashboard.js";
import { initResponsiveHeights } from "./layout/responsive-height.js";
import { updateViewportHeightCSS } from "./core/utils.js";
import { initDomeMode, setCanvas, setAudioFunctions } from "./ui/dome-mode.js";
import { initTouchControls, setTouchMovementRef } from "./ui/touch-controls.js";

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000;

async function init() {
  // Yield to browser immediately to allow FCP
  await new Promise((resolve) => {
    if ("scheduler" in window && "postTask" in window.scheduler) {
      window.scheduler.postTask(() => resolve(), { priority: "user-blocking" });
    } else if ("requestIdleCallback" in window) {
      requestIdleCallback(() => resolve(), { timeout: 0 });
    } else {
      setTimeout(() => resolve(), 0);
    }
  });

  // Load settings (async, but yield after)
  await loadSettings();

  // Yield again after settings load
  await new Promise((resolve) => setTimeout(resolve, 0));

  updateViewportHeightCSS();

  // Defer all non-critical initialization to avoid blocking TBT
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        initScrollIncrement();
        initResponsiveHeights();
        initDashboard();
      },
      { timeout: 100 }
    );
  } else {
    setTimeout(() => {
      initScrollIncrement();
      initResponsiveHeights();
      initDashboard();
    }, 0);
  }

  // Defer non-critical visual elements
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        initGridDotsSystem();
      },
      { timeout: 500 }
    );
  } else {
    setTimeout(() => {
      initGridDotsSystem();
    }, 50);
  }

  // Defer event listener setup to avoid blocking TBT
  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        setupEventListeners();
      },
      { timeout: 100 }
    );
  } else {
    setTimeout(() => {
      setupEventListeners();
    }, 0);
  }
}

// Function to load Three.js and core 3D scene (deferred for performance)
async function loadThreeJS() {
  if (threeJsLoaded) return;

  try {
    THREE = await import("three");
    const sceneModule = await import("./3d/scene.js");
    const cameraModule = await import("./3d/camera.js");
    const lightingModule = await import("./3d/lighting.js");
    const postModule = await import("./3d/postprocessing.js");

    scene = sceneModule.scene;
    camera = sceneModule.camera;
    renderer = sceneModule.renderer;
    canvas = sceneModule.canvas;
    resetCamera = sceneModule.resetCamera;
    setupLighting = lightingModule.setupLighting;
    initPostProcessing = postModule.initPostProcessing;
    updatePostProcessing = postModule.updatePostProcessing;
    setupCameraControls = cameraModule.setupCameraControls;
    euler = cameraModule.euler;

    // Set canvas reference for dome mode
    setCanvas(canvas);

    threeJsLoaded = true;
  } catch (error) {
    console.error("Error loading Three.js:", error);
  }
}

// Function to dynamically load 3D modules (code splitting)
async function load3DModules() {
  await loadThreeJS();

  if (loadModel && connectWebcam) {
    return; // Already loaded
  }

  try {
    const modelModule = await import("./3d/model.js");
    const movementModule = await import("./3d/movement.js");
    const textureModule = await import("./3d/texture.js");
    const screenLightingModule = await import("./3d/screen-lighting.js");
    const pulseAudioModule = await import("./3d/pulse-audio.js");

    loadModel = modelModule.loadModel;
    updateMovement = movementModule.updateMovement;
    updateRotation = movementModule.updateRotation;
    fbxMeshes = modelModule.fbxMeshes;
    glbLights = modelModule.glbLights;
    getCurrentImageTexture = textureModule.getCurrentImageTexture;
    getCurrentVideoTexture = textureModule.getCurrentVideoTexture;
    connectWebcam = textureModule.connectWebcam;
    loadImage = textureModule.loadImage;
    loadVideo = textureModule.loadVideo;
    disconnectWebcam = textureModule.disconnectWebcam;
    loadDefaultScreenTexture = textureModule.loadDefaultScreenTexture;
    updateScreenLighting = screenLightingModule.updateScreenLighting;
    touchMovement = movementModule.touchMovement;
    updateListenerPosition = pulseAudioModule.updateListenerPosition;
    startAudio = pulseAudioModule.startAudio;
    stopAudio = pulseAudioModule.stopAudio;

    // Set references for extracted modules
    setTouchMovementRef(touchMovement);
    setAudioFunctions(startAudio, stopAudio);

    // Make available globally for other modules
    window.loadModel = loadModel;
    window.connectWebcam = connectWebcam;
    window.loadImage = loadImage;
    window.loadVideo = loadVideo;
    window.disconnectWebcam = disconnectWebcam;
    window.loadDefaultScreenTexture = loadDefaultScreenTexture;
  } catch (error) {
    console.error("Error loading 3D modules:", error);
  }
}

// Setup event listeners (deferred from init to reduce TBT)
function setupEventListeners() {
  // Create file input for uploads (reusable)
  let fileInput = null;
  function getFileInput() {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*,video/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (!loadImage || !loadVideo) {
            await load3DModules();
          }
          if (file.type.startsWith("image/")) {
            loadImage(file);
          } else if (file.type.startsWith("video/")) {
            loadVideo(file);
          }
        }
        fileInput.value = "";
      });
    }
    return fileInput;
  }

  // Handle links outside dome mode
  const webcamLink = document.getElementById("connect-webcam-link");
  if (webcamLink) {
    webcamLink.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!connectWebcam) {
        await load3DModules();
      }
      connectWebcam();
    });
  }

  const uploadFileLink = document.getElementById("upload-file-link");
  if (uploadFileLink) {
    uploadFileLink.addEventListener("click", (e) => {
      e.preventDefault();
      getFileInput().click();
    });
  }

  // Handle keyboard layout buttons
  const keyboardUploadBtn = document.getElementById("keyboard-upload-btn");
  if (keyboardUploadBtn) {
    keyboardUploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      getFileInput().click();
    });
  }

  // Reset function: reset camera, clear textures, stop webcam
  window.resetToDefaults = async function () {
    try {
      if (!disconnectWebcam || !loadDefaultScreenTexture) {
        await load3DModules();
      }
      disconnectWebcam();
      loadDefaultScreenTexture();
      resetCamera(startCameraPosition, startCameraRotation, euler);
      Object.assign(currentCameraPosition, startCameraPosition);
      Object.assign(currentCameraRotation, startCameraRotation);
    } catch (error) {
      console.error("Error during reset:", error);
    }
  };

  // Set up reset button handler
  let resetButtonSetup = false;
  function setupResetButton() {
    const resetBtn = document.getElementById("keyboard-reset-btn");
    if (resetBtn && !resetButtonSetup) {
      const handleReset = function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (window.resetToDefaults) {
          window.resetToDefaults();
        }
        return false;
      };

      const newBtn = resetBtn.cloneNode(true);
      resetBtn.parentNode.replaceChild(newBtn, resetBtn);
      newBtn.onclick = handleReset;
      newBtn.addEventListener("click", handleReset, { capture: true, passive: false });
      newBtn.addEventListener("touchend", handleReset, { capture: true, passive: false });

      resetButtonSetup = true;
      return true;
    }
    return false;
  }

  // Set up camera button handler
  const handleCamera = async function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!connectWebcam) {
      await load3DModules();
    }

    if (confirm("Do you want to connect your webcam to the screen?")) {
      connectWebcam();
    }
    return false;
  };

  window.setupCameraButton = function () {
    const cameraBtn = document.getElementById("keyboard-camera-btn");
    if (cameraBtn) {
      const newBtn = cameraBtn.cloneNode(true);
      cameraBtn.parentNode.replaceChild(newBtn, cameraBtn);
      newBtn.onclick = handleCamera;
      newBtn.addEventListener("click", handleCamera, { capture: true, passive: false });
      newBtn.addEventListener("touchend", handleCamera, { capture: true, passive: false });
      return true;
    }
    return false;
  };

  // Set up both buttons
  setupResetButton();
  setupCameraButton();

  // Retry if not found
  setTimeout(() => {
    if (!document.getElementById("keyboard-reset-btn")) {
      setupResetButton();
    }
    if (!document.getElementById("keyboard-camera-btn")) {
      setupCameraButton();
    }
  }, 500);

  const handleResize = () => {
    updateViewportHeightCSS();
  };
  window.addEventListener("resize", handleResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
  }

  window.addEventListener("orientationchange", () => {
    setTimeout(handleResize, 100);
  });

  // Initialize touch controls (extracted module)
  initTouchControls();

  // "Enter the dome" link handler
  const enterDomeLink = document.getElementById("enter-dome-link");
  if (enterDomeLink) {
    enterDomeLink.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!startAudio) {
        await load3DModules();
      }
      if (window.enterDomeModeWithAudio) {
        window.enterDomeModeWithAudio();
      }
    });
  }

  // Load 3D scene after idle time (defer for better FCP/LCP)
  const load3DScene = async () => {
    await loadThreeJS();
    if (setupLighting) setupLighting();
    if (initPostProcessing) initPostProcessing();
    if (setupCameraControls) setupCameraControls();
    await load3DModules();
    if (loadModel) {
      loadModel();
      startRenderLoop();
    }
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => load3DScene(), { timeout: 2000 });
  } else {
    setTimeout(load3DScene, 500);
  }
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  if (!threeJsLoaded || !camera) return;

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (updateMovement && updateRotation) {
    updateMovement();
    updateRotation(deltaTime);
  }

  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  const timeSinceLastSave = currentTime - lastCameraSaveTime;
  if (timeSinceLastSave >= CAMERA_SAVE_INTERVAL) {
    Object.assign(startCameraPosition, currentCameraPosition);
    Object.assign(startCameraRotation, currentCameraRotation);
    saveSettings(fbxMeshes, glbLights);
    lastCameraSaveTime = currentTime;
  }

  if (getCurrentImageTexture) updateTextureRotation(deltaTime);
  if (updateScreenLighting) updateScreenLighting(currentTime);

  if (updateListenerPosition && THREE && camera) {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(camera.quaternion);

    updateListenerPosition(
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      { x: forward.x, y: forward.y, z: forward.z }
    );
  }

  updatePostProcessing();
}

function updateTextureRotation(deltaTime) {
  if (!textureRotationSettings.enabled || !THREE || !getCurrentImageTexture) return;

  const imageTexture = getCurrentImageTexture();
  const videoTexture = getCurrentVideoTexture ? getCurrentVideoTexture() : null;
  const texture = imageTexture || videoTexture;

  if (texture) {
    if (!texture.center || texture.center.x !== 0.5 || texture.center.y !== 0.5) {
      if (!texture.center) {
        texture.center = new THREE.Vector2(0.5, 0.5);
      } else {
        texture.center.set(0.5, 0.5);
      }
    }

    texture.rotation -= textureRotationSettings.speed * deltaTime;

    while (texture.rotation < 0) {
      texture.rotation += Math.PI * 2;
    }
  }
}

function startRenderLoop() {
  lastTime = performance.now();
  animate(lastTime);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
    initDomeMode();
  });
} else {
  init();
  initDomeMode();
}
