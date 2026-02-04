const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');
const docsCssPath = path.join(docsPath, 'assets/css');

/**
 * Purge unused CSS using a simple regex-based approach
 * For production, consider using PurgeCSS library
 */
async function purgeCSS() {
  console.log('Purging unused CSS...\n');
  
  // Check if PurgeCSS is available
  let PurgeCSS;
  try {
    PurgeCSS = require('purgecss');
  } catch (e) {
    console.warn('⚠ PurgeCSS not installed. Using basic CSS analysis.');
    console.warn('   Install with: npm install -D purgecss');
    console.warn('   For now, CSS will be minified but not purged.\n');
    return;
  }
  
  if (!fs.existsSync(docsCssPath)) {
    console.warn(`⚠ CSS directory not found: ${docsCssPath}`);
    return;
  }
  
  // Find all HTML files
  const htmlFiles = [];
  function findHTMLFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        findHTMLFiles(fullPath);
      } else if (entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }
  
  findHTMLFiles(docsPath);
  
  if (htmlFiles.length === 0) {
    console.log('No HTML files found.');
    return;
  }
  
  // Find all CSS files (except main.css which uses @import, and base.css which has @font-face)
  const cssFiles = [];
  const entries = fs.readdirSync(docsCssPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.css') && entry.name !== 'main.css' && entry.name !== 'base.css') {
      cssFiles.push(path.join(docsCssPath, entry.name));
    }
  }
  
  if (cssFiles.length === 0) {
    console.log('No CSS files found to purge.');
    return;
  }
  
  const purgeCSS = new PurgeCSS.PurgeCSS();

  const purgeCSSResult = await purgeCSS.purge({
    content: htmlFiles,
    css: cssFiles,
    // Safelist for dynamic classes and essential selectors
    safelist: {
      standard: [
        // Essential element selectors
        'html',
        'body',
        ':root',
        '*',
        'img',
        'a',
        'p',
        'br',
        // Dynamic classes
        /^dot$/,
        /^block$/,
        /^page-section$/,
        /^page-content$/,
        /^canvas-container$/,
        /^wasd-/,
        /^keyboard-/,
        /^shape-/,
        /^x-\d+$/,
        /^y-\d+$/,
        /^w-\d+$/,
        /^h-\d+$/,
        /^bg-\d+$/,
        /^keep-visible$/,
        /^loaded$/,
        /^active$/,
        /^dome-mode$/,
        /^fade-out$/,
        /^responsive$/,
        /^large$/,
        /^small$/,
        /^dashboard-/,
        /^image-caption$/,
        /^key-underline$/,
        /^half$/,
        /^center$/
      ],
      deep: [/three/, /THREE/, /canvas/, /webgl/, /OffBit/, /font-face/],
      greedy: [/^\./, /^#/]
    },
    // Keep font-face and keyframes
    fontFace: true,
    keyframes: true,
    variables: true
  });
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  
  for (let i = 0; i < cssFiles.length; i++) {
    const cssFile = cssFiles[i];
    const originalContent = fs.readFileSync(cssFile, 'utf8');
    const originalSize = originalContent.length;
    totalOriginalSize += originalSize;
    
    const purgedContent = purgeCSSResult[i].css;
    const newSize = purgedContent.length;
    totalNewSize += newSize;
    
    fs.writeFileSync(cssFile, purgedContent);
    
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
    const fileName = path.basename(cssFile);
    console.log(`✓ ${fileName}: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
  }
  
  console.log(`\n✅ CSS purging complete:`);
  if (totalOriginalSize > 0) {
    const totalSavings = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
    console.log(`   Total: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(totalNewSize / 1024).toFixed(1)}KB (${totalSavings}% reduction)`);
  }
}

purgeCSS();

