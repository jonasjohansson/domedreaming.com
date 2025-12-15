/**
 * Grid dots functionality
 * Creates grid dots using DOM elements grouped by rows
 */

let dotsContainer = null;
let gridColumns = 14;
let colWidth = 0;
let rowHeight = 0;

/**
 * Initialize animated dots
 */
function initAnimatedDots() {
  // Remove existing container if any
  const existingContainer = document.getElementById("animated-dots-container");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create container
  dotsContainer = document.createElement("div");
  dotsContainer.id = "animated-dots-container";
  document.body.appendChild(dotsContainer);

  updateDotsSize();
  createDotElements();
}

/**
 * Update dots size and grid calculations
 */
function updateDotsSize() {
  // Use CSS variable for col-width to match the grid system
  const colWidthCSS = getComputedStyle(document.documentElement).getPropertyValue("--col-width");
  if (colWidthCSS) {
    // Extract numeric value from CSS (e.g., "calc(100vw / 12)" or "83.33px")
    colWidth = parseFloat(colWidthCSS) || window.innerWidth / gridColumns;
  } else {
    colWidth = window.innerWidth / gridColumns;
  }
  rowHeight = colWidth;
}

/**
 * Create dot elements grouped by rows (12 dots per row)
 */
function createDotElements() {
  if (!dotsContainer) return;

  // Clear existing dots
  dotsContainer.innerHTML = "";

  // Calculate how many rows we need to cover the viewport
  const viewportRows = Math.ceil(window.innerHeight / rowHeight);

  // Create dots grouped by rows - fixed position
  for (let row = 0; row < viewportRows; row++) {
    // Create a row container for 12 dots
    const rowContainer = document.createElement("div");
    rowContainer.className = "dot-row";

    // Create 12 dots for this row (one per column)
    for (let col = 0; col < gridColumns; col++) {
      const dot = document.createElement("div");
      dot.className = "animated-dot";
      dot.dataset.col = col + 1; // 1-indexed
      dot.dataset.row = row + 1; // 1-indexed
      // Set grid position using data attributes
      dot.style.gridColumn = col + 1;
      dot.style.gridRow = row + 1;

      rowContainer.appendChild(dot);
    }

    dotsContainer.appendChild(rowContainer);
  }
}

/**
 * Initialize and export
 */
export function initAnimatedDotsSystem() {
  initAnimatedDots();

  // Update on resize to recreate dots for new viewport size
  window.addEventListener("resize", () => {
    updateDotsSize();
    createDotElements();
  });
}
