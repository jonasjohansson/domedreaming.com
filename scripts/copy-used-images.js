const fs = require('fs');
const path = require('path');
const { findUsedImages, getAllSourceImages } = require('./analyze-image-usage.js');

const docsPath = path.join(__dirname, '../docs');
const docsImgPath = path.join(docsPath, 'assets/img');
const docsMediaPath = path.join(docsPath, 'assets/media');
const sourceImgPath = path.join(__dirname, '../assets/img');
const sourceMediaPath = path.join(__dirname, '../assets/media');

/**
 * Copy only used images to output directory
 */
function copyUsedImages() {
  console.log('Copying used images to build output...\n');
  
  const usedImages = findUsedImages();
  const allSourceImages = getAllSourceImages();
  
  // Create a map of filename -> full path for quick lookup
  const imageMap = new Map();
  for (const img of allSourceImages) {
    const fileName = path.basename(img);
    if (!imageMap.has(fileName)) {
      imageMap.set(fileName, []);
    }
    imageMap.get(fileName).push(img);
  }
  
  // Also create a map with full relative paths
  const pathMap = new Map();
  for (const img of allSourceImages) {
    pathMap.set(img, img);
    // Also map without assets/ prefix
    const withoutAssets = img.replace(/^assets\//, '');
    pathMap.set(withoutAssets, img);
    pathMap.set(`assets/${withoutAssets}`, img);
  }
  
  let copiedCount = 0;
  let skippedCount = 0;
  const copiedFiles = new Set();
  
  // Copy used images
  for (const usedImg of usedImages) {
    // Try to find the source file
    let sourceFile = null;
    
    // Try exact path match
    if (pathMap.has(usedImg)) {
      sourceFile = pathMap.get(usedImg);
    } else {
      // Try filename match
      const fileName = path.basename(usedImg);
      if (imageMap.has(fileName)) {
        // Use first match (or could be smarter about path matching)
        sourceFile = imageMap.get(fileName)[0];
      }
    }
    
    if (sourceFile) {
      // Determine destination
      let destFile;
      if (sourceFile.startsWith('assets/img/')) {
        const relPath = sourceFile.replace('assets/img/', '');
        destFile = path.join(docsImgPath, relPath);
      } else if (sourceFile.startsWith('assets/media/')) {
        const relPath = sourceFile.replace('assets/media/', '');
        destFile = path.join(docsMediaPath, relPath);
      } else {
        // Try to infer from used path
        if (usedImg.includes('assets/img/')) {
          const relPath = usedImg.replace(/^.*assets\/img\//, '');
          destFile = path.join(docsImgPath, relPath);
          sourceFile = path.join(sourceImgPath, relPath);
        } else if (usedImg.includes('assets/media/')) {
          const relPath = usedImg.replace(/^.*assets\/media\//, '');
          destFile = path.join(docsMediaPath, relPath);
          sourceFile = path.join(sourceMediaPath, relPath);
        } else {
          console.warn(`⚠ Could not determine destination for: ${usedImg}`);
          skippedCount++;
          continue;
        }
      }
      
      // Check if source file exists
      const fullSourcePath = path.join(__dirname, '..', sourceFile);
      if (!fs.existsSync(fullSourcePath)) {
        console.warn(`⚠ Source file not found: ${fullSourcePath}`);
        skippedCount++;
        continue;
      }
      
      // Ensure destination directory exists
      const destDir = path.dirname(destFile);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      // Copy file (if not already copied)
      // Note: This is a temporary copy, optimization will replace it
      if (!copiedFiles.has(destFile)) {
        fs.copyFileSync(fullSourcePath, destFile);
        copiedFiles.add(destFile);
        copiedCount++;
      }
    } else {
      console.warn(`⚠ Could not find source for: ${usedImg}`);
      skippedCount++;
    }
  }
  
  console.log(`✅ Image copy complete:`);
  console.log(`   ${copiedCount} images copied`);
  if (skippedCount > 0) {
    console.log(`   ${skippedCount} images skipped (not found or already copied)`);
  }
  console.log('');
}

copyUsedImages();

