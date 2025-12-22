import * as THREE from "three";
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
// Removed continuous orbit - camera only moves based on scroll

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

  // Look at target point (0, 6, 8) - this will remain until entering dome mode
  const lookAtTarget = new THREE.Vector3(0, 6, 8);
  camera.lookAt(lookAtTarget);

  // Store lookAt target for use during transition
  window.cameraLookAtTarget = lookAtTarget;
  window.cameraLookAtEnabled = true; // Enabled until entering dome mode

  console.log("[Camera Setup] Camera set to exterior position (above):", camera.position);
  console.log("[Camera Setup] Camera set to exterior rotation (looking down):", camera.rotation);
  console.log("[Camera Setup] Rotation in degrees:", {
    x: ((exteriorCameraRotation.x * 180) / Math.PI).toFixed(2) + "°",
    y: ((exteriorCameraRotation.y * 180) / Math.PI).toFixed(2) + "°",
    z: ((exteriorCameraRotation.z * 180) / Math.PI).toFixed(2) + "°",
  });
  console.log("[Camera Setup] Expected: position (0, 12, 30), rotation (-8°, 0, 0°)");
  console.log("[Camera Setup] Actual position:", `(${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
  console.log(
    "[Camera Setup] Actual rotation:",
    `(${((camera.rotation.x * 180) / Math.PI).toFixed(2)}°, ${((camera.rotation.y * 180) / Math.PI).toFixed(2)}°, ${(
      (camera.rotation.z * 180) /
      Math.PI
    ).toFixed(2)}°)`
  );

  // Check if model is loaded and visible
  const model = document.querySelector('[id*="dome"]') || window.wisdomeModel;
  if (model) {
    console.log("[Camera Setup] Model found at position:", model.position || "N/A");
  } else {
    console.warn("[Camera Setup] Model not found - camera might be looking at empty space");
  }

  // Expose test function to try different positions
  window.testCameraPosition = function (x, y, z) {
    camera.position.set(x, y, z);
    camera.lookAt(new THREE.Vector3(0, 5, 0));
    console.log(`[Camera Test] Set to (${x}, ${y}, ${z}), rotation:`, camera.rotation);
  };

  console.log("[Camera Setup] Test different positions with: testCameraPosition(x, y, z)");
  console.log("[Camera Setup] Try: testCameraPosition(0, 5, 50) or testCameraPosition(0, 5, -50)");
  console.log("[Camera Setup] Or: testCameraPosition(50, 5, 0) or testCameraPosition(-50, 5, 0)");

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
let lastCameraQuaternion = new THREE.Quaternion();

function updateCameraFromScroll(progress) {
  updateCount++;

  // Clamp progress to 0-1
  progress = Math.max(0, Math.min(1, progress));

  // LookAt target point (remains constant during transition)
  const lookAtTarget = window.cameraLookAtTarget || new THREE.Vector3(0, 6, 8);
  const lookAtEnabled = window.cameraLookAtEnabled !== false; // Default to true, disabled in dome mode

  // Smooth easing function for natural transition
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easedProgress = easeInOutCubic(progress);

  // Calculate orbit around Y axis
  // Start from exterior position, orbit around lookAt target, end at interior position
  const startPos = new THREE.Vector3(exteriorCameraPosition.x, exteriorCameraPosition.y, exteriorCameraPosition.z);
  const endPos = new THREE.Vector3(startCameraPosition.x, startCameraPosition.y, startCameraPosition.z);

  // Calculate distance from lookAt target for start and end positions
  const startOffset = startPos.clone().sub(lookAtTarget);
  const endOffset = endPos.clone().sub(lookAtTarget);

  // Get horizontal distance and angle for start position
  const startDistance = Math.sqrt(startOffset.x * startOffset.x + startOffset.z * startOffset.z);
  const startAngle = Math.atan2(startOffset.z, startOffset.x);
  const startHeight = startOffset.y;

  // Get horizontal distance and angle for end position
  const endDistance = Math.sqrt(endOffset.x * endOffset.x + endOffset.z * endOffset.z);
  const endAngle = Math.atan2(endOffset.z, endOffset.x);
  const endHeight = endOffset.y;

  // Interpolate: orbit around Y axis while moving from start to end
  // The orbit angle smoothly transitions from startAngle to endAngle
  const orbitAngle = startAngle + (endAngle - startAngle) * easedProgress;
  const orbitDistance = startDistance + (endDistance - startDistance) * easedProgress;
  const orbitHeight = startHeight + (endHeight - startHeight) * easedProgress;

  // Calculate new position orbiting around Y axis
  const newX = lookAtTarget.x + Math.cos(orbitAngle) * orbitDistance;
  const newY = lookAtTarget.y + orbitHeight;
  const newZ = lookAtTarget.z + Math.sin(orbitAngle) * orbitDistance;

  // Set camera position
  camera.position.set(newX, newY, newZ);

  // Apply lookAt if enabled (disabled when in dome mode)
  if (lookAtEnabled) {
    // During transition: blend between lookAt rotation and final rotation
    // At progress 0: full lookAt, at progress 1: full final rotation
    const tempCamera = new THREE.PerspectiveCamera();
    tempCamera.position.set(newX, newY, newZ);
    tempCamera.lookAt(lookAtTarget);
    const lookAtQuaternion = tempCamera.quaternion.clone();

    // Get final rotation as quaternion
    const finalEuler = new THREE.Euler(startCameraRotation.x, startCameraRotation.y, startCameraRotation.z, "YXZ");
    const finalQuaternion = new THREE.Quaternion().setFromEuler(finalEuler);

    // Blend between lookAt and final rotation based on progress
    // Use eased progress for smooth transition
    camera.quaternion.copy(lookAtQuaternion);
    camera.quaternion.slerp(finalQuaternion, easedProgress);
    camera.rotation.setFromQuaternion(camera.quaternion);
  } else {
    // In dome mode, use the final rotation directly
    camera.rotation.set(startCameraRotation.x, startCameraRotation.y, startCameraRotation.z);
    camera.quaternion.setFromEuler(new THREE.Euler(startCameraRotation.x, startCameraRotation.y, startCameraRotation.z, "YXZ"));
  }

  // Store current quaternion for next frame continuity check
  lastCameraQuaternion.copy(camera.quaternion);

  // Log every 60 frames (roughly once per second at 60fps) or when progress changes significantly
  const progressChanged = Math.abs(progress - lastCameraProgress) > 0.01;
  const shouldLog = updateCount % 60 === 0 || progressChanged;

  if (shouldLog) {
    console.log("[Camera] ===== ORBIT TRANSITION =====");
    console.log("[Camera] Progress:", progress.toFixed(4), `(${(progress * 100).toFixed(1)}%)`);
    console.log("[Camera] LookAt enabled:", lookAtEnabled);
    console.log("[Camera] LookAt target:", `(${lookAtTarget.x}, ${lookAtTarget.y}, ${lookAtTarget.z})`);
    console.log("[Camera] Current position:", { x: newX.toFixed(4), y: newY.toFixed(4), z: newZ.toFixed(4) });
    console.log("[Camera] Orbit angle:", ((orbitAngle * 180) / Math.PI).toFixed(2) + "°");
    console.log("[Camera] Orbit distance:", orbitDistance.toFixed(2));
    console.log("[Camera] ===================");
    lastCameraProgress = progress;
  }
}

// Render loop
function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Update camera from scroll (only if not in dome mode and debug mode is off)
  // Always update based on current progress, even if transition is complete
  if (!document.body.classList.contains("dome-mode")) {
    // Check if camera debug mode is enabled (skip scroll updates if so)
    const debugModeEnabled = window.cameraDebugControls && window.cameraDebugControls.enabled;
    if (!debugModeEnabled) {
      const progress = getCameraTransitionProgress();
      // Update camera based on current progress - this ensures smooth updates every frame
      // Camera only moves when scroll changes, no automatic spinning
      updateCameraFromScroll(progress);
    } else {
      // Update debug controls display
      if (window.cameraDebugControls.update) {
        window.cameraDebugControls.update();
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

    // Disable lookAt when entering dome mode - user can freely look around
    window.cameraLookAtEnabled = false;

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

      // Re-enable lookAt when exiting dome mode
      window.cameraLookAtEnabled = true;

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
