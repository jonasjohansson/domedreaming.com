const fs = require('fs');
const path = require('path');

const docsImgPath = path.join(__dirname, '../docs/assets/img');
const sourceImgPath = path.join(__dirname, '../assets/img');

// Check if sharp is available (lightweight image processor)
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('⚠ sharp not installed. Install with: npm install -D sharp');
  console.warn('⚠ Skipping image optimization. Images will be copied as-is.');
  process.exit(0);
}

async function optimizeImage(sourceFile, destFile) {
  try {
    const stats = fs.statSync(sourceFile);
    const originalSize = stats.size;
    
    // Get file extension
    const ext = path.extname(sourceFile).toLowerCase();
    
    // Ensure directory exists
    const destDir = path.dirname(destFile);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const image = sharp(sourceFile);
    const metadata = await image.metadata();
    
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
    return { optimized: false, originalSize, newSize: originalSize };
  }
}

async function optimizeAllImages() {
  console.log('Optimizing images...\n');
  
  if (!fs.existsSync(sourceImgPath)) {
    console.warn(`⚠ Source images directory not found: ${sourceImgPath}`);
    return;
  }
  
  // Find all image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const files = [];
  
  function walkDir(dir, baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        walkDir(fullPath, baseDir);
      } else if (imageExtensions.includes(path.extname(entry.name).toLowerCase())) {
        files.push({ source: fullPath, relative: relPath });
      }
    }
  }
  
  walkDir(sourceImgPath);
  
  if (files.length === 0) {
    console.log('No images found to optimize.');
    return;
  }
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let optimizedCount = 0;
  let skippedCount = 0;
  
  for (const file of files) {
    const destFile = path.join(docsImgPath, file.relative);
    const result = await optimizeImage(file.source, destFile);
    
    if (result.optimized) {
      totalOriginalSize += result.originalSize;
      totalNewSize += result.newSize;
      optimizedCount++;
      console.log(`✓ ${file.relative}: ${(result.originalSize / 1024).toFixed(1)}KB → ${(result.newSize / 1024).toFixed(1)}KB (${result.savings}% reduction)`);
    } else {
      skippedCount++;
      if (result.error) {
        console.warn(`⚠ ${file.relative}: ${result.error}`);
      } else {
        console.log(`→ ${file.relative}: copied as-is`);
      }
    }
  }
  
  console.log(`\n✅ Image optimization complete:`);
  console.log(`   ${optimizedCount} optimized, ${skippedCount} skipped`);
  if (totalOriginalSize > 0) {
    const totalSavings = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
    console.log(`   Total: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(totalNewSize / 1024).toFixed(1)}KB (${totalSavings}% reduction)`);
  }
}

optimizeAllImages().catch(console.error);
