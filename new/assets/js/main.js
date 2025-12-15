import { scene, camera, renderer, canvas } from "./scene.js";
import { setupLighting } from "./lighting.js";
import { initPostProcessing, updatePostProcessing } from "./postprocessing.js";
import { setupCameraControls } from "./camera.js";
import { updateMovement } from "./movement.js";
import { loadModel } from "./model.js";
import { createColorGUI } from "./gui.js";
import { loadSettings, canvasSettings } from "./settings.js";
import { updateLEDAnimation } from "./led-strip.js";
import { initVerticalBars } from "./vertical-bars.js";
import { initScrollIncrement } from "./scroll-increment.js";
import { initAnimatedDotsSystem } from "./animated-dots.js";

let animationFrameId = null;
let lastTime = 0;

// Set canvas container height to at least 80% of viewport, rounded to row height
function setCanvasHeight() {
  const canvasContainer = document.getElementById("canvas-container");
  const canvasWrapper = document.querySelector(".canvas-wrapper");
  if (!canvasContainer) return;

  // Use CSS variable for grid columns to match the grid system
  const gridColumns = 14;
  const colWidth = window.innerWidth / gridColumns;
  const rowHeight = colWidth;
  const viewportHeight = window.innerHeight;

  // Calculate 80% of viewport height
  const targetHeight = viewportHeight * 0.8;

  // Calculate number of rows needed to reach at least 80% of viewport
  // Round up to ensure we're at least 80%
  const numberOfRows = Math.ceil(targetHeight / rowHeight);

  // Set height to be multiple of row-height, based on page width
  const height = numberOfRows * rowHeight;
  canvasContainer.style.height = `${height}px`;
  canvasContainer.style.padding = "0";
  canvasContainer.style.margin = "0";

  // Also set wrapper height if it exists
  if (canvasWrapper) {
    canvasWrapper.style.height = `${height}px`;
  }
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

  // Initialize vertical bars
  initVerticalBars();

  // Initialize scroll increment functionality
  initScrollIncrement();

  // Initialize animated dots
  initAnimatedDotsSystem();

  // Apply DOME DREAMING font styling
  applyDomeDreamingFont();

  // Set canvas height to match viewport in row-heights
  setCanvasHeight();
  window.addEventListener("resize", setCanvasHeight);

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

  // Update post-processing and render
  updatePostProcessing();
}

function startRenderLoop() {
  lastTime = performance.now();
  animate(lastTime);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
