const { execSync } = require('child_process');
const path = require('path');

/**
 * Master optimization script that runs all optimizations
 * Can be run in parallel where possible
 */
console.log('🚀 Starting optimization pipeline...\n');

const scripts = [
  { name: 'Images', script: 'optimize-images.js', required: false },
  { name: 'GLB Models', script: 'optimize-glb.js', required: false }
];

let successCount = 0;
let failCount = 0;

for (const { name, script, required } of scripts) {
  try {
    console.log(`Running ${name} optimization...`);
    execSync(`node ${path.join(__dirname, script)}`, { stdio: 'inherit' });
    successCount++;
    console.log('');
  } catch (error) {
    failCount++;
    if (required) {
      console.error(`❌ ${name} optimization failed (required):`, error.message);
      process.exit(1);
    } else {
      console.warn(`⚠ ${name} optimization skipped (optional)`);
    }
  }
}

console.log(`\n✅ Optimization complete: ${successCount} succeeded, ${failCount} failed`);

