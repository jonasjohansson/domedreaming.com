import { scene, camera, renderer, canvas } from "./3d/scene.js";
import { setupLighting } from "./3d/lighting.js";
import { initPostProcessing, updatePostProcessing } from "./3d/postprocessing.js";
import { setupCameraControls } from "./3d/camera.js";
import { updateMovement } from "./3d/movement.js";
import { loadModel, fbxMeshes, glbLights } from "./3d/model.js";
import { createColorGUI } from "./gui.js";
import {
  loadSettings,
  canvasSettings,
  currentCameraPosition,
  currentCameraRotation,
  startCameraPosition,
  startCameraRotation,
  saveSettings,
} from "./settings.js";
import { updateLEDAnimation } from "./3d/led-strip.js";
import { initScrollIncrement } from "./scroll-increment.js";
import { initGridDotsSystem } from "./grid-dots.js";
import { initDashboard } from "./dashboard.js";
import { getCurrentImageTexture, getCurrentVideoTexture, connectWebcam } from "./3d/texture.js";
import { textureRotationSettings } from "./settings.js";

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000; // Save camera position every 2 seconds

function setCanvasHeight() {
  const canvasContainer = document.getElementById("canvas-container");
  const canvasWrapper = document.querySelector(".canvas-wrapper");
  if (!canvasContainer || !canvasWrapper) return;

  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  const rowHeight = !isNaN(cssRowHeight) && cssRowHeight > 0 ? cssRowHeight : window.innerHeight / 10;
  const targetHeight = rowHeight * 10;

  canvasContainer.style.height = `${targetHeight}px`;
  canvasContainer.style.padding = "0";
  canvasContainer.style.margin = "0";
  canvasWrapper.style.height = `${targetHeight}px`;
}


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

  // Process each text node
  textNodes.forEach((textNode) => {
    const parent = textNode.parentNode;
    if (!parent) return;

    const text = textNode.textContent;
    // Case-insensitive split that preserves the original case
    const regex = /(dome\s+dreaming)/gi;
    const parts = text.split(regex);

    // Create document fragment with wrapped text
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      // Check if this part matches "dome dreaming" (case-insensitive)
      if (part && /^dome\s+dreaming$/i.test(part)) {
        const span = document.createElement("span");
        span.className = "dome-dreaming-text";
        span.textContent = part;
        fragment.appendChild(span);
      } else if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    // Replace the original text node with the fragment
    parent.replaceChild(fragment, textNode);
  });
}

// Initialize everything
async function init() {
  // Load settings first
  await loadSettings();

  // Setup lighting
  setupLighting();

  // Initialize post-processing
  initPostProcessing();

  // Setup camera controls
  setupCameraControls();

  // Initialize scroll increment functionality
  initScrollIncrement();

  // Initialize grid dots (static background)
  initGridDotsSystem();

  initDashboard();
  applyDomeDreamingFont();

  // Setup webcam link
  const webcamLink = document.getElementById("connect-webcam-link");
  if (webcamLink) {
    webcamLink.addEventListener("click", (e) => {
      e.preventDefault();
      connectWebcam();
    });
  }

  setCanvasHeight();
  window.addEventListener("resize", setCanvasHeight);
  loadModel(createColorGUI);
  startRenderLoop();
}

// Render loop
function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  updateMovement();

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

  updateLEDAnimation(deltaTime);
  updateTextureRotation(deltaTime);

  // Update post-processing and render
  updatePostProcessing();
}

/**
 * Update texture rotation if enabled
 */
function updateTextureRotation(deltaTime) {
  if (!textureRotationSettings.enabled) return;

  const imageTexture = getCurrentImageTexture();
  const videoTexture = getCurrentVideoTexture();
  const texture = imageTexture || videoTexture;

  if (texture) {
    const rotationSpeed = textureRotationSettings.speed * textureRotationSettings.direction;
    texture.rotation += rotationSpeed * deltaTime;
  }
}

function startRenderLoop() {
  lastTime = performance.now();
  animate(lastTime);
}

// Dome mode functionality
function initDomeMode() {
  const enterDomeBtn = document.getElementById("enter-dome-btn");
  const body = document.body;

  function enterDomeMode(shouldRequestPointerLock = false) {
    if (body.classList.contains("dome-mode")) return;

    body.classList.add("dome-mode");
    // Prevent scrolling when in dome mode
    document.documentElement.style.overflow = "hidden";

    // Set canvas to full viewport height in dome mode
    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
      canvasContainer.style.height = "100vh";
      canvasContainer.style.width = "100vw";
    }

    if (shouldRequestPointerLock && canvas) {
      const requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
      if (requestPointerLock) {
        requestPointerLock.call(canvas);
      }
    }
  }

  function exitDomeMode() {
    if (body.classList.contains("dome-mode")) {
      body.classList.remove("dome-mode");
      document.documentElement.style.overflow = "auto";

      // Reset canvas height to row-height based size
      const canvasContainer = document.getElementById("canvas-container");
      if (canvasContainer) {
        // Recalculate based on row-heights
        setCanvasHeight();
      }
    }
    // Exit pointer lock if active
    if (
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas)
    ) {
      document.exitPointerLock();
    }
  }

  // Expose a global hook so canvas clicks can enter dome mode too
  // This behaves exactly like clicking the "Enter the dome" button:
  // fade out overlays, lock pointer, disable scrolling.
  window.enterDomeModeFromCanvas = () => {
    enterDomeMode(true);
  };

  if (enterDomeBtn && canvas) {
    enterDomeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      enterDomeMode(true);
    });
  }

  // Exit dome mode on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      exitDomeMode();
    }
  });

  // Exit dome mode when pointer lock is released
  function onPointerLockChange() {
    const isLocked =
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas);
    if (!isLocked && body.classList.contains("dome-mode")) {
      exitDomeMode();
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
    initDomeMode();
  });
} else {
  init();
  initDomeMode();
}
