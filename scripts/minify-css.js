const fs = require('fs');
const path = require('path');
const { minify } = require('csso');

const docsPath = path.join(__dirname, '../docs/assets/css');
const sourcePath = path.join(__dirname, '../assets/css');

// CSS files to minify (individual files first, then main.css which imports them)
const cssFiles = [
  'base.css',
  'dots.css',
  'blocks.css',
  'layout.css',
  'components.css',
  'shader.css'
];

// main.css uses @import, so we'll handle it separately
const mainCssFile = 'main.css';

async function minifyFile(sourceFile, destFile) {
  try {
    const code = fs.readFileSync(sourceFile, 'utf8');
    
    // Minify CSS
    const result = minify(code, {
      restructure: true, // Optimize CSS structure
      comments: false,    // Remove comments
      forceMediaMerge: true // Merge media queries
    });
    
    if (result.error) {
      console.error(`Error minifying ${sourceFile}:`, result.error);
      return false;
    }
    
    // Ensure directory exists
    const destDir = path.dirname(destFile);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.writeFileSync(destFile, result.css);
    const originalSize = fs.statSync(sourceFile).size;
    const minifiedSize = result.css.length;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    console.log(`✓ ${path.relative(sourcePath, sourceFile)}: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
    return true;
  } catch (error) {
    console.error(`Error processing ${sourceFile}:`, error.message);
    return false;
  }
}

async function minifyAll() {
  console.log('Minifying CSS files...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of cssFiles) {
    const sourceFile = path.join(sourcePath, file);
    const destFile = path.join(docsPath, file);
    
    if (fs.existsSync(sourceFile)) {
      const success = await minifyFile(sourceFile, destFile);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    } else {
      console.warn(`⚠ File not found: ${sourceFile}`);
      failCount++;
    }
  }
  
  // Handle main.css separately (it uses @import)
  const mainSourceFile = path.join(sourcePath, mainCssFile);
  const mainDestFile = path.join(docsPath, mainCssFile);
  
  if (fs.existsSync(mainSourceFile)) {
    try {
      // Read main.css
      let mainCSS = fs.readFileSync(mainSourceFile, 'utf8');
      
      // Replace @import paths to point to minified files (they have same names)
      // @import "./base.css" stays the same since we minified base.css
      // The imports will work because we minified all the individual files
      
      // Minify main.css (csso will handle @import statements)
      const result = minify(mainCSS, {
        restructure: false, // Don't restructure when @import is present
        comments: false,
        forceMediaMerge: false
      });
      
      if (!result.error) {
        const destDir = path.dirname(mainDestFile);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        fs.writeFileSync(mainDestFile, result.css);
        const originalSize = fs.statSync(mainSourceFile).size;
        const minifiedSize = result.css.length;
        const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
        console.log(`✓ ${mainCssFile}: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
        successCount++;
      } else {
        console.error(`Error minifying ${mainCssFile}:`, result.error);
        failCount++;
      }
    } catch (error) {
      console.error(`Error processing ${mainCssFile}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n✅ CSS minification complete: ${successCount} succeeded, ${failCount} failed`);
}

minifyAll().catch(console.error);

