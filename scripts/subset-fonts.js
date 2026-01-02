const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docsPath = path.join(__dirname, '../docs');
const docsFontsPath = path.join(docsPath, 'assets/fonts');
const sourceFontsPath = path.join(__dirname, '../assets/fonts');

/**
 * Subset fonts using glyphhanger to include only used characters
 * This can reduce font file sizes by 70-90%
 */
function subsetFonts() {
  console.log('Subsetting fonts with glyphhanger...\n');
  
  // Check if glyphhanger is available
  let glyphhangerAvailable = false;
  try {
    execSync('glyphhanger --version', { stdio: 'ignore' });
    glyphhangerAvailable = true;
  } catch (e) {
    // Try npx
    try {
      execSync('npx --yes glyphhanger --version', { stdio: 'ignore' });
      glyphhangerAvailable = true;
    } catch (e2) {
      console.warn('⚠ glyphhanger not found.');
      console.warn('   Install with: npm install -g glyphhanger');
      console.warn('   Or use: npx glyphhanger');
      console.warn('   Skipping font subsetting.\n');
      return;
    }
  }
  
  if (!fs.existsSync(sourceFontsPath)) {
    console.warn(`⚠ Source fonts directory not found: ${sourceFontsPath}`);
    return;
  }
  
  // Find all HTML files to analyze character usage
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
    console.log('No HTML files found. Run Eleventy build first.');
    return;
  }
  
  // Find all font files
  const fontFiles = [];
  const entries = fs.readdirSync(sourceFontsPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.woff2') || entry.name.endsWith('.woff'))) {
      fontFiles.push(entry.name);
    }
  }
  
  if (fontFiles.length === 0) {
    console.log('No font files found to subset.');
    return;
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(docsFontsPath)) {
    fs.mkdirSync(docsFontsPath, { recursive: true });
  }
  
  // Create a temporary HTML file with all content for glyphhanger to analyze
  const tempHtmlPath = path.join(__dirname, '../temp-glyphhanger.html');
  let combinedHtml = '';
  htmlFiles.forEach(htmlFile => {
    try {
      combinedHtml += fs.readFileSync(htmlFile, 'utf8');
    } catch (error) {
      console.warn(`⚠ Error reading ${htmlFile}:`, error.message);
    }
  });
  
  // Write temporary HTML file
  fs.writeFileSync(tempHtmlPath, combinedHtml);
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let subsettedCount = 0;
  
  for (const fontFile of fontFiles) {
    const sourceFile = path.join(sourceFontsPath, fontFile);
    const destFile = path.join(docsFontsPath, fontFile);
    
    const originalSize = fs.statSync(sourceFile).size;
    totalOriginalSize += originalSize;
    
    try {
      // Use glyphhanger to subset the font
      // --subset: subset the font
      // --formats=woff2,woff: keep both formats
      // --US_ASCII: include ASCII characters
      // --whitelist: include all characters found in HTML
      const command = `glyphhanger --subset="${sourceFile}" --formats=woff2,woff --US_ASCII --whitelist="${tempHtmlPath}" --output="${docsFontsPath}"`;
      
      try {
        execSync(command, { stdio: 'pipe' });
      } catch (e) {
        // Try with npx
        execSync(`npx --yes ${command}`, { stdio: 'pipe' });
      }
      
      // Check if output file exists (glyphhanger may rename files)
      let outputFile = destFile;
      if (!fs.existsSync(outputFile)) {
        // Try to find the output file (glyphhanger may add suffix)
        const baseName = path.basename(fontFile, path.extname(fontFile));
        const ext = path.extname(fontFile);
        const possibleNames = [
          `${baseName}-subset${ext}`,
          `${baseName}.subset${ext}`,
          fontFile
        ];
        
        for (const name of possibleNames) {
          const possiblePath = path.join(docsFontsPath, name);
          if (fs.existsSync(possiblePath)) {
            outputFile = possiblePath;
            // Rename to original name
            fs.renameSync(possiblePath, destFile);
            break;
          }
        }
      }
      
      if (fs.existsSync(destFile)) {
        const newSize = fs.statSync(destFile).size;
        totalNewSize += newSize;
        subsettedCount++;
        
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
        console.log(`✓ ${fontFile}: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
      } else {
        // Fallback: copy as-is
        fs.copyFileSync(sourceFile, destFile);
        totalNewSize += originalSize;
        console.warn(`⚠ ${fontFile}: Subsetting failed, copied as-is`);
      }
    } catch (error) {
      console.warn(`⚠ ${fontFile}: Error during subsetting, copying as-is`);
      console.warn(`   ${error.message}`);
      // Fallback: copy as-is
      fs.copyFileSync(sourceFile, destFile);
      totalNewSize += originalSize;
    }
  }
  
  // Clean up temporary HTML file
  try {
    fs.unlinkSync(tempHtmlPath);
  } catch (e) {
    // Ignore cleanup errors
  }
  
  console.log(`\n✅ Font subsetting complete:`);
  console.log(`   ${subsettedCount} subsetted`);
  if (totalOriginalSize > 0) {
    const totalSavings = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
    console.log(`   Total: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(totalNewSize / 1024).toFixed(1)}KB (${totalSavings}% reduction)`);
  }
}

subsetFonts();

