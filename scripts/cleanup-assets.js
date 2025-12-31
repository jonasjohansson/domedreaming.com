const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');
const docsJsPath = path.join(docsPath, 'assets/js');

// Ensure CNAME exists (Eleventy should copy it, but double-check)
const sourceCnamePath = path.join(__dirname, '../CNAME');
const destCnamePath = path.join(docsPath, 'CNAME');
if (fs.existsSync(sourceCnamePath) && !fs.existsSync(destCnamePath)) {
  fs.copyFileSync(sourceCnamePath, destCnamePath);
  console.log('Copied CNAME to docs');
}

// Remove unused JavaScript files from docs
const unusedFiles = [
  'assets/js/3d/disco-ball.js',
  'assets/js/3d/led-strip.js'
];

unusedFiles.forEach(file => {
  const filePath = path.join(docsPath, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Removed unused file: ${file}`);
  }
});

console.log('Cleanup complete');
