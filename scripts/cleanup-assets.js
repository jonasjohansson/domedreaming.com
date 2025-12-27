const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs/assets');

// Remove individual CSS source files (Vite processes and bundles them)
const cssPath = path.join(docsPath, 'css');
if (fs.existsSync(cssPath)) {
  const files = fs.readdirSync(cssPath);
  files.forEach(file => {
    // Keep only Vite-processed files (they have hashes in the name)
    // Remove all source CSS files
    if (file.endsWith('.css') && !file.match(/-[A-Za-z0-9]+\.css$/)) {
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
const jsPath = path.join(docsPath, 'js');
if (fs.existsSync(jsPath)) {
  // Vite processes JS and creates hashed files in /assets/
  // We can remove the original JS files since Vite bundles them
  // But we need to keep the libs directory for import maps
  const removeDirs = ['3d', 'shader'];
  removeDirs.forEach(dir => {
    const dirPath = path.join(jsPath, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed ${dir} directory`);
    }
  });
  
  // Remove individual JS files in js root (but keep libs)
  const files = fs.readdirSync(jsPath);
  files.forEach(file => {
    if (file.endsWith('.js') && file !== 'default-settings.json') {
      const filePath = path.join(jsPath, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        console.log(`Removed ${file}`);
      }
    }
  });
}

console.log('Cleanup complete');
