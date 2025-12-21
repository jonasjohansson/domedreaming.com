/**
 * Scroll Debug Utility
 * Provides visual debugging tools for the scroll transition system
 */

let debugEnabled = false;
let debugOverlay = null;
let debugPanel = null;
let logHistory = [];
const MAX_LOG_HISTORY = 100;

/**
 * Initialize scroll debug tools
 */
export function initScrollDebug() {
  // Check if debug is enabled via URL parameter or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  const savedDebug = localStorage.getItem("scrollDebugEnabled");
  
  if (debugParam === "scroll" || savedDebug === "true") {
    enableDebug();
  }

  // Add keyboard shortcut: Ctrl+Shift+D to toggle debug
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      toggleDebug();
    }
  });
}

/**
 * Enable debug mode
 */
export function enableDebug() {
  if (debugEnabled) return;
  debugEnabled = true;
  localStorage.setItem("scrollDebugEnabled", "true");
  createDebugOverlay();
  console.log("[Scroll Debug] Debug mode enabled. Press Ctrl+Shift+D to toggle.");
}

/**
 * Disable debug mode
 */
export function disableDebug() {
  if (!debugEnabled) return;
  debugEnabled = false;
  localStorage.setItem("scrollDebugEnabled", "false");
  if (debugOverlay) {
    debugOverlay.remove();
    debugOverlay = null;
    debugPanel = null;
  }
  console.log("[Scroll Debug] Debug mode disabled.");
}

/**
 * Toggle debug mode
 */
export function toggleDebug() {
  if (debugEnabled) {
    disableDebug();
  } else {
    enableDebug();
  }
}

/**
 * Create debug overlay UI
 */
function createDebugOverlay() {
  // Remove existing overlay if any
  if (debugOverlay) {
    debugOverlay.remove();
  }

  debugOverlay = document.createElement("div");
  debugOverlay.id = "scroll-debug-overlay";
  debugOverlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 350px;
    max-height: 80vh;
    background: rgba(0, 0, 0, 0.9);
    color: #0f0;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    padding: 15px;
    border: 2px solid #0f0;
    border-radius: 4px;
    z-index: 10000;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
  `;

  debugPanel = document.createElement("div");
  debugPanel.id = "scroll-debug-panel";
  debugOverlay.appendChild(debugPanel);

  // Add close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    background: transparent;
    border: 1px solid #0f0;
    color: #0f0;
    cursor: pointer;
    width: 24px;
    height: 24px;
    font-size: 18px;
    line-height: 1;
    padding: 0;
  `;
  closeBtn.onclick = disableDebug;
  debugOverlay.appendChild(closeBtn);

  // Add title
  const title = document.createElement("div");
  title.textContent = "SCROLL DEBUG";
  title.style.cssText = `
    font-weight: bold;
    margin-bottom: 10px;
    border-bottom: 1px solid #0f0;
    padding-bottom: 5px;
  `;
  debugPanel.appendChild(title);

  document.body.appendChild(debugOverlay);
}

/**
 * Update debug display with current scroll state
 */
