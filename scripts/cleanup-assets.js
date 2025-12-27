const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');
const assetsPath = path.join(docsPath, 'assets');

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

  // Keep core/ directory and default-settings.json
  const corePath = path.join(jsPath, 'core');
  if (fs.existsSync(corePath)) {
    const coreFiles = fs.readdirSync(corePath);
    coreFiles.forEach(file => {
      // Keep default-settings.json, remove JS files
      if (file.endsWith('.js')) {
        const filePath = path.join(corePath, file);
        fs.unlinkSync(filePath);
        console.log(`Removed core/${file}`);
      }
    });
  }
}

console.log('Cleanup complete');
