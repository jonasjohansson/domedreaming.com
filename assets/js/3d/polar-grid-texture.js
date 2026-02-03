import * as THREE from "three";
import { updatePulseAudio, createPulseSynths, isAudioEnabled, getTickIntensity, updateTickIntensity, getActivePulseIndex, setTotalPulseCount } from "./pulse-audio.js";

// GUI settings - exported so they can be modified externally
export const polarGridSettings = {
  // Global font size multiplier (affects all text)
  globalFontSize: 100,
  // Text 1 settings (Cell Mode: each character fits in one cell)
  text1Row: 3, // Circle number (1 = innermost, 8 = outermost)
  text1FlipX: true,
  text1FlipY: true,
  text1FontSize: 100, // percentage of cell size
  text1StartSector: 24,
  text1Content: "STHLM 7-9 MAY",
  text1CellMode: true, // Each character fits in one cell
  // Text 2 settings
  text2Row: 4,
  text2FlipX: true,
  text2FlipY: true,
  text2FontSize: 100,
  text2StartSector: 23,
  text2Content: "MALMÖ 12 MAY",
  text2CellMode: true,
  // Text 3 settings
  text3Row: 5,
  text3FlipX: true,
  text3FlipY: true,
  text3FontSize: 100,
  text3StartSector: 24,
  text3Content: "DOME DREAMING",
  text3CellMode: true,
  // Text 4 settings
  text4Row: 6,
  text4FlipX: true,
  text4FlipY: true,
  text4FontSize: 100,
  text4StartSector: 28,
  text4Content: "FULLDOME FILM FESTIVAL",
  text4CellMode: true,
  // Text 5 settings
  text5Row: 7,
  text5FlipX: true,
  text5FlipY: true,
  text5FontSize: 100,
  text5StartSector: 27,
  text5Content: "OPEN CALL IS LIVE!",
  text5CellMode: true,
  // Label flip options
  labelsFlipX: false,
  labelsFlipY: true,
  // Grid line color
  gridLineColor: "#ffffff",
  // Rim and line settings
  rimOffset: 0.02,
  lineWidth: 2,
  tickWidth: 1,
  // Antialiasing
  antialias: true,
  // Dot size (center point and grid intersection dots)
  dotSize: 4,
  // Pulse animation settings
  pulsesEnabled: true,
  pulseCount: 8,
  pulseSpeed: 0.5,
  pulseSize: 12,
  pulseGlow: true,
  // Typography rotation (independent of grid)
  textRotationEnabled: false, // Typography rotation disabled by default
  textRotationSpeed: -0.3, // Negative = opposite direction (used for continuous mode)
  textStepRotation: true, // Step by one cell width in sync with BPM
  textRotationBPM: 30, // BPM for step rotation
  // Text scramble effect
  textScrambleEnabled: true,
  textScrambleChance: 0.08, // Higher chance per frame for more random scrambling
  textScrambleDuration: 200, // Shorter duration for snappier effect
  // Text styling for contrast
  textOutline: false, // Draw outline around text
  textOutlineColor: "#000000",
  textOutlineWidth: 3,
  textShadow: false, // Draw shadow behind text
  textShadowBlur: 8,
  textShadowColor: "#000000",
  textVerticalOffset: 0.6, // 0 = inner edge, 0.5 = center, 1 = outer edge
  // Cell pattern animation settings
  cellAnimationEnabled: true,
  cellAnimationSpeed: 0.5,
  cellPatternDensity: 0.25, // percentage of cells with patterns
  // Image cells settings
  imageCellsEnabled: true,
  imageCellCount: 12,
  imageThreshold: true,
  imageThresholdLevel: 0.5,
  // Colors (will be set from mesh colors)
  mainColor: null,
  chairsColor: null,
  floorColor: null,
  // Function to regenerate texture (set later)
  regenerate: null,
};

// Mobile detection for performance optimization
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0);

// Animation throttling for mobile
let lastAnimFrame = 0;
const MOBILE_FRAME_INTERVAL = 33; // ~30fps on mobile vs 60fps on desktop

/**
 * Convert RGB object (0-1) to hex string
 */
