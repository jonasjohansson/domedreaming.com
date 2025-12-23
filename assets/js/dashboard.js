/**
 * Dashboard functionality
 * Uses existing dashboard blocks in the HTML and
 * makes them draggable and resizable.
 * Works with utility classes (x-, w-, y-, h-) instead of inline styles.
 */

/**
 * Handle image click to bring to front
 */
function handleImageClick(block) {
  // Remove active class from all images
  document.querySelectorAll(".dashboard-block.active, .page-content .block.active").forEach((el) => {
    el.classList.remove("active");
  });

  // Add active class to clicked image
  block.classList.add("active");
}

/**
 * Get current position from utility classes
 */
function getPositionFromClasses(block) {
  let col = 1;
  let row = 1;
  let colSpan = 1;
  let rowSpan = 1;

  // Find x- class (column start)
  const xMatch = block.className.match(/x-(\d+)/);
  if (xMatch) col = parseInt(xMatch[1], 10);

  // Find w- class (column span)
  const wMatch = block.className.match(/w-(\d+)/);
  if (wMatch) colSpan = parseInt(wMatch[1], 10);

  // Find y- class (row start)
  const yMatch = block.className.match(/y-(\d+)/);
  if (yMatch) row = parseInt(yMatch[1], 10);

  // Find h- class (row span)
  const hMatch = block.className.match(/h-(\d+)/);
  if (hMatch) rowSpan = parseInt(hMatch[1], 10);

  return { col, row, colSpan, rowSpan };
}

/**
 * Update utility classes based on position
 */
function updatePositionClasses(block, col, row, colSpan, rowSpan) {
  // Remove old position classes
  block.className = block.className
    .replace(/\bx-\d+\b/g, "")
    .replace(/\bw-\d+\b/g, "")
    .replace(/\by-\d+\b/g, "")
    .replace(/\bh-\d+\b/g, "");

  // Add new position classes
  block.classList.add(`x-${col}`, `w-${colSpan}`, `y-${row}`, `h-${rowSpan}`);
}

/**
 * Make a dashboard block draggable with grid snapping
 */
function makeDraggable(block) {
  let isDragging = false;
  let startX, startY, startCol, startRow;
  let offsetX, offsetY; // Offset from mouse/touch to block's top-left corner
  let hasMoved = false; // Track if block has been moved
  let mouseMoved = false; // Track if mouse/touch moved significantly (indicates drag)

  // Shared function to handle drag movement (works for both mouse and touch)
  function handleDragMove(clientX, clientY) {
    if (!isDragging) return;

    const container = block.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const gridColumns = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--grid-columns")) || 12;
    const colWidth = containerRect.width / gridColumns;
    const rowHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-height")) || colWidth;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    // Check if moved significantly (more than 5px) - indicates drag
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      mouseMoved = true;
    }

    // Calculate which grid cell the clicked point (position - offset) is over
    // This ensures the block follows the cursor/finger from where it was clicked
    const pointerX = clientX - containerRect.left;
    const pointerY = clientY - containerRect.top;

    // The clicked point in the block should stay under the cursor/finger
    // So we calculate which grid cell that point should be in
    const clickedPointX = pointerX - offsetX;
    const clickedPointY = pointerY - offsetY;

    const targetCol = Math.floor(clickedPointX / colWidth) + 1;
    const targetRow = Math.floor(clickedPointY / rowHeight) + 1;

    const currentColSpan = parseInt(block.dataset.colSpan || "1", 10);
    const newCol = Math.max(1, Math.min(gridColumns - currentColSpan + 1, targetCol));
    const newRow = Math.max(1, targetRow);

    // Check if position actually changed
    if (newCol !== startCol || newRow !== startRow) {
      hasMoved = true;
      block.dataset.hasMoved = "true";
    }

    // Preserve the span when updating position
    const colSpan = block.dataset.colSpan || "1";
    const rowSpan = block.dataset.rowSpan || "1";

    // Update utility classes instead of inline styles - this snaps to grid during drag
    updatePositionClasses(block, newCol, newRow, parseInt(colSpan, 10), parseInt(rowSpan, 10));
  }

  // Mouse events
  block.addEventListener("mousedown", (e) => {
    isDragging = true;
    mouseMoved = false;
    hasMoved = false;
    block.classList.add("dragging");

    const container = block.parentElement;
    if (!container) return;

    const blockRect = block.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate offset from mouse position to block's top-left corner
    offsetX = e.clientX - blockRect.left;
    offsetY = e.clientY - blockRect.top;

    startX = e.clientX;
    startY = e.clientY;

    // Get position from utility classes
    const pos = getPositionFromClasses(block);
    startCol = pos.col;
    startRow = pos.row;

    // Store spans for later use
    block.dataset.colSpan = String(pos.colSpan);
    block.dataset.rowSpan = String(pos.rowSpan);

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    handleDragMove(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      block.classList.remove("dragging");
      // Store mouse movement state for click handler
      block.dataset.mouseMoved = mouseMoved ? "true" : "false";
      // If mouse didn't move significantly, trigger click for z-index
      if (!mouseMoved && !hasMoved) {
        setTimeout(() => {
          handleImageClick(block);
        }, 10);
      }
      // Reset after a short delay to allow click handler to check
      setTimeout(() => {
        block.dataset.mouseMoved = "false";
      }, 100);
    }
  });

  // Touch events for mobile
  block.addEventListener(
    "touchstart",
    (e) => {
      // Don't interfere with camera controls in dome mode
      if (document.body.classList.contains("dome-mode")) return;

      isDragging = true;
      mouseMoved = false;
      hasMoved = false;
      block.classList.add("dragging");

      const container = block.parentElement;
      if (!container) return;

      const touch = e.touches[0];
      const blockRect = block.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate offset from touch position to block's top-left corner
      offsetX = touch.clientX - blockRect.left;
      offsetY = touch.clientY - blockRect.top;

      startX = touch.clientX;
      startY = touch.clientY;

      // Get position from utility classes
      const pos = getPositionFromClasses(block);
      startCol = pos.col;
      startRow = pos.row;

      // Store spans for later use
      block.dataset.colSpan = String(pos.colSpan);
      block.dataset.rowSpan = String(pos.rowSpan);

      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging) return;
      // Don't interfere with camera controls in dome mode
      if (document.body.classList.contains("dome-mode")) return;

      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (isDragging) {
        isDragging = false;
        block.classList.remove("dragging");
        // Store touch movement state for click handler
        block.dataset.mouseMoved = mouseMoved ? "true" : "false";
        // If touch didn't move significantly, trigger click for z-index
        if (!mouseMoved && !hasMoved) {
          setTimeout(() => {
            handleImageClick(block);
          }, 10);
        }
        // Reset after a short delay to allow click handler to check
        setTimeout(() => {
          block.dataset.mouseMoved = "false";
        }, 100);
      }
    },
    { passive: false }
  );
}

