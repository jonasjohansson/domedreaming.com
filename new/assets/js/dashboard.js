/**
 * Dashboard functionality
 * Uses existing dashboard blocks in the HTML and
 * makes them draggable and resizable.
 */

/**
 * Make a dashboard block draggable with grid snapping
 */
function makeDraggable(block) {
  let isDragging = false;
  let startX, startY, startCol, startRow;
  let hasMoved = false; // Track if block has been moved
  let mouseMoved = false; // Track if mouse moved significantly (indicates drag)

  block.addEventListener("mousedown", (e) => {
    isDragging = true;
    mouseMoved = false;
    block.classList.add("dragging");

    const container = block.parentElement;
    if (!container) return;

    startX = e.clientX;
    startY = e.clientY;

    // Parse gridColumn and gridRow to get start position and span
    const gridCol = block.style.gridColumn;
    const gridRow = block.style.gridRow;

    // Extract start position (before "/ span" or just the number)
    startCol = gridCol.includes("/") ? parseInt(gridCol.split("/")[0].trim(), 10) : parseInt(gridCol, 10);
    startRow = gridRow.includes("/") ? parseInt(gridRow.split("/")[0].trim(), 10) : parseInt(gridRow, 10);

    // Extract span values
    const colSpan = gridCol.includes("span") ? parseInt(gridCol.split("span")[1].trim(), 10) : 1;
    const rowSpan = gridRow.includes("span") ? parseInt(gridRow.split("span")[1].trim(), 10) : 1;

    // Store spans for later use
    block.dataset.colSpan = String(colSpan);
    block.dataset.rowSpan = String(rowSpan);

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const container = block.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const colWidth = containerRect.width / 14; // 14 columns
    const rowHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-height")) || colWidth;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Check if mouse moved significantly (more than 5px) - indicates drag
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      mouseMoved = true;
    }

    const colOffset = Math.round(deltaX / colWidth);
    const rowOffset = Math.round(deltaY / rowHeight);

    const currentColSpan = parseInt(block.dataset.colSpan || "1", 10);
    const newCol = Math.max(1, Math.min(14 - currentColSpan + 1, startCol + colOffset));
    const newRow = Math.max(1, startRow + rowOffset);

    // Check if position actually changed
    if (newCol !== startCol || newRow !== startRow) {
      hasMoved = true;
      block.dataset.hasMoved = "true";
    }

    // Preserve the span when updating position
    const colSpan = block.dataset.colSpan || "1";
    const rowSpan = block.dataset.rowSpan || "1";

    block.style.gridColumn = `${newCol} / span ${colSpan}`;
    block.style.gridRow = `${newRow} / span ${rowSpan}`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      block.classList.remove("dragging");
      // Store mouse movement state for click handler
      block.dataset.mouseMoved = mouseMoved ? "true" : "false";
      // Reset after a short delay to allow click handler to check
      setTimeout(() => {
        block.dataset.mouseMoved = "false";
      }, 100);
    }
  });
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
  const colWidth = containerRect.width / 14; // 14 columns
  const rowHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--row-height")) || colWidth;

  // Parse current grid position
  const gridCol = block.style.gridColumn;
  const gridRow = block.style.gridRow;

  let startCol = gridCol.includes("/") ? parseInt(gridCol.split("/")[0].trim(), 10) : parseInt(gridCol, 10);
  let startRow = gridRow.includes("/") ? parseInt(gridRow.split("/")[0].trim(), 10) : parseInt(gridRow, 10);
  let startColSpan = gridCol.includes("span") ? parseInt(gridCol.split("span")[1].trim(), 10) : 1;
  let startRowSpan = gridRow.includes("span") ? parseInt(gridRow.split("span")[1].trim(), 10) : 1;

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
      newColSpan = Math.min(14 - startCol - 1 + 1, newColSpan);
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

    block.style.gridColumn = `${newCol} / span ${newColSpan}`;
    block.style.gridRow = `${newRow} / span ${newRowSpan}`;

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
  });
}