function rgbToHex(color) {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Draw a single line of text along a circular arc with flip options
 * flipX: reverses the text order (reads backwards)
 * flipY: flips each letter upside down
 */
function drawSingleLineOnArc(ctx, text, centerX, centerY, radius, startAngle, fontSize, color, letterSpacing, flipX, flipY) {
  ctx.font = `${fontSize}px OffBit, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const chars = text.split('');
  const totalAngle = chars.length * letterSpacing;

  // flipX reverses the text direction around the arc
  const direction = flipX ? -1 : 1;
  let currentAngle = startAngle - (totalAngle / 2) * direction;

  for (const char of chars) {
    const x = centerX + Math.cos(currentAngle) * radius;
    const y = centerY + Math.sin(currentAngle) * radius;

    ctx.save();
    ctx.translate(x, y);

    // Rotate to follow the arc - add PI to flip text to face outward
    let rotation = currentAngle + Math.PI / 2;
    if (flipY) {
      rotation += Math.PI; // Flip the letter orientation
    }
    ctx.rotate(rotation);

    ctx.fillText(char, 0, 0);
    ctx.restore();

    currentAngle += letterSpacing * direction;
  }
}

/**
 * Draw text along a circular arc with flip options
 * Supports multi-line text (separated by \n) - each line is drawn on a separate arc
 * flipX: reverses the text order (reads backwards)
 * flipY: flips each letter upside down
 */
function drawTextOnArc(ctx, text, centerX, centerY, radius, startAngle, fontSize, color, letterSpacing = 0.08, flipX = false, flipY = false) {
  // Split text into lines
  const lines = text.split('\n');
  const lineHeight = fontSize * 1.4; // Line height as ratio of font size
  const totalHeight = (lines.length - 1) * lineHeight;

  // Draw each line at a different radius
  lines.forEach((line, index) => {
    // Offset radius for each line - outer lines first when flipY is true
    const radiusOffset = flipY
      ? (index - (lines.length - 1) / 2) * lineHeight
      : ((lines.length - 1) / 2 - index) * lineHeight;
    const lineRadius = radius + radiusOffset;

    drawSingleLineOnArc(ctx, line, centerX, centerY, lineRadius, startAngle, fontSize, color, letterSpacing, flipX, flipY);
  });
}

/**
 * Draw text in cell mode - each character fits in one cell
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text - The text to draw
 * @param {number} centerX - Center X of the polar grid
 * @param {number} centerY - Center Y of the polar grid
 * @param {number} circleStep - Radius step between circles
 * @param {number} row - Circle number (1 = innermost)
 * @param {number} startSector - Starting sector index
 * @param {number} numSectors - Total number of radial sectors
 * @param {number} fontSizePercent - Font size as percentage of cell size
 * @param {string} color - Text color
 * @param {boolean} flipX - Reverse text direction
 * @param {boolean} flipY - Flip characters upside down
 */
function drawTextInCells(ctx, text, centerX, centerY, circleStep, row, startSector, numSectors, fontSizePercent, color, flipX, flipY) {
  const chars = text.split('');
  const numChars = chars.length;

  // Calculate cell dimensions
  const innerRadius = circleStep * row;
  const outerRadius = circleStep * (row + 1);
  const cellHeight = outerRadius - innerRadius;
  // Use vertical offset setting for positioning (0 = inner, 0.5 = center, 1 = outer)
  const verticalOffset = polarGridSettings.textVerticalOffset || 0.5;
  const midRadius = innerRadius + cellHeight * verticalOffset;

  // Angle per sector (in radians)
  const sectorAngle = (2 * Math.PI) / numSectors;

  // Font size based on cell size, with global multiplier
  const globalMultiplier = (polarGridSettings.globalFontSize || 100) / 100;
  const fontSize = (cellHeight * fontSizePercent / 100) * globalMultiplier * 0.8;

  ctx.font = `${fontSize}px OffBit, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Determine direction
  const direction = flipX ? -1 : 1;

  for (let i = 0; i < numChars; i++) {
    const char = chars[i];
    if (char === ' ') continue; // Skip spaces (they still take a cell)

    // Calculate which sector this character is in
    const sectorIndex = (startSector + i * direction + numSectors) % numSectors;

    // Calculate angle for the center of this sector
    const angle = sectorIndex * sectorAngle - Math.PI / 2 + sectorAngle / 2;

    // Position at center of cell
    const x = centerX + Math.cos(angle) * midRadius;
    const y = centerY + Math.sin(angle) * midRadius;

    ctx.save();
    ctx.translate(x, y);

    // Rotate to follow the arc
    let rotation = angle + Math.PI / 2;
    if (flipY) {
      rotation += Math.PI;
    }
    ctx.rotate(rotation);


    // Apply text shadow
    if (polarGridSettings.textShadow) {
      ctx.shadowColor = polarGridSettings.textShadowColor;
      ctx.shadowBlur = polarGridSettings.textShadowBlur;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
    }

    // Draw outline first (behind fill)
    if (polarGridSettings.textOutline) {
      ctx.strokeStyle = polarGridSettings.textOutlineColor;
      ctx.lineWidth = polarGridSettings.textOutlineWidth;
      ctx.strokeText(char, 0, 0);
    }

    // Draw fill
    ctx.fillStyle = color;
    ctx.shadowBlur = 0; // Remove shadow for fill to avoid double shadow
    ctx.fillText(char, 0, 0);

    ctx.restore();
  }
}

/**
 * Interpolate between two colors
 */
function lerpColor(color1, color2, t) {
  return {
    r: color1.r + (color2.r - color1.r) * t,
    g: color1.g + (color2.g - color1.g) * t,
    b: color1.b + (color2.b - color1.b) * t,
  };
}

// ============ RYOJI IKEDA STYLE CELL PATTERNS ============

/**
 * Draw horizontal lines pattern in a polar cell
 */
function drawHorizontalLines(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, numLines = 8) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;
  const cellHeight = outerRadius - innerRadius;
  const lineSpacing = cellHeight / numLines;

  for (let i = 0; i < numLines; i++) {
    const r = innerRadius + lineSpacing * i + lineSpacing / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, startAngle, endAngle);
    ctx.stroke();
  }
}

/**
 * Draw radial lines pattern in a polar cell
 */
function drawRadialLines(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, numLines = 12) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  const angleStep = (endAngle - startAngle) / numLines;

  for (let i = 0; i <= numLines; i++) {
    const angle = startAngle + angleStep * i;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * innerRadius, centerY + Math.sin(angle) * innerRadius);
    ctx.lineTo(centerX + Math.cos(angle) * outerRadius, centerY + Math.sin(angle) * outerRadius);
    ctx.stroke();
  }
}

/**
 * Draw concentric circles pattern in a polar cell
 */
