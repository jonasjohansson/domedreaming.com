const fs = require('fs');
const path = require('path');

const sourceFontsPath = path.join(__dirname, '../assets/fonts');
const docsFontsPath = path.join(__dirname, '../docs/assets/fonts');

/**
 * Remove unused font files from source and build output
 */
function removeUnusedFonts() {
  console.log('Removing unused fonts...\n');
  
  const fontsToRemove = [
    'OffBit-101Bold.woff2',
    'KovskijDisplay_Trial-Regular.woff2',
    'KovskijDisplay_Trial-Regular.woff'
  ];
  
  let removedCount = 0;
  let notFoundCount = 0;
  
  // Remove from source
  for (const fontFile of fontsToRemove) {
    const sourceFile = path.join(sourceFontsPath, fontFile);
    if (fs.existsSync(sourceFile)) {
      try {
        fs.unlinkSync(sourceFile);
        console.log(`✓ Removed from source: ${fontFile}`);
        removedCount++;
      } catch (error) {
        console.warn(`⚠ Error removing ${fontFile}:`, error.message);
      }
    } else {
      notFoundCount++;
    }
  }
  
  // Remove from build output
  if (fs.existsSync(docsFontsPath)) {
    for (const fontFile of fontsToRemove) {
      const destFile = path.join(docsFontsPath, fontFile);
      if (fs.existsSync(destFile)) {
        try {
          fs.unlinkSync(destFile);
          console.log(`✓ Removed from build: ${fontFile}`);
        } catch (error) {
          console.warn(`⚠ Error removing ${fontFile} from build:`, error.message);
        }
      }
    }
  }
  
  console.log(`\n✅ Font cleanup complete:`);
  console.log(`   ${removedCount} fonts removed from source`);
  if (notFoundCount > 0) {
    console.log(`   ${notFoundCount} fonts not found (may have been removed already)`);
  }
}

removeUnusedFonts();

