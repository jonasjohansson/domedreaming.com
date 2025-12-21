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
  exteriorCameraPosition,
  exteriorCameraRotation,
  saveSettings,
} from "./settings.js";
import { updateLEDAnimation } from "./3d/led-strip.js";
import { initScrollIncrement, setScrollProgressCallback, getCameraTransitionProgress, isInCameraTransition } from "./scroll-increment.js";
import { initGridDotsSystem } from "./grid-dots.js";
import { initDashboard } from "./dashboard.js";
import { getCurrentImageTexture, getCurrentVideoTexture, connectWebcam } from "./3d/texture.js";
import { textureRotationSettings } from "./settings.js";
import { initScrollDebug } from "./utils/scroll-debug.js";

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000; // Save camera position every 2 seconds

// Set canvas container to fill entire viewport using rows and columns
function setCanvasHeight() {
  const canvasContainer = document.getElementById("canvas-container");
  const canvasWrapper = document.querySelector(".canvas-wrapper");
  if (!canvasContainer || !canvasWrapper) return;

  // Use CSS row-height so canvas matches exactly 10 grid rows
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  const rowHeight = !isNaN(cssRowHeight) && cssRowHeight > 0 ? cssRowHeight : window.innerHeight / 10;
  const targetHeight = rowHeight * 10;

  canvasContainer.style.height = `${targetHeight}px`;
  canvasContainer.style.padding = "0";
  canvasContainer.style.margin = "0";

  canvasWrapper.style.height = `${targetHeight}px`;
}

// Page section heights are now handled by CSS using row-height calculations
// No JavaScript needed - CSS handles: 10 rows on desktop, 14 rows on mobile

// Map logical row classes (row-*) and dashboard cells to physical grid rows based on viewport
// Logical row remapping (previously used to rescale y-* classes) is disabled.
// Grid placement is now controlled purely by the CSS utility classes (x-*, y-*, w-*, h-*).
const BASE_ROWS = 8;

function updateLogicalRows() {
  // no-op
}

/**
 * Assign indices to all gridded elements (no animation)
 */
function initGridElementIndices() {
  // Find all elements with col- and span- classes (including dashboard cells)
  const gridElements = document.querySelectorAll("[class*='col-'], [class*='span-'], .dashboard-cell");

  if (gridElements.length === 0) return;

  gridElements.forEach((element, index) => {
    // Skip if element already has an index
    if (element.dataset.gridIndex !== undefined) return;

    // Skip elements that are inside other indexed elements to avoid double indexing
    if (element.closest("[data-grid-index]")) return;

    // Assign index
    element.dataset.gridIndex = index;
  });
}

