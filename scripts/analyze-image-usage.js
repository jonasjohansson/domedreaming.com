const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');
const sourceImgPath = path.join(__dirname, '../assets/img');
const sourceMediaPath = path.join(__dirname, '../assets/media');

/**
 * Analyze which images are actually used in the HTML
 * Returns a Set of image paths that are referenced
 */
function findUsedImages() {
  const usedImages = new Set();
  
  // Find all HTML files
  const htmlFiles = [];
  function findHTMLFiles(dir) {
    if (!fs.existsSync(dir)) return;
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
  
  // Also check source templates
  const includesPath = path.join(__dirname, '../_includes');
  findHTMLFiles(includesPath);
  
  // Also check CSS files for background images
  const cssPath = path.join(__dirname, '../assets/css');
  if (fs.existsSync(cssPath)) {
    const entries = fs.readdirSync(cssPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.css')) {
        htmlFiles.push(path.join(cssPath, entry.name));
      }
    }
  }
  
  // Patterns to match image references
  const imagePatterns = [
    /src=["']([^"']+\.(jpg|jpeg|png|webp|gif|svg))["']/gi,
    /background-image:\s*url\(["']?([^"')]+\.(jpg|jpeg|png|webp|gif|svg))["']?\)/gi,
    /url\(["']?([^"')]+\.(jpg|jpeg|png|webp|gif|svg))["']?\)/gi,
    /href=["']([^"']+\.(jpg|jpeg|png|webp|gif|svg))["']/gi
  ];
  
  for (const file of htmlFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of imagePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          let imagePath = match[1];
          
          // Normalize path
          if (imagePath.startsWith('/')) {
            imagePath = imagePath.substring(1);
          }
          
          // Remove query strings and fragments
          imagePath = imagePath.split('?')[0].split('#')[0];
          
          // Add to used images
          if (imagePath.includes('assets/img/') || imagePath.includes('assets/media/')) {
            usedImages.add(imagePath);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠ Error reading ${file}:`, error.message);
    }
  }
  
  return usedImages;
}

/**
 * Get all image files in source directories
 */
function getAllSourceImages() {
  const allImages = new Set();
  
  function scanDirectory(dir, basePath = '') {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(basePath, entry.name);
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath, relPath);
      } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(entry.name)) {
        allImages.add(relPath);
      }
    }
  }
  
  if (fs.existsSync(sourceImgPath)) {
    scanDirectory(sourceImgPath, 'assets/img/');
  }
  
  if (fs.existsSync(sourceMediaPath)) {
    scanDirectory(sourceMediaPath, 'assets/media/');
  }
  
  return allImages;
}

/**
 * Main function to analyze and report unused images
 */
function analyzeImageUsage() {
  console.log('Analyzing image usage...\n');
  
  const usedImages = findUsedImages();
  const allImages = getAllSourceImages();
  
  // Convert to relative paths for comparison
  const usedSet = new Set();
  for (const img of usedImages) {
    // Normalize path
    let normalized = img.replace(/^assets\//, '');
    usedSet.add(normalized);
    
    // Also check without assets/ prefix
    if (img.startsWith('assets/')) {
      usedSet.add(img.substring(7));
    }
  }
  
  const unusedImages = [];
  for (const img of allImages) {
    // Check various path formats
    const imgName = path.basename(img);
    const imgPath = img.replace(/^assets\//, '');
    const imgFullPath = `assets/${imgPath}`;
    
    let isUsed = false;
    
    // Check exact matches
    if (usedSet.has(imgPath) || usedSet.has(imgFullPath) || usedSet.has(img)) {
      isUsed = true;
    }
    
    // Check if filename matches (in case path differs)
    for (const used of usedSet) {
      if (used.includes(imgName) || img.includes(path.basename(used))) {
        isUsed = true;
        break;
      }
    }
    
    if (!isUsed) {
      unusedImages.push(img);
    }
  }
  
  console.log(`📊 Image Usage Analysis:\n`);
  console.log(`   Total images: ${allImages.size}`);
  console.log(`   Used images: ${usedImages.size}`);
  console.log(`   Unused images: ${unusedImages.length}\n`);
  
  if (unusedImages.length > 0) {
    console.log('⚠️  Unused images (not referenced in HTML/CSS):\n');
    unusedImages.forEach(img => {
      console.log(`   - ${img}`);
    });
    console.log('');
  } else {
    console.log('✅ All images are being used!\n');
  }
  
  return { usedImages: Array.from(usedImages), unusedImages };
}

if (require.main === module) {
  analyzeImageUsage();
}

module.exports = { analyzeImageUsage, findUsedImages, getAllSourceImages };

