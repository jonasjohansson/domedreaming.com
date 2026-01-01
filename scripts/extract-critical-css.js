const fs = require('fs');
const path = require('path');

/**
 * Extracts critical CSS for above-the-fold content
 * Extracts: CSS variables, base styles, grid system, first section, loading overlay
 */

const docsPath = path.join(__dirname, '../docs');
const cssPath = path.join(docsPath, 'assets/css/main.css');
const outputPath = path.join(docsPath, 'critical.css');

function extractCriticalCSS() {
  try {
    // Read the full CSS file
    const fullCSS = fs.readFileSync(cssPath, 'utf8');
    
    // Extract critical parts using regex
    const criticalParts = [];
    
    // 1. CSS Variables (:root) - ALWAYS critical
    const rootMatch = fullCSS.match(/:root\s*\{[^}]*\}/s);
    if (rootMatch) criticalParts.push(rootMatch[0]);
    
    // 2. HTML/body base styles
    const htmlMatch = fullCSS.match(/html[^{]*\{[^}]*\}/s);
    if (htmlMatch) criticalParts.push(htmlMatch[0]);
    
    const bodyMatch = fullCSS.match(/body[^{]*\{[^}]*\}/s);
    if (bodyMatch) criticalParts.push(bodyMatch[0]);
    
    // 3. Grid system (needed for layout)
    const gridMatch = fullCSS.match(/\.grid[^{]*\{[^}]*\}/s);
    if (gridMatch) criticalParts.push(gridMatch[0]);
    
    // 4. Column classes (x-1 through x-16) - needed for first section
    const xClasses = fullCSS.match(/\.x-\d+[^{]*\{[^}]*\}/gs);
    if (xClasses) criticalParts.push(...xClasses.slice(0, 12)); // First 12 columns
    
    // 5. Loading overlay (shown first)
    const loadingMatch = fullCSS.match(/#loading-overlay[^{]*\{[^}]*\}/s);
    if (loadingMatch) criticalParts.push(loadingMatch[0]);
    
    // 6. Canvas container (first section)
    const canvasMatch = fullCSS.match(/#canvas-container[^{]*\{[^}]*\}/s);
    if (canvasMatch) criticalParts.push(canvasMatch[0]);
    
    // 7. Page section and content
    const sectionMatch = fullCSS.match(/\.page-section[^{]*\{[^}]*\}/s);
    if (sectionMatch) criticalParts.push(sectionMatch[0]);
    
    const contentMatch = fullCSS.match(/\.page-content[^{]*\{[^}]*\}/s);
    if (contentMatch) criticalParts.push(contentMatch[0]);
    
    // 8. Block styles
    const blockMatch = fullCSS.match(/\.block[^{]*\{[^}]*\}/s);
    if (blockMatch) criticalParts.push(blockMatch[0]);
    
    // 9. Typography basics
    const mainPMatch = fullCSS.match(/main\s+p[^{]*\{[^}]*\}/s);
    if (mainPMatch) criticalParts.push(mainPMatch[0]);
    
    const mainH1Match = fullCSS.match(/main\s+h1[^{]*\{[^}]*\}/s);
    if (mainH1Match) criticalParts.push(mainH1Match[0]);
    
    // 10. Font faces (critical for text rendering)
    const fontFaces = fullCSS.match(/@font-face\s*\{[^}]*\}/gs);
    if (fontFaces) criticalParts.push(...fontFaces);
    
    // Combine and clean up
    let criticalCSS = criticalParts.join('\n\n');
    
    // Remove duplicate rules (simple deduplication)
    const seen = new Set();
    const lines = criticalCSS.split('\n');
    const uniqueLines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('/*') || trimmed.startsWith('*')) return true;
      if (seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
    criticalCSS = uniqueLines.join('\n');
    
    // Write critical CSS file
    fs.writeFileSync(outputPath, criticalCSS);
    
    const originalSize = fs.statSync(cssPath).size;
    const criticalSize = criticalCSS.length;
    const savings = ((1 - criticalSize / originalSize) * 100).toFixed(1);
    
    console.log(`✓ Critical CSS extracted: ${(criticalSize / 1024).toFixed(1)}KB`);
    console.log(`  Full CSS: ${(originalSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
    
    return criticalCSS;
  } catch (error) {
    console.error('Error extracting critical CSS:', error);
    // Fallback: return empty string if extraction fails
    return '';
  }
}

// Run if called directly
if (require.main === module) {
  extractCriticalCSS();
}

module.exports = { extractCriticalCSS };