/**
 * Make a dashboard block resizable with grid snapping
 * Resize handles adjust width (cols) and height (rows) from edges/corners.
 */
function makeResizable(block) {
  const directions = ["e", "w", "n", "s", "ne", "nw", "se", "sw"];

  directions.forEach((dir) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle resize-handle-${dir}`;
    handle.addEventListener("mousedown", (e) => startResize(e, block, dir));
    block.appendChild(handle);
  });
}

function startResize(event, block, direction) {
  event.preventDefault();
  event.stopPropagation(); // Prevent dragging from starting

  let isResizing = true;
  const startX = event.clientX;
  const startY = event.clientY;

  const container = block.parentElement;
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const gridColumns = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--grid-columns")) || 12;
  const colWidth = containerRect.width / gridColumns;
  const rowHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-height")) || colWidth;

  // Get current position from utility classes
  const pos = getPositionFromClasses(block);
  let startCol = pos.col;
  let startRow = pos.row;
  let startColSpan = pos.colSpan;
  let startRowSpan = pos.rowSpan;

  function onMouseMove(e) {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    let newCol = startCol;
    let newRow = startRow;
    let newColSpan = startColSpan;
    let newRowSpan = startRowSpan;

    // Horizontal resize
    if (direction.includes("e")) {
      const deltaCols = Math.round(deltaX / colWidth);
      newColSpan = Math.max(1, startColSpan + deltaCols);
      newColSpan = Math.min(gridColumns - startCol + 1, newColSpan);
    }
    if (direction.includes("w")) {
      const deltaCols = Math.round(deltaX / colWidth);
      newCol = Math.max(1, Math.min(startCol + deltaCols, startCol + startColSpan - 1));
      const diff = startCol - newCol;
      newColSpan = Math.max(1, startColSpan + diff);
    }

    // Vertical resize
    if (direction.includes("s")) {
      const deltaRows = Math.round(deltaY / rowHeight);
      newRowSpan = Math.max(1, startRowSpan + deltaRows);
    }
    if (direction.includes("n")) {
      const deltaRows = Math.round(deltaY / rowHeight);
      newRow = Math.max(1, Math.min(startRow + deltaRows, startRow + startRowSpan - 1));
      const diff = startRow - newRow;
      newRowSpan = Math.max(1, startRowSpan + diff);
    }

    // Update utility classes instead of inline styles
    updatePositionClasses(block, newCol, newRow, newColSpan, newRowSpan);

    block.dataset.colSpan = String(newColSpan);
    block.dataset.rowSpan = String(newRowSpan);
    block.dataset.logicalRow = String(newRow);
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

/**
 * Initialize dashboard
 */
export function initDashboard() {
  // Find any existing dashboard blocks marked as draggable
  const blocks = document.querySelectorAll(".dashboard-block.draggable");
  blocks.forEach((block) => {
    makeDraggable(block);
    makeResizable(block);

    // Click handler is handled in mouseup if no drag occurred
  });

  // Also handle page-content images (non-draggable images)
  const pageContentImages = document.querySelectorAll(".page-content .block img");
  pageContentImages.forEach((img) => {
    const block = img.closest(".block");
    if (block) {
      block.addEventListener("click", () => {
        handleImageClick(block);
      });
    }
  });
}
