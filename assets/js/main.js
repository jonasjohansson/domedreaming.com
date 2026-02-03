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

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000;

// Canvas container height is now handled by CSS (100% of page-section)
// No JavaScript height setting needed

function applyDomeDreamingFont() {
  const mainElement = document.querySelector("main");
  if (!mainElement) return;

  const walker = document.createTreeWalker(mainElement, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.classList.contains("dome-dreaming-text")) continue;
    if (/dome\s+dreaming/i.test(node.textContent)) {
      textNodes.push(node);
    }
  }

  // Process text nodes in batches to avoid long main-thread tasks
  let currentIndex = 0;
  const batchSize = 5;

  function processBatch() {
    const endIndex = Math.min(currentIndex + batchSize, textNodes.length);

    for (let i = currentIndex; i < endIndex; i++) {
      const textNode = textNodes[i];
      const parent = textNode.parentNode;
      if (!parent) continue;

      const text = textNode.textContent;
      const regex = /(dome\s+dreaming)/gi;
      const parts = text.split(regex);

      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part && /^dome\s+dreaming$/i.test(part)) {
          const span = document.createElement("span");
          span.className = "dome-dreaming-text";
          span.textContent = part;
          fragment.appendChild(span);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });

      parent.replaceChild(fragment, textNode);
    }

    currentIndex = endIndex;

    if (currentIndex < textNodes.length) {
      // Use requestIdleCallback or setTimeout to continue batching
      if ("requestIdleCallback" in window) {
        requestIdleCallback(processBatch, { timeout: 50 });
      } else {
        setTimeout(processBatch, 0);
      }
    }
  }

  if (textNodes.length > 0) {
    processBatch();
  }
}

async function init() {
  // Yield to browser immediately to allow FCP
  await new Promise((resolve) => {
    if ("scheduler" in window && "postTask" in window.scheduler) {
      // Use Scheduler API if available (best for yielding)
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
  // Only keep absolutely critical path synchronous
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
        applyDomeDreamingFont();
      },
      { timeout: 500 }
    );
  } else {
    setTimeout(() => {
      initGridDotsSystem();
      applyDomeDreamingFont();
    }, 50);
  }

  // Setup 3D lighting and post-processing after Three.js loads
  // This is deferred until user interaction or idle time for better FCP

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
    // Load Three.js and core scene modules
    THREE = await import("three");
    const sceneModule = await import("./3d/scene.js");
    const cameraModule = await import("./3d/camera.js");
    const lightingModule = await import("./3d/lighting.js");
    const postModule = await import("./3d/postprocessing.js");

    // Assign core scene exports
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

    threeJsLoaded = true;
  } catch (error) {
    console.error("Error loading Three.js:", error);
  }
}

