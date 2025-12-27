const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');
const assetsPath = path.join(docsPath, 'assets');
const sourceAssetsPath = path.join(__dirname, '../assets');

// Copy CNAME from root to docs (Vite's emptyOutDir removes it, so we restore it)
const sourceCnamePath = path.join(__dirname, '../CNAME');
const destCnamePath = path.join(docsPath, 'CNAME');
if (fs.existsSync(sourceCnamePath) && !fs.existsSync(destCnamePath)) {
  fs.copyFileSync(sourceCnamePath, destCnamePath);
  console.log('Copied CNAME to docs');
}

// Copy models directory (Vite's emptyOutDir removes it, so we restore it)
const sourceModelsPath = path.join(sourceAssetsPath, 'models');
const destModelsPath = path.join(assetsPath, 'models');
if (fs.existsSync(sourceModelsPath) && !fs.existsSync(destModelsPath)) {
  fs.mkdirSync(destModelsPath, { recursive: true });
  const modelsFiles = fs.readdirSync(sourceModelsPath);
  modelsFiles.forEach(file => {
    const sourceFile = path.join(sourceModelsPath, file);
    const destFile = path.join(destModelsPath, file);
    if (fs.statSync(sourceFile).isFile()) {
      fs.copyFileSync(sourceFile, destFile);
    }
  });
  console.log('Restored models directory');
}

// Copy core directory with default-settings.json (Vite's emptyOutDir removes it, so we restore it)
const sourceCorePath = path.join(sourceAssetsPath, 'js', 'core');
const destCorePath = path.join(assetsPath, 'js', 'core');
if (fs.existsSync(sourceCorePath)) {
  if (!fs.existsSync(destCorePath)) {
    fs.mkdirSync(destCorePath, { recursive: true });
  }
  const coreFiles = fs.readdirSync(sourceCorePath);
  coreFiles.forEach(file => {
    // Only copy JSON files and other non-JS files (JS files are bundled by Vite)
    if (!file.endsWith('.js')) {
      const sourceFile = path.join(sourceCorePath, file);
      const destFile = path.join(destCorePath, file);
      if (fs.statSync(sourceFile).isFile()) {
        fs.copyFileSync(sourceFile, destFile);
        console.log(`Restored core/${file}`);
      }
    }
  });
}

// Remove individual CSS source files (Vite processes and bundles them)
// Vite outputs hashed files like style.BQ_WivgK.css (with dot separator)
// We should keep files with hash patterns (containing a dot before the extension)
const cssPath = path.join(assetsPath, 'css');
if (fs.existsSync(cssPath)) {
  const files = fs.readdirSync(cssPath);
  files.forEach(file => {
    // Keep Vite-processed files (they have hashes: name.hash.css or name-hash.css)
    // Remove source CSS files that don't have hash patterns
    const hasHash = file.match(/\.([A-Za-z0-9_-]+)\.css$/) || file.match(/-([A-Za-z0-9_-]+)\.css$/);
    if (file.endsWith('.css') && !hasHash) {
      const filePath = path.join(cssPath, file);
      fs.unlinkSync(filePath);
      console.log(`Removed ${file}`);
    }
  });
  
  // Remove css directory if empty
  try {
    fs.rmdirSync(cssPath);
    console.log('Removed empty css directory');
  } catch (e) {
    // Directory not empty or doesn't exist, that's fine
  }
}

// Remove JS source files that Vite has processed
const jsPath = path.join(assetsPath, 'js');
if (fs.existsSync(jsPath)) {
  // Vite processes JS and creates hashed files in /assets/
  // We can remove the original JS files since Vite bundles them
  // But we need to keep core/ for default-settings.json and 3d/ for model files
  const removeDirs = ['layout', 'ui', 'shader'];
  removeDirs.forEach(dir => {
    const dirPath = path.join(jsPath, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed ${dir} directory`);
    }
  });

  // Remove individual JS source files (but keep Vite-processed hashed files and core/)
  // Vite outputs hashed files like main.T3T32USF.js or index.CZdWWh6m.js (with dot separator)
  const files = fs.readdirSync(jsPath);
  files.forEach(file => {
    if (file.endsWith('.js')) {
      // Keep Vite-processed files (they have hashes: name.hash.js or name-hash.js)
      const hasHash = file.match(/\.([A-Za-z0-9_-]+)\.js$/) || file.match(/-([A-Za-z0-9_-]+)\.js$/);
      // Keep core directory
      if (!hasHash && file !== 'main.js') {
        const filePath = path.join(jsPath, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log(`Removed ${file}`);
        }
      }
    }
  });

  // Keep core/ directory and default-settings.json (needed at runtime)
  const corePath = path.join(jsPath, 'core');
  if (fs.existsSync(corePath)) {
    const coreFiles = fs.readdirSync(corePath);
    coreFiles.forEach(file => {
      // Keep default-settings.json and other non-JS files, remove JS files
      if (file.endsWith('.js')) {
        const filePath = path.join(corePath, file);
        fs.unlinkSync(filePath);
        console.log(`Removed core/${file}`);
      }
    });
  }
  
  // Keep 3d/ directory for model files (needed at runtime)
  const threeDPath = path.join(jsPath, '3d');
  if (fs.existsSync(threeDPath)) {
    // Don't remove 3d directory - it may contain model files or other assets
    console.log('Preserved 3d/ directory');
  }
}

// Ensure models directory exists (needed for GLB files)
const modelsPath = path.join(assetsPath, 'models');
if (!fs.existsSync(modelsPath)) {
  console.warn('Models directory not found - models may not be copied correctly');
} else {
  console.log('Models directory preserved');
}

console.log('Cleanup complete');