export function updateDebugDisplay(state) {
  if (!debugEnabled) return;
  
  // Ensure debug panel exists
  if (!debugPanel) {
    const existing = document.getElementById("scroll-debug-panel");
    if (existing) {
      debugPanel = existing;
    } else {
      return; // Panel not created yet
    }
  }

  const {
    progress,
    accumulatedScroll,
    maxTransitionScroll,
    currentScrollY,
    inTransition,
    rowHeight,
    cameraTransitionRows,
    shouldHandle,
    isScrollingUp,
    isScrollingDown,
    isAtTop,
  } = state;

  debugPanel.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #0f0; padding-bottom: 5px;">
      SCROLL DEBUG
      <button onclick="window.scrollDebug?.disable()" style="float: right; background: transparent; border: 1px solid #0f0; color: #0f0; cursor: pointer; padding: 2px 8px;">×</button>
    </div>
    
    <div style="margin-bottom: 8px;">
      <strong>Progress:</strong> ${(progress * 100).toFixed(2)}%
      <div style="width: 100%; height: 20px; background: #333; border: 1px solid #0f0; margin-top: 4px; position: relative;">
        <div style="width: ${progress * 100}%; height: 100%; background: #0f0; transition: width 0.1s;"></div>
      </div>
    </div>

    <div style="margin-bottom: 8px;">
      <strong>State:</strong>
      <div style="margin-left: 10px; margin-top: 4px;">
        <div>In Transition: <span style="color: ${inTransition ? "#0f0" : "#f00"}">${inTransition ? "YES" : "NO"}</span></div>
        <div>At Top: <span style="color: ${isAtTop ? "#0f0" : "#f00"}">${isAtTop ? "YES" : "NO"}</span></div>
        <div>Scroll Y: ${currentScrollY.toFixed(2)}px</div>
        <div>Should Handle: <span style="color: ${shouldHandle ? "#0f0" : "#f00"}">${shouldHandle ? "YES" : "NO"}</span></div>
      </div>
    </div>

    <div style="margin-bottom: 8px;">
      <strong>Scroll Values:</strong>
      <div style="margin-left: 10px; margin-top: 4px; font-size: 11px;">
        <div>Accumulated: ${accumulatedScroll.toFixed(2)}px</div>
        <div>Max Transition: ${maxTransitionScroll.toFixed(2)}px</div>
        <div>Row Height: ${rowHeight.toFixed(2)}px</div>
        <div>Transition Rows: ${cameraTransitionRows}</div>
      </div>
    </div>

    <div style="margin-bottom: 8px;">
      <strong>Direction:</strong>
      <div style="margin-left: 10px; margin-top: 4px;">
        <div>Scrolling Up: <span style="color: ${isScrollingUp ? "#0f0" : "#666"}">${isScrollingUp ? "YES" : "NO"}</span></div>
        <div>Scrolling Down: <span style="color: ${isScrollingDown ? "#0f0" : "#666"}">${isScrollingDown ? "YES" : "NO"}</span></div>
      </div>
    </div>

    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #0f0;">
      <strong>Controls:</strong>
      <div style="margin-top: 8px;">
        <button onclick="window.scrollDebug?.setProgress(0)" style="background: #333; border: 1px solid #0f0; color: #0f0; padding: 4px 8px; margin: 2px; cursor: pointer;">Reset (0%)</button>
        <button onclick="window.scrollDebug?.setProgress(0.5)" style="background: #333; border: 1px solid #0f0; color: #0f0; padding: 4px 8px; margin: 2px; cursor: pointer;">50%</button>
        <button onclick="window.scrollDebug?.setProgress(1)" style="background: #333; border: 1px solid #0f0; color: #0f0; padding: 4px 8px; margin: 2px; cursor: pointer;">100%</button>
      </div>
      <div style="margin-top: 8px;">
        <input type="range" id="debug-progress-slider" min="0" max="1" step="0.01" value="${progress}" 
          style="width: 100%;" 
          oninput="window.scrollDebug?.setProgress(parseFloat(this.value))">
        <div style="text-align: center; margin-top: 4px; font-size: 10px;">Manual Control</div>
      </div>
    </div>

    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #0f0; font-size: 10px;">
      <strong>Shortcuts:</strong>
      <div style="margin-top: 4px;">
        Ctrl+Shift+D: Toggle debug<br>
        Add ?debug=scroll to URL to auto-enable
      </div>
    </div>
  `;
}

/**
 * Set scroll progress manually (for debugging)
 */
export function setProgress(progress) {
  if (typeof window.setScrollProgress === "function") {
    window.setScrollProgress(progress);
  } else {
    console.warn("[Scroll Debug] setScrollProgress function not available. Make sure it's exported from scroll-increment.js");
  }
}

/**
 * Enhanced logging with filtering
 */
export function debugLog(category, message, data = null) {
  if (!debugEnabled) return;

  const timestamp = new Date().toLocaleTimeString();
  const logEntry = {
    timestamp,
    category,
    message,
    data,
  };

  logHistory.push(logEntry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }

  // Color code by category
  const colors = {
    wheel: "#0ff",
    scroll: "#ff0",
    camera: "#f0f",
    transition: "#0f0",
    error: "#f00",
  };

  const color = colors[category] || "#fff";
  console.log(
    `%c[${timestamp}] [${category}] ${message}`,
    `color: ${color}`,
    data || ""
  );
}

/**
 * Get log history
 */
export function getLogHistory() {
  return [...logHistory];
}

/**
 * Clear log history
 */
export function clearLogHistory() {
  logHistory = [];
}

/**
 * Export debug functions to window for console access
 */
export function exposeDebugToWindow(setScrollProgressFn) {
  window.scrollDebug = {
    enable: enableDebug,
    disable: disableDebug,
    toggle: toggleDebug,
    setProgress: setScrollProgressFn,
    getLogHistory,
    clearLogHistory,
    isEnabled: () => debugEnabled,
  };
}

