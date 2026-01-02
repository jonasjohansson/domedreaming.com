const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const docsPath = path.join(__dirname, '../docs');
const cssPath = path.join(docsPath, 'assets/css');

/**
 * Analyze CSS usage and identify potentially unused CSS
 * Note: This is a basic analysis. For production, consider PurgeCSS
 */
function analyzeCSSUsage() {
  console.log('Analyzing CSS usage...\n');
  
  if (!fs.existsSync(docsPath)) {
    console.warn(`⚠ Output directory not found: ${docsPath}`);
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
  
  // Read all CSS files
  const cssFiles = [];
  if (fs.existsSync(cssPath)) {
    const entries = fs.readdirSync(cssPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.css')) {
        const fullPath = path.join(cssPath, entry.name);
        const content = fs.readFileSync(fullPath, 'utf8');
        const size = fs.statSync(fullPath).size;
        cssFiles.push({
          name: entry.name,
          path: fullPath,
          content,
          size
        });
      }
    }
  }
  
  if (cssFiles.length === 0) {
    console.log('No CSS files found.');
    return;
  }
  
  // Extract all class names and IDs from HTML
  const usedSelectors = new Set();
  
  htmlFiles.forEach(htmlFile => {
    try {
      const html = fs.readFileSync(htmlFile, 'utf8');
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract classes
      document.querySelectorAll('[class]').forEach(el => {
        el.className.split(/\s+/).forEach(cls => {
          if (cls) usedSelectors.add(`.${cls}`);
        });
      });
      
      // Extract IDs
      document.querySelectorAll('[id]').forEach(el => {
        if (el.id) usedSelectors.add(`#${el.id}`);
      });
      
      // Extract tag names
      document.querySelectorAll('*').forEach(el => {
        usedSelectors.add(el.tagName.toLowerCase());
      });
    } catch (error) {
      console.warn(`⚠ Error parsing ${htmlFile}:`, error.message);
    }
  });
  
  console.log(`Found ${usedSelectors.size} unique selectors in HTML\n`);
  
  // Analyze CSS files
  console.log('📊 CSS File Analysis:\n');
  
  cssFiles.forEach(cssFile => {
    const lines = cssFile.content.split('\n');
    const totalLines = lines.length;
    const totalSize = cssFile.size;
    
    // Count selectors (basic regex - not perfect but good enough)
    const selectorMatches = cssFile.content.match(/[^{}]+{/g) || [];
    const selectorCount = selectorMatches.length;
    
    console.log(`${cssFile.name}:`);
    console.log(`   Size: ${(totalSize / 1024).toFixed(1)}KB`);
    console.log(`   Lines: ${totalLines}`);
    console.log(`   Selectors: ~${selectorCount}`);
    console.log('');
  });
  
  const totalCSSSize = cssFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(`Total CSS: ${(totalCSSSize / 1024).toFixed(1)}KB\n`);
  
  console.log('💡 Recommendations:');
  console.log('   - Consider using PurgeCSS for production builds');
  console.log('   - Review CSS for unused utility classes');
  console.log('   - Use CSS custom properties to reduce duplication');
  console.log('   - Consider critical CSS extraction (already implemented)');
}

// Only run if jsdom is available
try {
  require('jsdom');
  analyzeCSSUsage();
} catch (e) {
  console.log('⚠ jsdom not installed. Skipping CSS analysis.');
  console.log('   Install with: npm install -D jsdom');
  console.log('   Or use PurgeCSS for production CSS purging.');
}

