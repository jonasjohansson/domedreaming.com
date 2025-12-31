const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const docsPath = path.join(__dirname, '../docs/assets/js');
const sourcePath = path.join(__dirname, '../assets/js');

// Files to minify (main entry point and all modules)
const filesToMinify = [
  'main.js',
  '3d/scene.js',
  '3d/camera.js',
  '3d/model.js',
  '3d/movement.js',
  '3d/texture.js',
  '3d/utils.js',
  '3d/config.js',
  '3d/lighting.js',
  '3d/postprocessing.js',
  '3d/navmesh.js',
  '3d/screen-lighting.js',
  'core/settings.js',
  'core/utils.js',
  'layout/grid-dots.js',
  'layout/responsive-height.js',
  'layout/scroll-increment.js',
  'ui/dashboard.js'
];

async function minifyFile(sourceFile, destFile) {
  try {
    const code = fs.readFileSync(sourceFile, 'utf8');
    const result = await minify(code, {
      compress: {
        drop_console: true, // Remove console for production
        passes: 2
      },
      mangle: {
        reserved: ['THREE', 'window', 'document', 'console'] // Don't mangle these
      },
      format: {
        comments: false
      }
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
    
    fs.writeFileSync(destFile, result.code);
    const originalSize = fs.statSync(sourceFile).size;
    const minifiedSize = result.code.length;
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
    console.log(`✓ ${path.relative(sourcePath, sourceFile)}: ${(originalSize / 1024).toFixed(1)}KB → ${(minifiedSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
    return true;
  } catch (error) {
    console.error(`Error processing ${sourceFile}:`, error.message);
    return false;
  }
}

async function minifyAll() {
  console.log('Minifying JavaScript files...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of filesToMinify) {
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
  
  // Copy JSON files as-is (they're already minimal)
  const jsonFiles = ['core/default-settings.json'];
  for (const file of jsonFiles) {
    const sourceFile = path.join(sourcePath, file);
    const destFile = path.join(docsPath, file);
    if (fs.existsSync(sourceFile)) {
      const destDir = path.dirname(destFile);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(sourceFile, destFile);
      console.log(`✓ Copied ${file}`);
    }
  }
  
  console.log(`\n✅ Minification complete: ${successCount} succeeded, ${failCount} failed`);
}

minifyAll().catch(console.error);

