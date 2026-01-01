const fs = require('fs');
const path = require('path');

/**
 * Inlines critical CSS into HTML and sets up async loading for full CSS
 * This runs after Eleventy builds the site
 */

const docsPath = path.join(__dirname, '../docs');
const htmlPath = path.join(docsPath, 'index.html');
const criticalCSSPath = path.join(docsPath, 'critical.css');

function inlineCriticalCSS() {
  try {
    // Read the HTML file
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Check if critical CSS file exists
    if (!fs.existsSync(criticalCSSPath)) {
      console.warn('⚠ Critical CSS file not found, skipping inline step');
      return;
    }
    
    // Read critical CSS
    const criticalCSS = fs.readFileSync(criticalCSSPath, 'utf8');
    
    // Find the stylesheet link
    const stylesheetRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']assets\/css\/main\.css["'][^>]*>/i;
    
    // Replace with: inline critical CSS + async load full CSS (no JavaScript needed)
    const replacement = `<style>${criticalCSS}</style>
<link
  rel="preload"
  href="assets/css/main.css"
  as="style"
  onload="this.onload=null;this.rel='stylesheet'" />
<noscript><link rel="stylesheet" href="assets/css/main.css" /></noscript>`;
    
    if (stylesheetRegex.test(html)) {
      html = html.replace(stylesheetRegex, replacement);
      
      // Write updated HTML
      fs.writeFileSync(htmlPath, html);
      
      console.log('✓ Critical CSS inlined and async loading configured');
    } else {
      console.warn('⚠ Stylesheet link not found in HTML');
    }
  } catch (error) {
    console.error('Error inlining critical CSS:', error);
  }
}

// Run if called directly
if (require.main === module) {
  inlineCriticalCSS();
}

module.exports = { inlineCriticalCSS };