function drawConcentricCircles(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, numCircles = 5) {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;
  const cellSize = Math.min(outerRadius - innerRadius, (endAngle - startAngle) * midRadius) / 2;

  // Find center of cell
  const cellCenterX = centerX + Math.cos(midAngle) * midRadius;
  const cellCenterY = centerY + Math.sin(midAngle) * midRadius;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  for (let i = 1; i <= numCircles; i++) {
    const r = (cellSize / numCircles) * i;
    ctx.beginPath();
    ctx.arc(cellCenterX, cellCenterY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Draw dot grid pattern in a polar cell
 */
function drawDotGrid(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, gridSize = 4) {
  ctx.fillStyle = color;

  const midAngle = (startAngle + endAngle) / 2;
  const angleRange = endAngle - startAngle;
  const radiusRange = outerRadius - innerRadius;

  const dotRadius = Math.min(radiusRange, angleRange * innerRadius) / (gridSize * 4);

  for (let r = 0; r < gridSize; r++) {
    for (let a = 0; a < gridSize; a++) {
      const radius = innerRadius + (radiusRange / gridSize) * (r + 0.5);
      const angle = startAngle + (angleRange / gridSize) * (a + 0.5);

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draw sunburst/radial burst pattern
 */
function drawSunburst(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, numRays = 24) {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;
  const cellSize = Math.min(outerRadius - innerRadius, (endAngle - startAngle) * midRadius) / 2;

  const cellCenterX = centerX + Math.cos(midAngle) * midRadius;
  const cellCenterY = centerY + Math.sin(midAngle) * midRadius;

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  for (let i = 0; i < numRays; i++) {
    const angle = (Math.PI * 2 / numRays) * i;
    ctx.beginPath();
    ctx.moveTo(cellCenterX + Math.cos(angle) * (cellSize * 0.2), cellCenterY + Math.sin(angle) * (cellSize * 0.2));
    ctx.lineTo(cellCenterX + Math.cos(angle) * cellSize, cellCenterY + Math.sin(angle) * cellSize);
    ctx.stroke();
  }
}

/**
 * Draw gradient fill in a polar cell
 */
function drawCellGradient(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color1, color2, direction = 'radial') {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;

  let gradient;
  if (direction === 'radial') {
    gradient = ctx.createRadialGradient(
      centerX, centerY, innerRadius,
      centerX, centerY, outerRadius
    );
  } else {
    const x1 = centerX + Math.cos(startAngle) * midRadius;
    const y1 = centerY + Math.sin(startAngle) * midRadius;
    const x2 = centerX + Math.cos(endAngle) * midRadius;
    const y2 = centerY + Math.sin(endAngle) * midRadius;
    gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  }

  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a cell pattern with optional animation phase
 */
function drawCellPattern(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, pattern, ring, sector, animPhase = 0) {
  // Apply animation phase to modify the pattern
  const animOffset = Math.sin(animPhase) * 0.5 + 0.5; // 0 to 1

  switch (pattern) {
    case 'horizontal':
      drawHorizontalLines(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, 6 + ring);
      break;
    case 'radial':
      drawRadialLines(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, 8 + sector % 4);
      break;
    case 'concentric':
      drawConcentricCircles(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, 4 + ring % 3);
      break;
    case 'dots':
      drawDotGrid(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, 3 + ring % 2);
      break;
    case 'sunburst':
      drawSunburst(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, 16 + ring * 2);
      break;
    case 'diagonal':
      drawDiagonalLines(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, 5, sector % 2 ? 1 : -1);
      break;
    case 'gradient':
      // Animated gradient - pulse opacity
      const opacity = 0.3 + animOffset * 0.5;
      drawAnimatedCellGradient(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, opacity, animPhase);
      break;
    case 'square':
      drawColoredSquare(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, true);
      break;
    case 'squareOutline':
      drawColoredSquare(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, false);
      break;
    case 'grayscale':
      drawGrayscaleBlock(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, sector % 2 ? 'horizontal' : 'vertical');
      break;
    case 'rainbow':
      drawColorRamp(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle);
      break;
    case 'checker':
      drawCheckerboard(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color);
      break;
  }
}

/**
 * Draw a colored square in a cell
 */
function drawColoredSquare(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, filled = true) {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;
  const cellSize = Math.min(outerRadius - innerRadius, (endAngle - startAngle) * midRadius) * 0.7;

  const cellCenterX = centerX + Math.cos(midAngle) * midRadius;
  const cellCenterY = centerY + Math.sin(midAngle) * midRadius;

  ctx.save();
  ctx.translate(cellCenterX, cellCenterY);
  ctx.rotate(midAngle + Math.PI / 2);

  if (filled) {
    ctx.fillStyle = color;
    ctx.fillRect(-cellSize / 2, -cellSize / 2, cellSize, cellSize);
    // Inner darker square
    ctx.fillStyle = "#000000";
    ctx.fillRect(-cellSize / 4, -cellSize / 4, cellSize / 2, cellSize / 2);
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-cellSize / 2, -cellSize / 2, cellSize, cellSize);
  }

  ctx.restore();
}

/**
 * Draw grayscale gradient block in a polar cell (properly warped)
 */
function drawGrayscaleBlock(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, direction = 'radial') {
  ctx.save();

  // Clip to the polar cell shape
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.clip();

  // Create gradient that follows the cell shape
  let gradient;
  if (direction === 'radial') {
    // Radial gradient from inner to outer
    gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  } else {
    // Angular gradient approximation using multiple stops
    const midAngle = (startAngle + endAngle) / 2;
    const midRadius = (innerRadius + outerRadius) / 2;
    const x1 = centerX + Math.cos(startAngle) * midRadius;
    const y1 = centerY + Math.sin(startAngle) * midRadius;
    const x2 = centerX + Math.cos(endAngle) * midRadius;
    const y2 = centerY + Math.sin(endAngle) * midRadius;
    gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  }

  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.5, '#888888');
  gradient.addColorStop(1, '#000000');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.restore();
}

/**
 * Draw color ramp/rainbow in a polar cell (properly warped)
 */
function drawColorRamp(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle) {
  ctx.save();

  // Clip to the polar cell shape
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.clip();

  // Create angular gradient by drawing multiple segments
  const numSegments = 7;
  const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'];
  const angleStep = (endAngle - startAngle) / numSegments;

  for (let i = 0; i < numSegments; i++) {
    const segStart = startAngle + i * angleStep;
    const segEnd = segStart + angleStep;

    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, outerRadius * 1.1, segStart, segEnd);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw an image in a polar cell (properly clipped, thresholded, flipped outward)
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img - The loaded image
 * @param {number} centerX - Center X of the polar grid
 * @param {number} centerY - Center Y of the polar grid
 * @param {number} innerRadius - Inner radius of the cell
 * @param {number} outerRadius - Outer radius of the cell
 * @param {number} startAngle - Start angle in radians
 * @param {number} endAngle - End angle in radians
 * @param {boolean} applyThreshold - Whether to apply threshold effect
 * @param {number} thresholdLevel - Threshold level (0-1)
 */
function drawImageInCell(ctx, img, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, applyThreshold = true, thresholdLevel = 0.5) {
  if (!img || !img.complete) return;

  ctx.save();

  // Clip to the polar cell shape
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.clip();

  // Calculate the bounding box of the cell for image placement
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;

  // Calculate cell dimensions
  const cellHeight = outerRadius - innerRadius;
  const cellWidth = (endAngle - startAngle) * midRadius;

  // Calculate cell center position
  const cellCenterX = centerX + Math.cos(midAngle) * midRadius;
  const cellCenterY = centerY + Math.sin(midAngle) * midRadius;

  // Calculate image dimensions to cover the cell
  const imgAspect = img.width / img.height;
  const cellAspect = cellWidth / cellHeight;

  let drawWidth, drawHeight;
  if (imgAspect > cellAspect) {
    // Image is wider - fit to height
    drawHeight = cellHeight * 1.4;
    drawWidth = drawHeight * imgAspect;
  } else {
    // Image is taller - fit to width
    drawWidth = cellWidth * 1.4;
    drawHeight = drawWidth / imgAspect;
  }

  // Draw image centered on the cell, rotated to follow the arc
  // Flip upside down (add PI) to face outward from dome center
  ctx.translate(cellCenterX, cellCenterY);
  ctx.rotate(midAngle - Math.PI / 2); // Flipped to face outward
  ctx.scale(1, -1); // Flip vertically

  if (applyThreshold) {
    // Draw to a temporary canvas for threshold processing
    const tempCanvas = document.createElement('canvas');
    const tempSize = Math.max(drawWidth, drawHeight) * 1.5;
    tempCanvas.width = tempSize;
    tempCanvas.height = tempSize;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw image to temp canvas
    tempCtx.drawImage(img, 0, 0, tempSize, tempSize);

    // Apply threshold effect
    const imageData = tempCtx.getImageData(0, 0, tempSize, tempSize);
    const data = imageData.data;
    const threshold = thresholdLevel * 255;

    for (let i = 0; i < data.length; i += 4) {
      // Convert to grayscale
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      // Apply threshold
      const val = gray > threshold ? 255 : 0;
      data[i] = val;     // R
      data[i + 1] = val; // G
      data[i + 2] = val; // B
      // Keep alpha
    }

    tempCtx.putImageData(imageData, 0, 0);

    // Draw thresholded image
    ctx.drawImage(tempCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  } else {
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  }

  ctx.restore();
}

// Store loaded images
const loadedImages = new Map();

/**
 * Load an image and cache it
 */
function loadImage(src) {
  if (loadedImages.has(src)) {
    return Promise.resolve(loadedImages.get(src));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only use crossOrigin for external URLs
    if (src.startsWith('http') && !src.includes(window.location.hostname)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      loadedImages.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}`);
      resolve(null); // Don't reject, just return null
    };
    img.src = src;
  });
}

// List of images to use in cells
const cellImagePaths = [
  "assets/img/jpg/wisdome-stockholm-visuals.jpg",
  "assets/img/jpg/wisdome-malmo-visuals.jpg",
  "assets/img/jpg/untold-garden.jpg",
  "assets/img/jpg/tiny-massive.jpg",
  "assets/img/jpg/akiko-nakayama.jpg",
  "assets/img/jpg/nordic-lights.jpg",
  "assets/img/jpg/the-new-infinity.jpg",
  "assets/img/jpg/baltic-analog-lab.jpg",
  "assets/img/jpg/visualia.jpg",
  "assets/img/jpeg/nam-june-paik-magnet-tv.jpeg",
  "assets/img/jpg/rhythm-in-light-mary-ellen-bute.jpg",
  "assets/img/png/movie-drome.png",
];

/**
 * Preload all cell images
 */
export async function preloadCellImages() {
  const promises = cellImagePaths.map(path => loadImage(path).catch(() => null));
  await Promise.all(promises);
}

/**
 * Draw checkerboard pattern in a cell
 */
function drawCheckerboard(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color) {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;
  const cellSize = Math.min(outerRadius - innerRadius, (endAngle - startAngle) * midRadius) * 0.8;

  const cellCenterX = centerX + Math.cos(midAngle) * midRadius;
  const cellCenterY = centerY + Math.sin(midAngle) * midRadius;

  ctx.save();
  ctx.translate(cellCenterX, cellCenterY);
  ctx.rotate(midAngle + Math.PI / 2);

  const squareSize = cellSize / 4;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? color : '#000000';
      ctx.fillRect(
        -cellSize / 2 + col * squareSize,
        -cellSize / 2 + row * squareSize,
        squareSize,
        squareSize
      );
    }
  }

  ctx.restore();
}

/**
 * Draw animated gradient in a cell
 */
function drawAnimatedCellGradient(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, opacity, animPhase) {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;

  // Animate gradient direction
  const gradientOffset = Math.sin(animPhase) * 0.3;

  const gradient = ctx.createRadialGradient(
    centerX + Math.cos(midAngle) * midRadius * gradientOffset,
    centerY + Math.sin(midAngle) * midRadius * gradientOffset,
    0,
    centerX,
    centerY,
    outerRadius
  );

  // Parse hex color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw diagonal lines pattern
 */
function drawDiagonalLines(ctx, centerX, centerY, innerRadius, outerRadius, startAngle, endAngle, color, numLines = 6, direction = 1) {
  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerRadius + outerRadius) / 2;
  const cellWidth = (endAngle - startAngle) * midRadius;
  const cellHeight = outerRadius - innerRadius;

  ctx.save();

  // Clip to cell
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
  ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
  ctx.closePath();
  ctx.clip();

  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  const cellCenterX = centerX + Math.cos(midAngle) * midRadius;
  const cellCenterY = centerY + Math.sin(midAngle) * midRadius;
  const size = Math.max(cellWidth, cellHeight) * 1.5;
  const spacing = size / numLines;

  for (let i = -numLines; i <= numLines; i++) {
    ctx.beginPath();
    ctx.moveTo(cellCenterX - size / 2 + i * spacing, cellCenterY - size / 2);
    ctx.lineTo(cellCenterX - size / 2 + i * spacing + size * direction, cellCenterY + size / 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Generate a polar coordinate grid texture with mesh colors
 * @param {number} size - Canvas size in pixels (square)
 * @param {Object} options - Configuration options
 * @returns {THREE.CanvasTexture} The generated texture
 */
export function generatePolarGridTexture(size = 1024, options = {}) {
  const {
    backgroundColor = "#000000",
    lineWidth = polarGridSettings.lineWidth || 2,
    tickWidth = polarGridSettings.tickWidth || 1,
    numCircles = 8,
    numRadialLines = 36,
    showLabels = true,
    labelColor = "#ffffff",
    fontSize = size / 40,
    // Mesh colors (RGB 0-1 format)
    mainColor = { r: 0.4, g: 0.45, b: 0.5 },
    chairsColor = { r: 0.55, g: 0.32, b: 0.38 },
    floorColor = { r: 0.65, g: 0.52, b: 0.25 },
    // Curved text options
    curvedTexts = [],
  } = options;

  // Store colors in settings for GUI display
  polarGridSettings.mainColor = mainColor;
  polarGridSettings.chairsColor = chairsColor;
  polarGridSettings.floorColor = floorColor;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  // Get context with antialiasing option
  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });

  // Enable high-quality rendering
  if (polarGridSettings.antialias) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  } else {
    ctx.imageSmoothingEnabled = false;
  }

  // Set line rendering quality
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size / 2 - fontSize * 2;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  // Create color stops for gradient around the circle
  // Main -> Chairs -> Floor -> Main
  const getColorAtAngle = (angle) => {
    const normalizedAngle = ((angle % 360) + 360) % 360;

    if (normalizedAngle < 120) {
      return lerpColor(mainColor, chairsColor, normalizedAngle / 120);
    } else if (normalizedAngle < 240) {
      return lerpColor(chairsColor, floorColor, (normalizedAngle - 120) / 120);
    } else {
      return lerpColor(floorColor, mainColor, (normalizedAngle - 240) / 120);
    }
  };

  // Pre-calculate circle step for patterns
  const circleStep = maxRadius / numCircles;
  const angleStepRad = (2 * Math.PI) / numRadialLines;

  // Use seeded random based on colors for consistent patterns
  const seed = Math.floor((mainColor.r + chairsColor.g + floorColor.b) * 1000);
  const seededRandom = (i, j) => {
    const x = Math.sin(seed + i * 127 + j * 311) * 10000;
    return x - Math.floor(x);
  };

  // Store cell data (patterns removed, only used for image placement seeding)
  const cellPatterns = [];

  // ============ IMAGE CELLS ============
  // Draw images in cells (some spanning multiple cells)
  const imageCells = [];
  if (polarGridSettings.imageCellsEnabled) {
    const imageCount = Math.min(polarGridSettings.imageCellCount || 12, cellImagePaths.length);
    const usedCells = new Set(); // Track which cells are already used
    const applyThreshold = polarGridSettings.imageThreshold;
    const thresholdLevel = polarGridSettings.imageThresholdLevel || 0.5;

    // Images can go anywhere - typography will have black background to cover them

    // Shuffle images for random order each reload
    const shuffledImages = [...cellImagePaths].sort(() => Math.random() - 0.5);

    for (let imgIdx = 0; imgIdx < Math.min(polarGridSettings.imageCellCount || 12, shuffledImages.length); imgIdx++) {
      const img = loadedImages.get(shuffledImages[imgIdx]);
      if (!img) continue;

      // Determine cell size - favor larger sizes (random each reload)
      const sizeRand = Math.random();
      let ringSpan = 1;
      let sectorSpan = 1;

      if (sizeRand > 0.7) {
        // Large: 3x4 or 3x5
        ringSpan = 3;
        sectorSpan = 4 + Math.floor(Math.random() * 2);
      } else if (sizeRand > 0.4) {
        // Medium-large: 2x3 or 3x3
        ringSpan = 2 + Math.floor(Math.random() * 2);
        sectorSpan = 3 + Math.floor(Math.random() * 2);
      } else {
        // Medium: 2x2 or 2x3
        ringSpan = 2;
        sectorSpan = 2 + Math.floor(Math.random() * 2);
      }

      // Find a valid position for this image - fully random placement
      let attempts = 0;
      let placed = false;

      while (attempts < 100 && !placed) {
        // Random ring and sector (avoiding text rows is handled by usedCells)
        const ring = 1 + Math.floor(Math.random() * Math.max(1, numCircles - ringSpan));
        const sector = Math.floor(Math.random() * numRadialLines);

        // Ensure ring doesn't go out of bounds
        if (ring + ringSpan > numCircles) {
          attempts++;
          continue;
        }

        // Check if all needed cells are available
        let cellsAvailable = true;
        for (let r = 0; r < ringSpan && cellsAvailable; r++) {
          for (let s = 0; s < sectorSpan && cellsAvailable; s++) {
            const cellKey = `${ring + r}-${(sector + s) % numRadialLines}`;
            if (usedCells.has(cellKey)) {
              cellsAvailable = false;
            }
          }
        }

        if (cellsAvailable) {
          // Mark cells as used
          for (let r = 0; r < ringSpan; r++) {
            for (let s = 0; s < sectorSpan; s++) {
              const cellKey = `${ring + r}-${(sector + s) % numRadialLines}`;
              usedCells.add(cellKey);
            }
          }

          // Calculate merged cell boundaries
          const innerRadius = circleStep * ring;
          const outerRadius = circleStep * (ring + ringSpan);
          const startAngle = sector * angleStepRad - Math.PI / 2;
          const actualEndAngle = startAngle + sectorSpan * angleStepRad;

          // Draw the image with threshold effect
          drawImageInCell(ctx, img, centerX, centerY, innerRadius, outerRadius, startAngle, actualEndAngle, applyThreshold, thresholdLevel);

          imageCells.push({
            imgIdx,
            ring,
            sector,
            ringSpan,
            sectorSpan,
            innerRadius,
            outerRadius,
            startAngle,
            endAngle: actualEndAngle,
          });

          placed = true;
        }

        attempts++;
      }
    }
  }

  // Draw concentric circles (grid lines) - use single color
  const gridColor = polarGridSettings.gridLineColor || "#ffffff";

  for (let i = 1; i <= numCircles; i++) {
    const radius = circleStep * i;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw radial lines - from center to outer edge
  const angleStep = 360 / numRadialLines;
  const centerRadius = lineWidth * 3; // Start just outside center point

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = lineWidth;

  for (let i = 0; i < numRadialLines; i++) {
    const angle = i * angleStep;
    const radians = (angle - 90) * Math.PI / 180;

    const x1 = centerX + Math.cos(radians) * centerRadius;
    const y1 = centerY + Math.sin(radians) * centerRadius;
    const x2 = centerX + Math.cos(radians) * maxRadius;
    const y2 = centerY + Math.sin(radians) * maxRadius;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Apply rim offset from settings
  const rimOffset = polarGridSettings.rimOffset || 0;

  // ============ DETAILED OUTER RIM TICKS ============
  // Draw tick marks at every degree with varying sizes
  const outerRimRadius = maxRadius * (1 - rimOffset);
  const baseTickWidth = tickWidth; // Use the tickWidth from settings

  for (let angle = 0; angle < 360; angle += 1) {
    const radians = (angle - 90) * Math.PI / 180;

    let tickLength;
    let currentTickWidth;

    if (angle % 10 === 0) {
      // Major tick every 10 degrees
      tickLength = fontSize * 0.5;
      currentTickWidth = baseTickWidth * 1.5;
    } else if (angle % 5 === 0) {
      // Medium tick every 5 degrees
      tickLength = fontSize * 0.3;
      currentTickWidth = baseTickWidth;
    } else {
      // Small tick every degree
      tickLength = fontSize * 0.15;
      currentTickWidth = baseTickWidth * 0.5;
    }

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = currentTickWidth;

    ctx.beginPath();
    ctx.moveTo(
      centerX + Math.cos(radians) * outerRimRadius,
      centerY + Math.sin(radians) * outerRimRadius
    );
    ctx.lineTo(
      centerX + Math.cos(radians) * (outerRimRadius + tickLength),
      centerY + Math.sin(radians) * (outerRimRadius + tickLength)
    );
    ctx.stroke();
  }

  // Draw degree labels
  if (showLabels) {
    const labelsFlipX = polarGridSettings.labelsFlipX;
    const labelsFlipY = polarGridSettings.labelsFlipY;

    ctx.font = `${fontSize}px OffBit, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let angle = 0; angle < 360; angle += 10) {
      const radians = (angle - 90) * Math.PI / 180;

      // Degree label - offset toward center, readable from inside dome
      const labelRadius = outerRimRadius + fontSize * 1.0;
      const labelX = centerX + Math.cos(radians) * labelRadius;
      const labelY = centerY + Math.sin(radians) * labelRadius;

      ctx.fillStyle = labelColor;
      ctx.font = `${fontSize * 0.6}px OffBit, monospace`;
      ctx.save();
      ctx.translate(labelX, labelY);

      // Rotate to follow the arc
      let rotation = radians + Math.PI / 2;
      if (labelsFlipY) {
        rotation += Math.PI;
      }
      ctx.rotate(rotation);

      // Apply X flip if needed
      if (labelsFlipX) {
        ctx.scale(-1, 1);
      }

      ctx.fillText(angle.toString(), 0, 0);
      ctx.restore();
    }

    // Draw radial numbers along cardinal directions (0, 90, 180, 270 degrees)
    // Numbers go from outer rim toward center: 10, 20, 30, 40, 50, 60, 70, 80
    // Positioned centered on the radial line, just inside from the rim degree numbers
    const cardinalAngles = [0, 90, 180, 270];

    for (const angle of cardinalAngles) {
      const radians = (angle - 90) * Math.PI / 180;

      // Draw numbers from outer rim toward center (skip innermost ring = 90)
      for (let i = 1; i < numCircles; i++) {
        // Position exactly on the circle line junctions
        const ringFromOuter = i;
        const radius = circleStep * (numCircles - ringFromOuter); // Exactly on the circle line

        // Position exactly on the radial line (no offset)
        const labelX = centerX + Math.cos(radians) * radius;
        const labelY = centerY + Math.sin(radians) * radius;

        // Value: 10, 20, 30... 80 going from outer rim to center
        const distanceValue = i * 10;

        ctx.fillStyle = labelColor;
        ctx.font = `${fontSize * 0.35}px OffBit, monospace`;
        ctx.save();
        ctx.translate(labelX, labelY);

        // Rotate to align along the radial line (90 deg CW from perpendicular)
        let rotation = radians + Math.PI / 2; // Add 90 degrees CW
        if (labelsFlipY) {
          rotation += Math.PI;
        }
        ctx.rotate(rotation);

        if (labelsFlipX) {
          ctx.scale(-1, 1);
        }

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(distanceValue.toString(), 0, 0);
        ctx.restore();
      }
    }
    ctx.textAlign = "center"; // Reset
  }

  // Store base image without text (for animation with rotating text)
  const baseImageWithoutText = ctx.getImageData(0, 0, size, size);

  // Draw curved texts - use polarGridSettings for positions
  // (This draws the initial static text, animation will redraw with rotation)
  for (const textConfig of curvedTexts) {
    const {
      text = "",
      row = 7, // Circle number (1 = innermost, 8 = outermost)
      startSector = 0, // Starting sector for cell mode
      textFontSize = fontSize,
      color = labelColor,
      flipX = false,
      flipY = false,
      cellMode = true, // Use cell-based text by default
    } = textConfig;

    if (cellMode) {
      // Draw text with each character in a cell
      drawTextInCells(ctx, text, centerX, centerY, circleStep, row, startSector, numRadialLines, textFontSize, color, flipX, flipY);
    } else {
      // Legacy arc-based text
      const radius = maxRadius * (row / numCircles);
      const angleRad = (startSector * (360 / numRadialLines) - 90) * Math.PI / 180;
      const letterSpacing = textConfig.letterSpacing || 0.08;
      drawTextOnArc(ctx, text, centerX, centerY, radius, angleRad, textFontSize, color, letterSpacing, flipX, flipY);
    }
  }

  // Draw center point
  const dotSize = polarGridSettings.dotSize || 4;
  ctx.fillStyle = labelColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, dotSize, 0, Math.PI * 2);
  ctx.fill();

  // Create Three.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  // Store canvas data for animation
  texture._polarGridCanvas = canvas;
  texture._polarGridCtx = ctx;
  texture._polarGridParams = {
    centerX,
    centerY,
    maxRadius,
    circleStep,
    numCircles,
    numRadialLines,
    getColorAtAngle,
    cellPatterns,
    backgroundColor,
    baseImageWithoutText, // Grid without text for rotation animation
    curvedTexts, // Text configs for animated drawing
    labelColor,
    fontSize,
  };

  return texture;
}

// ============ PULSE ANIMATION SYSTEM ============

// Store pulse state
let pulses = [];
let pulseAnimationId = null;
let currentTexture = null;
let baseImageData = null;

// Track text rotation offset
let textRotationOffset = 0;
let lastStepTime = 0;

// Track scramble state for individual characters in each text line
const scrambleState = {
  text1: { chars: [] }, // Array of { active, startTime } for each character
  text2: { chars: [] },
  text3: { chars: [] },
  text4: { chars: [] },
  text5: { chars: [] },
};

// ASCII characters for scramble effect
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>[]{}|/\\~";

/**
 * Get scrambled version of a text with character-level scramble effect
 */
function getScrambledText(text, charStates, currentTime, scrambleDuration) {
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const state = charStates[i];

    if (!state || !state.active || char === ' ') {
      result += char;
    } else {
      const elapsed = currentTime - state.startTime;
      const progress = Math.min(elapsed / scrambleDuration, 1);

      if (progress >= 1) {
        // Scramble complete for this char
        state.active = false;
        result += char;
      } else {
        // Still scrambling - show random char
        result += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
    }
  }

  return result;
}

// Queue for pending scramble triggers (one character per audio ping)
let pendingScrambleCount = 0;

/**
 * Trigger a scramble for exactly 1 character (called from audio system on tick events)
 */
export function triggerScrambleBurst() {
  pendingScrambleCount++;
}

/**
 * Update scramble states and return current text states
 */
function updateScrambleStates(currentTime) {
  const result = {};
  const scrambleDuration = polarGridSettings.textScrambleDuration;

  // Process pending scrambles - one character per ping
  while (pendingScrambleCount > 0 && polarGridSettings.textScrambleEnabled) {
    pendingScrambleCount--;

    // Pick a random text line and character to scramble
    const textKeys = ['text1', 'text2', 'text3', 'text4', 'text5'];
    const randomKey = textKeys[Math.floor(Math.random() * textKeys.length)];
    const state = scrambleState[randomKey];
    const content = polarGridSettings[`${randomKey}Content`];

    // Initialize char states if needed
    if (state.chars.length !== content.length) {
      state.chars = content.split('').map(() => ({ active: false, startTime: 0 }));
    }

    // Find available characters (not spaces, not already scrambling)
    const availableIndices = [];
    for (let i = 0; i < content.length; i++) {
      if (content[i] !== ' ' && !state.chars[i].active) {
        availableIndices.push(i);
      }
    }

    // Scramble one random available character
    if (availableIndices.length > 0) {
      const randomIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      state.chars[randomIdx].active = true;
      state.chars[randomIdx].startTime = currentTime;
    }
  }

  // Build result text for each line
  ['text1', 'text2', 'text3', 'text4', 'text5'].forEach((key) => {
    const state = scrambleState[key];
    const content = polarGridSettings[`${key}Content`];

    // Initialize char states if needed
    if (state.chars.length !== content.length) {
      state.chars = content.split('').map(() => ({ active: false, startTime: 0 }));
    }

    result[key] = getScrambledText(content, state.chars, currentTime, scrambleDuration);
  });

  return result;
}

/**
 * Draw rotating text on the canvas with optional scramble effect
 */
function drawRotatingText(ctx, params, rotationOffset, scrambledTexts) {
  const { centerX, centerY, circleStep, numCircles, numRadialLines, curvedTexts, labelColor, fontSize } = params;

  if (!curvedTexts) return;

  curvedTexts.forEach((textConfig, index) => {
    const {
      row = 7,
      startSector = 0,
      textFontSize = fontSize,
      color = labelColor,
      flipX = false,
      flipY = false,
      cellMode = true,
    } = textConfig;

    // Get scrambled text if available
    const textKey = `text${index + 1}`;
    const text = scrambledTexts && scrambledTexts[textKey] ? scrambledTexts[textKey] : textConfig.text || "";

    // Apply rotation offset to start sector
    const rotatedStartSector = (startSector + rotationOffset + numRadialLines) % numRadialLines;

    if (cellMode) {
      drawTextInCells(ctx, text, centerX, centerY, circleStep, row, rotatedStartSector, numRadialLines, textFontSize, color, flipX, flipY);
    } else {
      const radius = params.maxRadius * (row / numCircles);
      const angleRad = (rotatedStartSector * (360 / numRadialLines) - 90) * Math.PI / 180;
      const letterSpacing = textConfig.letterSpacing || 0.08;
      drawTextOnArc(ctx, text, centerX, centerY, radius, angleRad, textFontSize, color, letterSpacing, flipX, flipY);
    }
  });
}

/**
 * Initialize pulses with random positions on circles
 */
function initializePulses(numPulses, numCircles) {
  pulses = [];
  for (let i = 0; i < numPulses; i++) {
    pulses.push({
      circle: Math.floor(Math.random() * numCircles) + 1, // Which circle (1 to numCircles)
      angle: Math.random() * Math.PI * 2, // Current angle in radians
      speed: (0.5 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1), // Speed multiplier with random direction
      size: 0.8 + Math.random() * 0.4, // Size multiplier
    });
  }
  // Tell audio system how many pulses there are
  setTotalPulseCount(numPulses);

  // Create audio synths for each pulse
  createPulseSynths(numPulses);
}

/**
 * Draw pulses on the canvas
 */
function drawPulses(ctx, params, pulseSize, pulseGlow) {
  const { centerX, centerY, circleStep } = params;
  // Disable glow on mobile for performance
  const useGlow = pulseGlow && !isMobile;

  // Get tick intensity and which pulse should react
  const tickIntensity = getTickIntensity();
  const activePulseIndex = getActivePulseIndex();

  pulses.forEach((pulse, index) => {
    const radius = circleStep * pulse.circle;
    const x = centerX + Math.cos(pulse.angle) * radius;
    const y = centerY + Math.sin(pulse.angle) * radius;
    const baseSize = pulseSize * pulse.size;

    // Only apply pulsation to the one active pulse
    const isActive = index === activePulseIndex;
    const pulseTickIntensity = isActive ? tickIntensity : 0;
    // Pulsation multiplier: 1.0 at rest, up to 2.5x when tick fires
    const pulsationMultiplier = 1.0 + pulseTickIntensity * 1.5;
    const size = baseSize * pulsationMultiplier;
    // Glow intensity also increases with ticks
    const glowIntensity = 0.9 + pulseTickIntensity * 0.1;

    // Draw glow effect - white, enhanced during ticks for the active pulse
    if (useGlow) {
      const glowSize = size * (3 + pulseTickIntensity * 2); // Glow grows more during ticks
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${glowIntensity})`);
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.4 + pulseTickIntensity * 0.3})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw solid pulse center - white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Draw bright center - pure white
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Decay tick intensity for smooth animation
  updateTickIntensity();
}

/**
 * Update pulse positions
 */
function updatePulses(deltaTime, speed) {
  for (const pulse of pulses) {
    pulse.angle += pulse.speed * speed * deltaTime * 0.001;
    // Keep angle in valid range
    if (pulse.angle > Math.PI * 2) pulse.angle -= Math.PI * 2;
    if (pulse.angle < 0) pulse.angle += Math.PI * 2;
  }
}

/**
 * Start pulse animation
 */
export function startPulseAnimation(texture) {
  if (!texture || !texture._polarGridCanvas) return;

  currentTexture = texture;
  const canvas = texture._polarGridCanvas;
  const ctx = texture._polarGridCtx;
  const params = texture._polarGridParams;

  // Store the base image (without pulses) for redrawing
  baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Initialize pulses
  initializePulses(polarGridSettings.pulseCount, params.numCircles);

  let lastTime = performance.now();
  let globalAnimTime = 0;

  function animate(currentTime) {
    // Throttle animation on mobile for better performance
    if (isMobile && currentTime - lastAnimFrame < MOBILE_FRAME_INTERVAL) {
      pulseAnimationId = requestAnimationFrame(animate);
      return;
    }
    lastAnimFrame = currentTime;

    const pulsesEnabled = polarGridSettings.pulsesEnabled;
    const cellAnimEnabled = polarGridSettings.cellAnimationEnabled;
    const textRotEnabled = polarGridSettings.textRotationEnabled;
    const textScrambleEnabled = polarGridSettings.textScrambleEnabled;

    // Keep animating if any animation feature is enabled
    if (!pulsesEnabled && !cellAnimEnabled && !textRotEnabled && !textScrambleEnabled) {
      // Restore base image and stop
      ctx.putImageData(baseImageData, 0, 0);
      texture.needsUpdate = true;
      pulseAnimationId = null;
      return;
    }

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    globalAnimTime += deltaTime * 0.001 * polarGridSettings.cellAnimationSpeed;

    // Update text rotation offset
    if (textRotEnabled) {
      if (polarGridSettings.textStepRotation) {
        // Step rotation - move by exactly one cell in sync with BPM
        const stepInterval = 60000 / polarGridSettings.textRotationBPM; // ms per beat
        if (currentTime - lastStepTime >= stepInterval) {
          // Step by one cell (negative for reverse direction)
          textRotationOffset -= 1;
          lastStepTime = currentTime;

          // Trigger scramble on step
          if (textScrambleEnabled) {
            pendingScrambleCount++;
          }
        }
      } else {
        // Continuous rotation
        textRotationOffset += polarGridSettings.textRotationSpeed * deltaTime * 0.001;
      }
      // Keep in valid range (0 to numRadialLines)
      while (textRotationOffset >= params.numRadialLines) {
        textRotationOffset -= params.numRadialLines;
      }
      while (textRotationOffset < 0) {
        textRotationOffset += params.numRadialLines;
      }
    }

    // Restore base image WITHOUT text if text needs redrawing (rotation or scramble)
    const needsTextRedraw = textRotEnabled || textScrambleEnabled;
    if (needsTextRedraw && params.baseImageWithoutText) {
      ctx.putImageData(params.baseImageWithoutText, 0, 0);
    } else {
      ctx.putImageData(baseImageData, 0, 0);
    }

    // Draw animated cell patterns
    if (cellAnimEnabled && params.cellPatterns) {
      for (const cell of params.cellPatterns) {
        const animPhase = globalAnimTime * 2 + cell.phase;
        // Only animate gradient patterns for now (most visible effect)
        if (cell.pattern === 'gradient') {
          drawCellPattern(
            ctx, params.centerX, params.centerY,
            cell.innerRadius, cell.outerRadius,
            cell.startAngle, cell.endAngle,
            cell.colorHex, cell.pattern,
            cell.ring, cell.sector, animPhase
          );
        }
      }
    }

    // Draw text with optional rotation and scramble effect
    if (needsTextRedraw && params.curvedTexts) {
      const scrambledTexts = textScrambleEnabled ? updateScrambleStates(currentTime) : null;
      drawRotatingText(ctx, params, textRotationOffset, scrambledTexts);
    }

    // Update and draw pulses
    if (pulsesEnabled) {
      updatePulses(deltaTime, polarGridSettings.pulseSpeed);
      drawPulses(ctx, params, polarGridSettings.pulseSize, polarGridSettings.pulseGlow);

      // Update audio based on pulse positions
      if (isAudioEnabled()) {
        updatePulseAudio(pulses, params);
      }
    }

    // Mark texture for update
    texture.needsUpdate = true;

    pulseAnimationId = requestAnimationFrame(animate);
  }

  // Start animation
  if (pulseAnimationId) {
    cancelAnimationFrame(pulseAnimationId);
  }
  pulseAnimationId = requestAnimationFrame(animate);
}

/**
 * Stop pulse animation
 */
export function stopPulseAnimation() {
  if (pulseAnimationId) {
    cancelAnimationFrame(pulseAnimationId);
    pulseAnimationId = null;
  }

  // Restore base image if we have it
  if (currentTexture && baseImageData) {
    const ctx = currentTexture._polarGridCtx;
    ctx.putImageData(baseImageData, 0, 0);
    currentTexture.needsUpdate = true;
  }
}

/**
 * Reinitialize pulses (call when pulse count changes)
 */
export function reinitializePulses() {
  if (currentTexture && currentTexture._polarGridParams) {
    initializePulses(polarGridSettings.pulseCount, currentTexture._polarGridParams.numCircles);
  }
}
