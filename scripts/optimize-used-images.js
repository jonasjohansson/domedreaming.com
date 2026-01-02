const fs = require('fs');
const path = require('path');
const { findUsedImages } = require('./analyze-image-usage.js');

const docsImgPath = path.join(__dirname, '../docs/assets/img');
const docsMediaPath = path.join(__dirname, '../docs/assets/media');
const sourceImgPath = path.join(__dirname, '../assets/img');
const sourceMediaPath = path.join(__dirname, '../assets/media');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠ sharp not installed. Install with: npm install -D sharp');
  console.warn('⚠ Skipping image optimization. Images will be left as-is.');
  process.exit(0);
}

/**
 * Find the source file for a used image path
 */
function findSourceFile(usedImagePath) {
  // Normalize the path
  let normalized = usedImagePath;
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  if (normalized.startsWith('assets/')) {
    normalized = normalized.substring(7);
  }
  
  // Try different path combinations
  const possiblePaths = [
    path.join(sourceImgPath, normalized.replace('img/', '')),
    path.join(sourceMediaPath, normalized.replace('media/', '')),
    path.join(sourceImgPath, path.basename(normalized)),
    path.join(sourceMediaPath, path.basename(normalized)),
  ];
  
  // Also try with the full path structure
  if (normalized.includes('img/')) {
    possiblePaths.push(path.join(sourceImgPath, normalized.replace('img/', '')));
  }
  if (normalized.includes('media/')) {
    possiblePaths.push(path.join(sourceMediaPath, normalized.replace('media/', '')));
  }
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      return possiblePath;
    }
  }
  
  return null;
}

/**
 * Determine destination path for optimized image
 */
function getDestPath(sourceFile, usedImagePath) {
  const fileName = path.basename(sourceFile);
  
  // Determine if it's img or media
  if (usedImagePath.includes('assets/img/') || sourceFile.includes('assets/img')) {
    const relPath = usedImagePath.includes('assets/img/') 
      ? usedImagePath.replace(/^.*assets\/img\//, '')
      : fileName;
    return path.join(docsImgPath, relPath);
  } else if (usedImagePath.includes('assets/media/') || sourceFile.includes('assets/media')) {
    const relPath = usedImagePath.includes('assets/media/')
      ? usedImagePath.replace(/^.*assets\/media\//, '')
      : fileName;
    return path.join(docsMediaPath, relPath);
  }
  
  // Fallback: use filename
  return path.join(docsImgPath, fileName);
}

async function optimizeImage(sourceFile, destFile) {
  try {
    const stats = fs.statSync(sourceFile);
    const originalSize = stats.size;
    
    const ext = path.extname(sourceFile).toLowerCase();
    
    // Ensure directory exists
    const destDir = path.dirname(destFile);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const image = sharp(sourceFile);
    
    // Optimize based on format
    if (ext === '.jpg' || ext === '.jpeg') {
      // Generate WebP version alongside JPEG
      const webpFile = destFile.replace(/\.(jpg|jpeg)$/i, '.webp');
      await image
        .webp({ quality: 85 })
        .toFile(webpFile);
      
      // Also optimize the original JPEG
      await image
        .jpeg({ 
          quality: 85, 
          mozjpeg: true,
          progressive: true 
        })
        .toFile(destFile);
    } else if (ext === '.png') {
      // Generate WebP version alongside PNG
      const webpFile = destFile.replace(/\.png$/i, '.webp');
      await image
        .webp({ quality: 90 })
        .toFile(webpFile);
      
      // Also optimize the original PNG
      await image
        .png({ 
          quality: 90,
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .toFile(destFile);
    } else if (ext === '.webp') {
      await image
        .webp({ quality: 85 })
        .toFile(destFile);
    } else {
      // Copy other formats as-is (SVG, etc.)
      fs.copyFileSync(sourceFile, destFile);
      return { optimized: false, originalSize, newSize: originalSize };
    }
    
    const newStats = fs.statSync(destFile);
    const newSize = newStats.size;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
    
    return { 
      optimized: true, 
      originalSize, 
      newSize,
      savings: parseFloat(savings)
    };
  } catch (error) {
    console.error(`Error optimizing ${sourceFile}:`, error.message);
    // Fallback: copy as-is
    fs.copyFileSync(sourceFile, destFile);
    return { optimized: false, originalSize: fs.statSync(sourceFile).size, newSize: fs.statSync(sourceFile).size };
  }
}

async function optimizeUsedImages() {
  console.log('Optimizing only used images...\n');
  
  // Get list of used images from HTML/CSS analysis
  const usedImages = findUsedImages();
  
  if (usedImages.size === 0) {
    console.log('No used images found. Make sure HTML has been built first.');
    return;
  }
  
  console.log(`Found ${usedImages.size} used images to optimize\n`);
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let optimizedCount = 0;
  let skippedCount = 0;
  const processedFiles = new Set();
  
  for (const usedImg of usedImages) {
    // Find source file
    const sourceFile = findSourceFile(usedImg);
    
    if (!sourceFile || !fs.existsSync(sourceFile)) {
      // Try to find by filename only
      const fileName = path.basename(usedImg);
      const possibleSources = [
        path.join(sourceImgPath, fileName),
        path.join(sourceMediaPath, fileName)
      ];
      
      let found = false;
      for (const possible of possibleSources) {
        if (fs.existsSync(possible)) {
          const destFile = getDestPath(possible, usedImg);
          const result = await optimizeImage(possible, destFile);
          
          if (result.optimized && !processedFiles.has(possible)) {
            totalOriginalSize += result.originalSize;
            totalNewSize += result.newSize;
            optimizedCount++;
            processedFiles.add(possible);
            const relPath = path.relative(path.join(__dirname, '../docs'), destFile);
            console.log(`✓ ${relPath}: ${(result.originalSize / 1024).toFixed(1)}KB → ${(result.newSize / 1024).toFixed(1)}KB (${result.savings}% reduction)`);
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        console.warn(`⚠ Could not find source for: ${usedImg}`);
        skippedCount++;
      }
      continue;
    }
    
    // Skip if already processed (same source file used multiple times)
    if (processedFiles.has(sourceFile)) {
      continue;
    }
    processedFiles.add(sourceFile);
    
    // Get destination path
    const destFile = getDestPath(sourceFile, usedImg);
    
    // Optimize the image (this will replace the unoptimized copy)
    const result = await optimizeImage(sourceFile, destFile);
    
    if (result.optimized) {
      totalOriginalSize += result.originalSize;
      totalNewSize += result.newSize;
      optimizedCount++;
      const relPath = path.relative(path.join(__dirname, '../docs'), destFile);
      console.log(`✓ ${relPath}: ${(result.originalSize / 1024).toFixed(1)}KB → ${(result.newSize / 1024).toFixed(1)}KB (${result.savings}% reduction)`);
    } else {
      skippedCount++;
    }
  }
  
  console.log(`\n✅ Image optimization complete:`);
  console.log(`   ${optimizedCount} optimized, ${skippedCount} skipped`);
  if (totalOriginalSize > 0) {
    const totalSavings = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
    console.log(`   Total: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(totalNewSize / 1024).toFixed(1)}KB (${totalSavings}% reduction)`);
  }
}

optimizeUsedImages().catch(console.error);

