/**
 * Dashboard functionality
 * Manages dashboard cells, parallax scrolling, and draggable cells
 */

// Dashboard cell configurations for first page (WebGL canvas) - fixed positions
const dashboardCells = [
  { col: 3, row: 3, size: "3x2", image: "assets/img/Links/WisdomeStockholm-topaz-upscale-1.9x.jpg", draggable: true, dismissable: true },
  { col: 9, row: 3, size: "3x2", image: "assets/img/Links/Wisdome-Malmo-topaz-upscale-3.5x.png", draggable: true, dismissable: true },
  { col: 2, row: 6, size: "2x3", image: "assets/img/Links/Movie-Drome-topaz-upscale-2.6x.jpeg", draggable: true, dismissable: true },
  { col: 6, row: 6, size: "4x2", image: "assets/img/Links/ArcticLights.png", draggable: true, dismissable: true },
  { col: 11, row: 7, size: "2x2", image: "assets/img/Links/TheNewInfinity.jpg", draggable: true, dismissable: true },
];

// Page 2 cell configurations - fixed positions (spread out more)
const page2Cells = [
  { col: 2, row: 2, size: "2x2", image: "assets/img/Links/Movie-Drome-topaz-upscale-2.6x.jpeg", draggable: true, dismissable: true },
  { col: 6, row: 2, size: "3x3", image: "assets/img/Links/WisdomeStockholm-topaz-upscale-1.9x.jpg", draggable: true, dismissable: true },
  {
    col: 11,
    row: 2,
    size: "2x1",
    image: "assets/img/Links/RhythmInLightMaryEllenBute-topaz-upscale-4x.jpeg",
    draggable: true,
    dismissable: true,
  },
  { col: 1, row: 5, size: "1x2", image: "assets/img/Links/DomeDreamingLogo.svg", draggable: true, dismissable: true },
  { col: 4, row: 5, size: "3x1", image: "assets/img/Links/LaSatMontreal-topaz-upscale-2.4x.jpg", draggable: true, dismissable: true },
  { col: 9, row: 5, size: "2x2", image: "assets/img/Links/NamJunePaikMagnetTV-topaz-upscale-4x.jpeg", draggable: true, dismissable: true },
  { col: 12, row: 5, size: "1x1", image: "assets/img/Links/TheNewInfinity.jpg", draggable: true, dismissable: true },
  { col: 2, row: 8, size: "2x1", image: "assets/img/Links/Visualia.jpg", draggable: true, dismissable: true },
  { col: 6, row: 8, size: "2x2", image: "assets/img/Links/Wisdome-Malmo-topaz-upscale-3.5x.png", draggable: true, dismissable: true },
  { col: 10, row: 8, size: "3x2", image: "assets/img/Links/ArcticLights.png", draggable: true, dismissable: true },
  { col: 1, row: 11, size: "1x1", image: "assets/img/Links/NonagonFestival.jpg", draggable: true, dismissable: true },
  { col: 4, row: 11, size: "2x1", image: "assets/img/Links/KokongFestival.jpg", draggable: true, dismissable: true },
];

// Page 3 cell configurations - positions adjusted to follow the big image and support text
const page3Cells = [
  { col: 4, row: 21, size: "3x2", image: "assets/img/Links/WisdomeStockholm-topaz-upscale-1.9x.jpg", draggable: true, dismissable: true },
  { col: 9, row: 23, size: "3x2", image: "assets/img/Links/Wisdome-Malmo-topaz-upscale-3.5x.png", draggable: true, dismissable: true },
];

/**
 * Create a dashboard cell
 */
function createDashboardCell(config, container, index = 0) {
  const cell = document.createElement("div");
  cell.className = `dashboard-cell size-${config.size}`;

  // Store index for reference
  cell.dataset.cellIndex = index;

  // Parse size to get column and row spans (e.g., "2x2" -> cols: 2, rows: 2)
  const [cols, rows] = config.size.split("x").map(Number);

  // Set grid position with span to ensure size classes work correctly
  cell.style.gridColumn = `${config.col} / span ${cols}`;
  cell.style.gridRow = `${config.row} / span ${rows}`;

  // Append cell to container
  container.appendChild(cell);

  if (config.draggable) {
    cell.classList.add("draggable");
    makeDraggable(cell);

    // All draggable cells are dismissable by default (unless explicitly set to false)
    if (config.dismissable !== false) {
      cell.addEventListener("click", (e) => {
        // Only dismiss if the cell hasn't been moved and mouse didn't move significantly (was a click, not drag)
        if (cell.dataset.hasMoved !== "true" && cell.dataset.mouseMoved !== "true") {
          cell.style.opacity = "0";
          cell.style.transition = "opacity 0.3s ease";
          setTimeout(() => {
            cell.remove();
          }, 300);
        }
      });
    }
  }

  if (config.image) {
    const img = document.createElement("img");
    // Use actual image path if provided, otherwise use placeholder
    img.src =
      typeof config.image === "string"
        ? config.image
        : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='%23333' width='300' height='300'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";
    img.alt = config.content || "Image";
    cell.appendChild(img);
  } else {
    const text = document.createElement("div");
    text.textContent = config.content || "";
    text.style.fontSize = "var(--font-size-small)";
    text.style.textAlign = "center";
    cell.appendChild(text);
  }

  return cell;
}

/**
 * Make a cell draggable with grid snapping
 */
