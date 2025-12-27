const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');

// Ensure CNAME exists (Eleventy should copy it, but double-check)
const sourceCnamePath = path.join(__dirname, '../CNAME');
const destCnamePath = path.join(docsPath, 'CNAME');
if (fs.existsSync(sourceCnamePath) && !fs.existsSync(destCnamePath)) {
  fs.copyFileSync(sourceCnamePath, destCnamePath);
  console.log('Copied CNAME to docs');
}

console.log('Cleanup complete');