// Wrap "dome dreaming" text instances (case-insensitive) throughout the page with font class
function applyDomeDreamingFont() {
  // Search in the entire main element
  const mainElement = document.querySelector("main");
  if (!mainElement) return;

  // Find all text nodes containing "dome dreaming" (case-insensitive)
  const walker = document.createTreeWalker(mainElement, NodeFilter.SHOW_TEXT, null, false);

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    // Skip if already inside a dome-dreaming-text span
    if (node.parentElement?.classList.contains("dome-dreaming-text")) continue;

    const text = node.textContent;
    // Case-insensitive match for "dome dreaming"
    if (/dome\s+dreaming/i.test(text)) {
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

  // Set up camera transition based on scroll (before model loads)
  setupCameraScrollTransition();

  // Initialize scroll debug tools
  initScrollDebug();

  // Initialize camera transition (no scroll increment - smooth camera transition only)
  initScrollIncrement();

  // Initialize grid dots (static background)
  initGridDotsSystem();

  // Initialize dashboard
  initDashboard();

  // Assign indices to all gridded elements (no animation)
  initGridElementIndices();

  // Apply DOME DREAMING font styling
  applyDomeDreamingFont();

  // Setup webcam link
  const webcamLink = document.getElementById("connect-webcam-link");
  if (webcamLink) {
    webcamLink.addEventListener("click", (e) => {
      e.preventDefault();
      connectWebcam();
    });
  }

  // Set canvas height to match viewport in row-heights
  setCanvasHeight();
  window.addEventListener("resize", setCanvasHeight);

  // Page section heights are handled by CSS (no JavaScript needed)

  // Load the 3D model (this will also create the GUI)
  loadModel(createColorGUI);

  // Start render loop
  startRenderLoop();
}

/**
 * Setup camera transition based on scroll progress
 */
function setupCameraScrollTransition() {
  console.log("[Camera Setup] Initializing camera transition");
  console.log("[Camera Setup] Exterior position:", exteriorCameraPosition);
  console.log("[Camera Setup] Exterior rotation:", exteriorCameraRotation);
  console.log("[Camera Setup] Interior position:", startCameraPosition);
  console.log("[Camera Setup] Interior rotation:", startCameraRotation);

  // Set initial camera position to exterior view
  camera.position.set(exteriorCameraPosition.x, exteriorCameraPosition.y, exteriorCameraPosition.z);
  camera.rotation.set(exteriorCameraRotation.x, exteriorCameraRotation.y, exteriorCameraRotation.z);

  console.log("[Camera Setup] Camera set to exterior position:", camera.position);
  console.log("[Camera Setup] Camera set to exterior rotation:", camera.rotation);

  // Update camera based on scroll progress
  setScrollProgressCallback((progress) => {
    console.log("[Camera Setup] Scroll progress callback triggered with:", progress);
    updateCameraFromScroll(progress);
  });

  // Initial update
  const initialProgress = getCameraTransitionProgress();
  console.log("[Camera Setup] Initial progress:", initialProgress);
  updateCameraFromScroll(initialProgress);
}

/**
 * Update camera position and rotation based on scroll progress
 * @param {number} progress - 0 (exterior) to 1 (interior)
 */
// Cache last progress to avoid unnecessary updates
let lastCameraProgress = -1;
let updateCount = 0;

function updateCameraFromScroll(progress) {
  updateCount++;

  // Clamp progress to 0-1
  progress = Math.max(0, Math.min(1, progress));

  // Always update - don't skip based on progress change
  // The render loop needs to continuously apply the camera position

  // Use linear interpolation for now (can add easing later if needed)
  // Linear is more predictable and directly corresponds to scroll
  const easedProgress = progress;

  // Interpolate position
  const deltaX = startCameraPosition.x - exteriorCameraPosition.x;
  const deltaY = startCameraPosition.y - exteriorCameraPosition.y;
  const deltaZ = startCameraPosition.z - exteriorCameraPosition.z;

  const newX = exteriorCameraPosition.x + deltaX * easedProgress;
  const newY = exteriorCameraPosition.y + deltaY * easedProgress;
  const newZ = exteriorCameraPosition.z + deltaZ * easedProgress;

  // Interpolate rotation
  const deltaRotX = startCameraRotation.x - exteriorCameraRotation.x;
  const deltaRotY = startCameraRotation.y - exteriorCameraRotation.y;
  const deltaRotZ = startCameraRotation.z - exteriorCameraRotation.z;

  const newRotX = exteriorCameraRotation.x + deltaRotX * easedProgress;
  const newRotY = exteriorCameraRotation.y + deltaRotY * easedProgress;
  const newRotZ = exteriorCameraRotation.z + deltaRotZ * easedProgress;

  // Log every 60 frames (roughly once per second at 60fps) or when progress changes significantly
  const progressChanged = Math.abs(progress - lastCameraProgress) > 0.01;
  const shouldLog = updateCount % 60 === 0 || progressChanged;

  if (shouldLog) {
    console.log("[Camera] ===== UPDATE =====");
    console.log("[Camera] Progress:", progress.toFixed(4), `(${(progress * 100).toFixed(1)}%)`, "eased:", easedProgress.toFixed(4));
    console.log("[Camera] Exterior:", exteriorCameraPosition);
    console.log("[Camera] Interior:", startCameraPosition);
    console.log("[Camera] Deltas:", { x: deltaX.toFixed(2), y: deltaY.toFixed(2), z: deltaZ.toFixed(2) });
    console.log("[Camera] Calculated position:", { x: newX.toFixed(4), y: newY.toFixed(4), z: newZ.toFixed(4) });
    console.log("[Camera] Calculated rotation:", { x: newRotX.toFixed(4), y: newRotY.toFixed(4), z: newRotZ.toFixed(4) });
    console.log("[Camera] Camera BEFORE set:", camera.position.clone());
  }

  // Set camera position and rotation
  camera.position.set(newX, newY, newZ);
  camera.rotation.set(newRotX, newRotY, newRotZ);

  // Verify the values were set correctly
  const actualPos = camera.position.clone();
  const actualRot = camera.rotation.clone();
  const posMatches = Math.abs(actualPos.x - newX) < 0.001 && Math.abs(actualPos.y - newY) < 0.001 && Math.abs(actualPos.z - newZ) < 0.001;
  const rotMatches =
    Math.abs(actualRot.x - newRotX) < 0.001 && Math.abs(actualRot.y - newRotY) < 0.001 && Math.abs(actualRot.z - newRotZ) < 0.001;

  if (shouldLog) {
    console.log("[Camera] Camera AFTER set:", actualPos);
    if (!posMatches || !rotMatches) {
      console.error("[Camera] ⚠️ WARNING: Camera values don't match what we set!");
      console.error("[Camera] Position match:", posMatches, "Rotation match:", rotMatches);
    }
    console.log("[Camera] ===================");
    lastCameraProgress = progress;
  }
}

// Render loop
function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Update camera from scroll (only if not in dome mode)
  // Always update based on current progress, even if transition is complete
  if (!document.body.classList.contains("dome-mode")) {
    const progress = getCameraTransitionProgress();
    const inTransition = isInCameraTransition();
    // Update camera based on current progress - this ensures smooth updates every frame
    updateCameraFromScroll(progress);

    // Debug: Log if camera position doesn't match expected (every 60 frames)
    if (updateCount % 60 === 0 && progress > 0 && progress < 1) {
      const expectedX = exteriorCameraPosition.x + (startCameraPosition.x - exteriorCameraPosition.x) * progress;
      const expectedY = exteriorCameraPosition.y + (startCameraPosition.y - exteriorCameraPosition.y) * progress;
      const expectedZ = exteriorCameraPosition.z + (startCameraPosition.z - exteriorCameraPosition.z) * progress;
      const actualX = camera.position.x;
      const actualY = camera.position.y;
      const actualZ = camera.position.z;

      if (Math.abs(actualX - expectedX) > 0.1 || Math.abs(actualY - expectedY) > 0.1 || Math.abs(actualZ - expectedZ) > 0.1) {
        console.warn("[Camera Debug] Position mismatch!");
        console.warn("Expected:", { x: expectedX.toFixed(2), y: expectedY.toFixed(2), z: expectedZ.toFixed(2) });
        console.warn("Actual:", { x: actualX.toFixed(2), y: actualY.toFixed(2), z: actualZ.toFixed(2) });
        console.warn("Progress:", progress, "Delta:", {
          x: (actualX - expectedX).toFixed(2),
          y: (actualY - expectedY).toFixed(2),
          z: (actualZ - expectedZ).toFixed(2),
        });
      }
    }
  }

  // Update movement (only in dome mode)
  if (document.body.classList.contains("dome-mode")) {
    updateMovement();
  }

  // Update current camera position and rotation from Three.js camera
  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  // Auto-save camera position/rotation to start settings periodically
  // BUT: Don't auto-save during camera transition (when not in dome mode)
  // This prevents overwriting the target position while transitioning
  const timeSinceLastSave = currentTime - lastCameraSaveTime;
  const isInTransition = !document.body.classList.contains("dome-mode") && isInCameraTransition();
  if (timeSinceLastSave >= CAMERA_SAVE_INTERVAL && !isInTransition) {
    Object.assign(startCameraPosition, currentCameraPosition);
    Object.assign(startCameraRotation, currentCameraRotation);
    saveSettings(fbxMeshes, glbLights); // Save settings including camera position/rotation
    lastCameraSaveTime = currentTime;
  }

  // Update LED animation
  updateLEDAnimation(deltaTime);

  // Update texture rotation
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