function makeDraggable(cell) {
  let isDragging = false;
  let startX, startY, startCol, startRow;
  let hasMoved = false; // Track if cell has been moved
  let mouseMoved = false; // Track if mouse moved significantly (indicates drag)

  cell.addEventListener("mousedown", (e) => {
    isDragging = true;
    mouseMoved = false;
    cell.classList.add("dragging");

    const rect = cell.getBoundingClientRect();
    const container = cell.parentElement;
    const containerRect = container.getBoundingClientRect();

    startX = e.clientX;
    startY = e.clientY;

    // Parse gridColumn and gridRow to get start position and span
    const gridCol = cell.style.gridColumn;
    const gridRow = cell.style.gridRow;

    // Extract start position (before "/ span" or just the number)
    startCol = gridCol.includes("/") ? parseInt(gridCol.split("/")[0].trim()) : parseInt(gridCol);
    startRow = gridRow.includes("/") ? parseInt(gridRow.split("/")[0].trim()) : parseInt(gridRow);

    // Extract span values
    const colSpan = gridCol.includes("span") ? parseInt(gridCol.split("span")[1].trim()) : 1;
    const rowSpan = gridRow.includes("span") ? parseInt(gridRow.split("span")[1].trim()) : 1;

    // Store spans for later use
    cell.dataset.colSpan = colSpan;
    cell.dataset.rowSpan = rowSpan;

    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const container = cell.parentElement;
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

    const newCol = Math.max(1, Math.min(14 - (parseInt(cell.dataset.colSpan) || 1) + 1, startCol + colOffset));
    const newRow = Math.max(1, startRow + rowOffset);

    // Check if position actually changed
    if (newCol !== startCol || newRow !== startRow) {
      hasMoved = true;
      cell.dataset.hasMoved = "true";
    }

    // Preserve the span when updating position
    const colSpan = cell.dataset.colSpan || "1";
    const rowSpan = cell.dataset.rowSpan || "1";

    cell.style.gridColumn = `${newCol} / span ${colSpan}`;
    cell.style.gridRow = `${newRow} / span ${rowSpan}`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      cell.classList.remove("dragging");
      // Store mouse movement state for click handler
      cell.dataset.mouseMoved = mouseMoved ? "true" : "false";
      // Reset after a short delay to allow click handler to check
      setTimeout(() => {
        cell.dataset.mouseMoved = "false";
      }, 100);
    }
  });
}

/**
 * Create team grid
 */
function createTeamGrid() {
  const teamContainer = document.querySelector(".team-grid-container");
  if (!teamContainer) return;

  // Team member data with matched images
  const teamMembers = [
    { name: "Jonas Johansson", role: "Project Lead", image: "assets/img/Links/DomeDreamingLogo.svg" },
    { name: "Fredrik Edström", role: "Technical Co-lead", image: "assets/img/Links/FredrikEdström-topaz-lighting-upscale-2x.jpeg" },
    { name: "Sebastian Häger", role: "Curatorial Lead", image: "assets/img/Links/SebastianHäger-topaz-upscale-4x.jpeg" },
    { name: "Annie Tådne", role: "Advisor", image: "assets/img/Links/AnnieTådne-topaz-face-upscale-2.1x.jpeg" },
    { name: "Merle Karu", role: "Advisor", image: "assets/img/Links/MerleKarp-topaz-face-upscale-4x.jpeg" },
    { name: "Ieva Balode", role: "Advisor", image: "assets/img/Links/IevaBalode-topaz-upscale-3.5x.jpeg" },
    { name: "Axel Jonsson", role: "Advisor", image: "assets/img/Links/AxelJonsson-topaz-face-upscale-4x.jpeg" },
    { name: "Anna Lundh", role: "Advisor", image: "assets/img/Links/AnnaLundh.png" },
    { name: "Lina Selander", role: "Advisor", image: "assets/img/Links/LinaSelander-topaz-face-upscale-2.3x.jpeg" },
  ];

  teamMembers.forEach((member) => {
    const memberDiv = document.createElement("div");
    memberDiv.className = "team-member";

    if (member.image) {
      const img = document.createElement("img");
      // Use actual image path if provided, otherwise use placeholder
      img.src =
        typeof member.image === "string"
          ? member.image
          : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect fill='%23333' width='300' height='300'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E" +
            encodeURIComponent(member.name) +
            "%3C/text%3E%3C/svg%3E";
      img.alt = member.name;
      memberDiv.appendChild(img);
    }

    const h3 = document.createElement("h3");
    h3.textContent = member.name;
    memberDiv.appendChild(h3);

    const p = document.createElement("p");
    p.textContent = member.role;
    memberDiv.appendChild(p);

    teamContainer.appendChild(memberDiv);
  });
}

/**
 * Initialize dashboard
 */
export function initDashboard() {
  // Create cells for first viewport with fixed positions
  const dashboardOverlay = document.getElementById("dashboard-overlay");
  if (dashboardOverlay) {
    dashboardCells.forEach((config, index) => {
      createDashboardCell(config, dashboardOverlay, index);
    });
  }

  // Create cells for second page with fixed positions (combining page 2 and 3 cells)
  const page2CellsContainer = document.getElementById("page-2-cells");
  if (page2CellsContainer) {
    // Add page 2 cells
    page2Cells.forEach((config, index) => {
      createDashboardCell(config, page2CellsContainer, index);
    });
    // Add page 3 cells to the same container
    page3Cells.forEach((config, index) => {
      createDashboardCell(config, page2CellsContainer, page2Cells.length + index);
    });
  }
}
