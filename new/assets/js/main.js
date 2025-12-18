import { scene, camera, renderer, canvas } from "./3d/scene.js";
import { setupLighting } from "./3d/lighting.js";
import { initPostProcessing, updatePostProcessing } from "./3d/postprocessing.js";
import { setupCameraControls } from "./3d/camera.js";
import { updateMovement } from "./3d/movement.js";
import { loadModel, fbxMeshes, glbLights } from "./3d/model.js";
import { createColorGUI } from "./gui.js";
import { loadSettings, canvasSettings, currentCameraPosition, currentCameraRotation, startCameraPosition, startCameraRotation, saveSettings } from "./settings.js";
import { updateLEDAnimation } from "./3d/led-strip.js";
import { initScrollIncrement } from "./scroll-increment.js";
import { initGridDotsSystem } from "./grid-dots.js";
import { initDashboard } from "./dashboard.js";
import { getCurrentImageTexture, getCurrentVideoTexture } from "./3d/texture.js";
import { textureRotationSettings } from "./settings.js";

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

// Set page sections to 10 rows height (viewport height), 15 rows on mobile
function setPageSectionHeights() {
  const viewportHeight = window.innerHeight;
  const isMobile = window.innerWidth <= 768;
  const rowHeight = viewportHeight / 10;
  const rowsPerSection = isMobile ? 15 : 10; // 15 rows on mobile, 10 rows on desktop
  const sectionHeight = rowHeight * rowsPerSection;

  // Set all page sections to appropriate height
  const pageSections = document.querySelectorAll("main > section");
  pageSections.forEach((section) => {
    section.style.height = `${sectionHeight}px`;
    section.style.minHeight = `${sectionHeight}px`;
  });
}

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

  // Initialize scroll increment functionality
  initScrollIncrement();

  // Initialize grid dots (static background)
  initGridDotsSystem();

  // Initialize dashboard
  initDashboard();

  // Assign indices to all gridded elements (no animation)
  initGridElementIndices();

  // Apply DOME DREAMING font styling
  applyDomeDreamingFont();

  // Set canvas height to match viewport in row-heights
  setCanvasHeight();
  window.addEventListener("resize", setCanvasHeight);

  // Set page section heights to match viewport in row-heights
  setPageSectionHeights();
  window.addEventListener("resize", setPageSectionHeights);

  // Load the 3D model (this will also create the GUI)
  loadModel(createColorGUI);

  // Start render loop
  startRenderLoop();
}

// Render loop
function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  // Update movement
  updateMovement();

  // Update current camera position and rotation from Three.js camera
  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  // Auto-save camera position/rotation to start settings periodically
  const timeSinceLastSave = currentTime - lastCameraSaveTime;
  if (timeSinceLastSave >= CAMERA_SAVE_INTERVAL) {
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
