/**
 * Update service worker cache version on each build
 * This ensures the cache clears on every new push
 */

const fs = require("fs");
const path = require("path");

const swPath = path.join(__dirname, "..", "sw.js");
const docsSwPath = path.join(__dirname, "..", "docs", "sw.js");

function updateSwVersion(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return; // Skip if file doesn't exist (e.g., docs/sw.js before first build)
    }

    // Read the service worker file
    let swContent = fs.readFileSync(filePath, "utf8");

    // Replace BUILD_TIMESTAMP with actual timestamp
    const timestamp = Date.now();
    swContent = swContent.replace(/BUILD_TIMESTAMP/g, timestamp);

    // Write back to file
    fs.writeFileSync(filePath, swContent, "utf8");

    console.log(`[Service Worker] Updated cache version in ${path.basename(filePath)} to: ${timestamp}`);
  } catch (error) {
    console.error(`[Service Worker] Failed to update cache version in ${filePath}:`, error);
  }
}

// Only update docs/sw.js (the built output)
// The source sw.js keeps BUILD_TIMESTAMP as a placeholder
if (fs.existsSync(docsSwPath)) {
  updateSwVersion(docsSwPath);
} else {
  console.log("[Service Worker] docs/sw.js not found yet, will be updated after eleventy build");
}
