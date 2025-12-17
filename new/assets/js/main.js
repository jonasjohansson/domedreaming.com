import { scene, camera, renderer, canvas } from "./scene.js";
import { setupLighting } from "./lighting.js";
import { initPostProcessing, updatePostProcessing } from "./postprocessing.js";
import { setupCameraControls } from "./camera.js";
import { updateMovement } from "./movement.js";
import { loadModel } from "./model.js";
import { createColorGUI } from "./gui.js";
import { loadSettings, canvasSettings } from "./settings.js";
import { updateLEDAnimation } from "./led-strip.js";
import { initScrollIncrement } from "./scroll-increment.js";
import { initAnimatedDotsSystem } from "./animated-dots.js";
import { initDashboard } from "./dashboard.js";
import { getCurrentImageTexture, getCurrentVideoTexture } from "./texture.js";
import { textureRotationSettings } from "./settings.js";

let animationFrameId = null;
let lastTime = 0;

// Set canvas container to fill entire viewport using rows and columns
function setCanvasHeight() {
  const canvasContainer = document.getElementById("canvas-container");
  const canvasWrapper = document.querySelector(".canvas-wrapper");
  if (!canvasContainer) return;

  const viewportHeight = window.innerHeight;

  // Canvas and wrapper fill full viewport height
  canvasContainer.style.height = `${viewportHeight}px`;
  canvasContainer.style.padding = "0";
  canvasContainer.style.margin = "0";

  // Also set wrapper height if it exists
  if (canvasWrapper) {
    canvasWrapper.style.height = `${viewportHeight}px`;
  }

  // No octagon mask - canvas fills viewport directly
}

// Set page sections to maximum row-heights that fit in viewport
function setPageSectionHeights() {
  const viewportHeight = window.innerHeight;

  // Set only the first section in main (canvas) to viewport height
  // Later sections are free-flowing
  const pageSections = document.querySelectorAll("main > section");
  if (pageSections.length > 0) {
    // First section (canvas) gets fixed height
    pageSections[0].style.height = `${viewportHeight}px`;
    pageSections[0].style.minHeight = `${viewportHeight}px`;

    // Other sections are free-flowing (no fixed height)
    for (let i = 1; i < pageSections.length; i++) {
      pageSections[i].style.height = "auto";
      pageSections[i].style.minHeight = "auto";
    }
  }
}

// Map logical row classes (row-*) and dashboard cells to physical grid rows based on viewport
const BASE_ROWS = 8;

function updateLogicalRows() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  const rowHeight = !isNaN(cssRowHeight) && cssRowHeight > 0 ? cssRowHeight : window.innerHeight / BASE_ROWS;
  const viewportHeight = window.innerHeight;

  const actualRows = Math.max(1, Math.floor(viewportHeight / rowHeight));

  // Any text / content cell that uses a y-* class will be mapped proportionally
  const logicalCells = document.querySelectorAll(".cell[class*='y-']");

  logicalCells.forEach((cell) => {
    const rowClass = Array.from(cell.classList).find((cls) => cls.startsWith("y-"));
    if (!rowClass) return;

    const logicalRow = parseInt(rowClass.slice(2), 10);
    if (!logicalRow || !BASE_ROWS) return;

    const mappedRow = Math.max(1, Math.round((logicalRow / BASE_ROWS) * actualRows));
    cell.style.gridRowStart = mappedRow;
  });

  // Dashboard image cells: use data-logical-row and data-row-span
  const dashboardCells = document.querySelectorAll(".dashboard-cell[data-logical-row]");

  dashboardCells.forEach((cell) => {
    const logicalRow = parseInt(cell.dataset.logicalRow, 10);
    if (!logicalRow || !BASE_ROWS) return;

    const rowSpan = parseInt(cell.dataset.rowSpan || "1", 10);
    const mappedRow = Math.max(1, Math.round((logicalRow / BASE_ROWS) * actualRows));

    cell.style.gridRow = `${mappedRow} / span ${rowSpan}`;
  });
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

// Wrap "DOME DREAMING" text instances in about section with font class
function applyDomeDreamingFont() {
  const aboutSection = document.querySelector("section.about");
  if (!aboutSection) return;

  // Find all text nodes containing "DOME DREAMING"
  const walker = document.createTreeWalker(aboutSection, NodeFilter.SHOW_TEXT, null, false);

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.includes("DOME DREAMING")) {
      textNodes.push(node);
    }
  }

  // Process each text node
  textNodes.forEach((textNode) => {
    const parent = textNode.parentNode;
    if (!parent) return;

    const text = textNode.textContent;
    const parts = text.split(/(DOME DREAMING)/g);

    // Create document fragment with wrapped text
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part === "DOME DREAMING") {
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

  // Initialize animated dots
  initAnimatedDotsSystem();

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

  // Map logical rows to current viewport rows
  updateLogicalRows();
  window.addEventListener("resize", updateLogicalRows);

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