// Function to dynamically load 3D modules (code splitting)
// Defined at module level so it's accessible everywhere
async function load3DModules() {
  // First ensure Three.js is loaded
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

    // Assign to module-level variables
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
          // Ensure 3D modules are loaded before using
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
      // Ensure 3D modules are loaded before using
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
      // Ensure 3D modules are loaded before using
      if (!disconnectWebcam || !loadDefaultScreenTexture) {
        await load3DModules();
      }
      // Disconnect webcam if active
      disconnectWebcam();

      // Load default texture (this will dispose of current textures internally)
      loadDefaultScreenTexture();

      // Reset camera to original position and rotation
      resetCamera(startCameraPosition, startCameraRotation, euler);

      // Update current camera position/rotation tracking
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

      // Remove ALL existing event listeners by cloning and replacing
      const newBtn = resetBtn.cloneNode(true);
      resetBtn.parentNode.replaceChild(newBtn, resetBtn);

      // Set inline onclick (highest priority)
      newBtn.onclick = handleReset;

      // Add event listeners with capture phase
      newBtn.addEventListener("click", handleReset, { capture: true, passive: false });
      newBtn.addEventListener("touchend", handleReset, { capture: true, passive: false });

      resetButtonSetup = true;
      return true;
    }
    return false;
  }

  // Set up camera button handler - asks for permission
  // Store handler function so we can re-attach if needed
  const handleCamera = async function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Ensure 3D modules are loaded before using
    if (!connectWebcam) {
      await load3DModules();
    }

    // Ask user if they want to connect webcam
    if (confirm("Do you want to connect your webcam to the screen?")) {
      connectWebcam();
    }
    return false;
  };

  // Make setupCameraButton accessible globally so initDomeMode can call it
  window.setupCameraButton = function () {
    const cameraBtn = document.getElementById("keyboard-camera-btn");
    if (cameraBtn) {
      // Always re-setup to ensure handlers are attached, especially after DOM changes
      // Remove ALL existing event listeners by cloning and replacing
      const newBtn = cameraBtn.cloneNode(true);
      cameraBtn.parentNode.replaceChild(newBtn, cameraBtn);

      // Set inline onclick
      newBtn.onclick = handleCamera;

      // Add event listeners
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

  // keyboardExitBtn is now handled in initDomeMode() to support both enter and exit

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

  // keyboardExitBtn is now handled in initDomeMode() to support both enter and exit

  // WASD button controls (keyboard layout)
  const wasdButtons = document.querySelectorAll(".wasd-key-btn");

  wasdButtons.forEach((btn) => {
    const key = btn.getAttribute("data-key");
    if (!key) return;

    // Touch start
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("active");
      if (key === "w") touchMovement.forward = true;
      if (key === "s") touchMovement.backward = true;
      if (key === "a") touchMovement.left = true;
      if (key === "d") touchMovement.right = true;
      if (key === "q") touchMovement.rotateLeft = true;
      if (key === "e") touchMovement.rotateRight = true;
    });

    // Touch end - always remove active state
    btn.addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      if (key === "w") touchMovement.forward = false;
      if (key === "s") touchMovement.backward = false;
      if (key === "a") touchMovement.left = false;
      if (key === "d") touchMovement.right = false;
      if (key === "q") touchMovement.rotateLeft = false;
      if (key === "e") touchMovement.rotateRight = false;
    });

    // Touch cancel - also remove active state
    btn.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      if (key === "w") touchMovement.forward = false;
      if (key === "s") touchMovement.backward = false;
      if (key === "a") touchMovement.left = false;
      if (key === "d") touchMovement.right = false;
      if (key === "q") touchMovement.rotateLeft = false;
      if (key === "e") touchMovement.rotateRight = false;
    });

    // Mouse events for testing
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("active");
      if (key === "w") touchMovement.forward = true;
      if (key === "s") touchMovement.backward = true;
      if (key === "a") touchMovement.left = true;
      if (key === "d") touchMovement.right = true;
      if (key === "q") touchMovement.rotateLeft = true;
      if (key === "e") touchMovement.rotateRight = true;
    });

    // Mouse up - always remove active state
    btn.addEventListener("mouseup", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      if (key === "w") touchMovement.forward = false;
      if (key === "s") touchMovement.backward = false;
      if (key === "a") touchMovement.left = false;
      if (key === "d") touchMovement.right = false;
      if (key === "q") touchMovement.rotateLeft = false;
      if (key === "e") touchMovement.rotateRight = false;
    });

    // Mouse leave - remove active state if mouse leaves button
    btn.addEventListener("mouseleave", (e) => {
      btn.classList.remove("active");
      if (key === "w") touchMovement.forward = false;
      if (key === "s") touchMovement.backward = false;
      if (key === "a") touchMovement.left = false;
      if (key === "d") touchMovement.right = false;
      if (key === "q") touchMovement.rotateLeft = false;
      if (key === "e") touchMovement.rotateRight = false;
    });

    // Click - ensure active state is removed
    btn.addEventListener("click", (e) => {
      btn.classList.remove("active");
    });
  });

  // "Enter the dome" link handler
  const enterDomeLink = document.getElementById("enter-dome-link");
  if (enterDomeLink) {
    enterDomeLink.addEventListener("click", async (e) => {
      e.preventDefault();
      // Ensure 3D modules are loaded
      if (!startAudio) {
        await load3DModules();
      }
      // Enter dome mode with audio
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

  // Use requestIdleCallback to load 3D after page is interactive
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => load3DScene(), { timeout: 2000 });
  } else {
    setTimeout(load3DScene, 500);
  }
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  // Skip if Three.js not loaded yet
  if (!threeJsLoaded || !camera) return;

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // Only update if 3D modules are loaded
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

  // Update spatial audio listener position based on camera
  if (updateListenerPosition && THREE && camera) {
    // Get camera forward direction
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

function initDomeMode() {
  const keyboardExitBtn = document.getElementById("keyboard-exit-btn");
  const body = document.body;
  let isExitingDomeMode = false; // Flag to prevent double-exit
  let usingPointerLock = false; // Track if we requested pointer lock

  function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function updateEnterExitButton() {
    if (keyboardExitBtn) {
      if (body.classList.contains("dome-mode")) {
        if (isMobile()) {
          // On mobile, show "exit" button
          keyboardExitBtn.textContent = "exit";
          keyboardExitBtn.style.display = "flex";
        } else {
          // On desktop, hide the button (user presses ESC to exit)
          keyboardExitBtn.style.display = "none";
        }
      } else {
        // Not in dome mode, show "enter" button
        keyboardExitBtn.textContent = "enter";
        keyboardExitBtn.style.display = "flex";
        // Ensure button is enabled and clickable
        keyboardExitBtn.disabled = false;
        keyboardExitBtn.style.pointerEvents = "auto";
      }
    }
  }

  function enterDomeMode(shouldRequestPointerLock = false) {
    if (body.classList.contains("dome-mode")) return;

    body.classList.add("dome-mode");
    document.documentElement.style.overflow = "hidden";
    updateEnterExitButton();

    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
      const actualVh = getComputedStyle(document.documentElement).getPropertyValue("--actual-vh");
      canvasContainer.style.height = actualVh || "100vh";
      canvasContainer.style.width = "100vw";

      // Trigger resize to update canvas and camera
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 0);
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Track if we're using pointer lock mode
    usingPointerLock = shouldRequestPointerLock && !isMobile;

    if (shouldRequestPointerLock && canvas && !isMobile) {
      // Check if pointer lock is already active before requesting
      const isAlreadyLocked =
        document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas;

      if (!isAlreadyLocked) {
        // Request pointer lock after a small delay to ensure canvas is ready
        // Browsers require user interaction, so this should be called from a click handler
        const pointerLockTimeout = setTimeout(() => {
          // Check again before requesting (user might have exited in the meantime)
          if (!body.classList.contains("dome-mode") || isExitingDomeMode) {
            return; // Don't request if we're no longer in dome mode or are exiting
          }

          const requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
          if (requestPointerLock) {
            try {
              requestPointerLock.call(canvas).catch((error) => {
                // Handle promise rejection for pointer lock request
                // Silently handle SecurityError if user exited before request completed
                if (error.name !== "SecurityError" && error.name !== "NotAllowedError") {
                  console.warn("Pointer lock request failed:", error);
                }
              });
            } catch (error) {
              // Silently handle SecurityError if user exited before request completed
              if (error.name !== "SecurityError" && error.name !== "NotAllowedError") {
                console.warn("Pointer lock request failed:", error);
              }
            }
          }
        }, 100);

        // Store timeout so we can clear it if needed
        window.pointerLockTimeout = pointerLockTimeout;
      }
    }

    if (isMobile) {
    }

    // Re-setup camera button after entering dome mode to ensure handlers are attached
    setTimeout(() => {
      if (window.setupCameraButton) {
        window.setupCameraButton();
      }
    }, 150);
  }

  function exitDomeMode() {
    // Prevent double-exit
    if (isExitingDomeMode) {
      return;
    }

    isExitingDomeMode = true;

    // Clear any pending pointer lock request
    if (window.pointerLockTimeout) {
      clearTimeout(window.pointerLockTimeout);
      window.pointerLockTimeout = null;
    }

    // Exit pointer lock first if active
    if (
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas)
    ) {
      try {
        document.exitPointerLock();
      } catch (error) {
        // Silently handle errors when exiting pointer lock
        if (error.name !== "SecurityError") {
          console.warn("Error exiting pointer lock:", error);
        }
      }
    }

    // Then exit dome mode
    if (body.classList.contains("dome-mode")) {
      body.classList.remove("dome-mode");
      document.documentElement.style.overflow = "auto";

      const canvasContainer = document.getElementById("canvas-container");
      if (canvasContainer) {
        // Reset width to default (remove inline style to let CSS handle it)
        canvasContainer.style.width = "";
      }

      // Update button state immediately
      updateEnterExitButton();

      // Re-setup camera button after a small delay to ensure DOM is ready
      setTimeout(() => {
        if (window.setupCameraButton) {
          window.setupCameraButton();
        }
        // Reset flag after a delay to allow re-entry
        setTimeout(() => {
          isExitingDomeMode = false;
        }, 100);
      }, 0);
    } else {
      // Reset flag immediately if we weren't in dome mode
      isExitingDomeMode = false;
    }
  }

  window.enterDomeModeFromCanvas = () => {
    enterDomeMode(true);
  };

  // Enter dome mode with audio (for "Enter the dome" link)
  // Don't request pointer lock so mouse drag to look still works
  window.enterDomeModeWithAudio = async () => {
    enterDomeMode(false);
    // Start audio after entering dome mode
    if (startAudio) {
      try {
        await startAudio();
      } catch (error) {
        console.warn("Could not start audio:", error);
      }
    }
  };

  // Keyboard enter/exit button - behaves like old "dome simulator" link
  if (keyboardExitBtn) {
    // Click event - exactly like old "dome simulator" link
    keyboardExitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // If not in dome mode, enter (exactly like old link)
      if (!body.classList.contains("dome-mode")) {
        enterDomeMode(true);
      } else if (isMobile()) {
        // Only allow exit on mobile when already in dome mode
        exitDomeMode();
        // Stop audio when exiting
        if (stopAudio) {
          try {
            stopAudio();
          } catch (error) {
            console.warn("Could not stop audio:", error);
          }
        }
      }
      // On desktop when in dome mode, do nothing (user presses ESC)
    });

    // Touch event - exactly like old "dome simulator" link
    keyboardExitBtn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      // If not in dome mode, enter (exactly like old link)
      if (!body.classList.contains("dome-mode")) {
        enterDomeMode(true);
      } else if (isMobile()) {
        // Only allow exit on mobile when already in dome mode
        exitDomeMode();
        // Stop audio when exiting
        if (stopAudio) {
          try {
            stopAudio();
          } catch (error) {
            console.warn("Could not stop audio:", error);
          }
        }
      }
      // On desktop when in dome mode, do nothing (user presses ESC)
    });
  }

  // Initialize button text
  updateEnterExitButton();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("dome-mode")) {
      // Always call exitDomeMode directly - it will handle pointer lock exit
      exitDomeMode();
      // Stop audio when exiting dome mode
      if (stopAudio) {
        try {
          stopAudio();
        } catch (error) {
          console.warn("Could not stop audio:", error);
        }
      }
    }
  });

  function onPointerLockChange() {
    // Don't handle pointer lock changes if we're already exiting dome mode
    if (isExitingDomeMode) {
      return;
    }

    // If pointer lock is lost while in dome mode (but not from our exitDomeMode call),
    // we should still exit dome mode. However, we need to check if we're already exiting.
    const isLocked =
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;

    // Only exit if pointer lock was lost and we're still in dome mode AND we were using pointer lock
    if (!isLocked && body.classList.contains("dome-mode") && !isMobile && usingPointerLock) {
      // Small delay to avoid race condition with exitDomeMode() being called from ESC handler
      setTimeout(() => {
        // Double-check we're still in dome mode and pointer lock is still not active, and we're not already exiting
        if (
          !isExitingDomeMode &&
          body.classList.contains("dome-mode") &&
          !(
            document.pointerLockElement === canvas ||
            document.mozPointerLockElement === canvas ||
            document.webkitPointerLockElement === canvas
          )
        ) {
          exitDomeMode();
        }
      }, 50);
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);
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
