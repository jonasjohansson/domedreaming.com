/**
 * Canvas-based grid line animation
 * Draws animated lines between the dots
 */

let gridCanvas = null;
let gridCtx = null;
let animationFrame = null;
let animationTime = 0;

const GRID_COLUMNS = 12;
const ANIMATION_SPEED = 2; // pixels per frame - faster for single line
const LINE_SEGMENT_LENGTH = 40; // Length of the visible line segment

function getGridDimensions() {
  const colWidth = window.innerWidth / GRID_COLUMNS;
  const rowHeight = colWidth;
  return { colWidth, rowHeight };
}

function animateGrid() {
  animationFrame = requestAnimationFrame(animateGrid);

  if (!gridCtx || !gridCanvas) return;

  const { colWidth, rowHeight } = getGridDimensions();
  const lineOpacity = 0.8;

  // Clear canvas - no static lines, only animated line
  gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  gridCtx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
  gridCtx.lineWidth = 1;

  // Update animation time
  animationTime += ANIMATION_SPEED;

  // Calculate grid dimensions
  const totalCols = GRID_COLUMNS;
  const totalRows = Math.ceil(gridCanvas.height / rowHeight);

  // Calculate total path: all horizontal lines + all vertical lines
  // Horizontal lines: each row goes left to right
  const horizontalLinesLength = totalRows * (totalCols * colWidth);
  // Vertical lines: each column goes top to bottom
  const verticalLinesLength = totalCols * (totalRows * rowHeight);
  const totalPathLength = horizontalLinesLength + verticalLinesLength;

  // Current position along the path (0 to totalPathLength)
  const currentPos = animationTime % totalPathLength;

  let pathPosition = 0;

  // Draw horizontal lines (left to right, top to bottom)
  for (let row = 0; row < totalRows; row++) {
    const y = (row + 0.5) * rowHeight; // Center of row (where dots are)
    const linePathLength = totalCols * colWidth;

    if (currentPos >= pathPosition && currentPos < pathPosition + linePathLength) {
      // We're on this horizontal line
      const localPos = currentPos - pathPosition;
      const halfLength = LINE_SEGMENT_LENGTH / 2;
      const startX = Math.max(0, localPos - halfLength);
      const endX = Math.min(totalCols * colWidth, localPos + halfLength);

      gridCtx.beginPath();
      gridCtx.moveTo(startX, y);
      gridCtx.lineTo(endX, y);
      gridCtx.stroke();
      break; // Only draw one line segment
    }

    pathPosition += linePathLength;
  }

  // Draw vertical lines (top to bottom, left to right)
  if (currentPos >= pathPosition) {
    for (let col = 0; col < totalCols; col++) {
      const x = (col + 0.5) * colWidth; // Center of column (where dots are)
      const linePathLength = totalRows * rowHeight;

      if (currentPos >= pathPosition && currentPos < pathPosition + linePathLength) {
        // We're on this vertical line
        const localPos = currentPos - pathPosition;
        const halfLength = LINE_SEGMENT_LENGTH / 2;
        const startY = Math.max(0, localPos - halfLength);
        const endY = Math.min(totalRows * rowHeight, localPos + halfLength);

        gridCtx.beginPath();
        gridCtx.moveTo(x, startY);
        gridCtx.lineTo(x, endY);
        gridCtx.stroke();
        break; // Only draw one line segment
      }

      pathPosition += linePathLength;
    }
  }
}

export function initGridAnimation() {
  const overlay = document.querySelector(".animated-lines-overlay");
  if (!overlay) return;

  // Create canvas
  gridCanvas = document.createElement("canvas");
  gridCanvas.style.position = "fixed";
  gridCanvas.style.top = "0";
  gridCanvas.style.left = "0";
  gridCanvas.style.width = "100vw";
  gridCanvas.style.height = "100vh";
  gridCanvas.style.pointerEvents = "none";
  gridCanvas.style.zIndex = "9997";
  gridCanvas.width = window.innerWidth;
  gridCanvas.height = window.innerHeight;

  gridCtx = gridCanvas.getContext("2d");
  overlay.appendChild(gridCanvas);

  // Start animation
  animateGrid();

  // Handle resize
  window.addEventListener("resize", () => {
    if (gridCanvas) {
      gridCanvas.width = window.innerWidth;
      gridCanvas.height = window.innerHeight;
    }
  });
}




