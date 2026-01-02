const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs/assets/js');

/**
 * Analyze JavaScript bundle sizes and identify optimization opportunities
 */
function analyzeBundle() {
  console.log('Analyzing JavaScript bundle sizes...\n');
  
  if (!fs.existsSync(docsPath)) {
    console.warn(`⚠ Output directory not found: ${docsPath}`);
    return;
  }
  
  const files = [];
  
  function walkDir(dir, baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        walkDir(fullPath, baseDir);
      } else if (entry.name.endsWith('.js')) {
        const stats = fs.statSync(fullPath);
        files.push({
          path: relPath,
          fullPath,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(1)
        });
      }
    }
  }
  
  walkDir(docsPath);
  
  if (files.length === 0) {
    console.log('No JavaScript files found.');
    return;
  }
  
  // Sort by size (largest first)
  files.sort((a, b) => b.size - a.size);
  
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  
  console.log('📦 JavaScript Bundle Analysis\n');
  console.log('File sizes (largest first):\n');
  
  files.forEach((file, index) => {
    const percentage = ((file.size / totalSize) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(percentage / 2));
    console.log(`${(index + 1).toString().padStart(2)}. ${file.path.padEnd(50)} ${file.sizeKB.padStart(8)}KB (${percentage}%) ${bar}`);
  });
  
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Total: ${(totalSize / 1024).toFixed(1)}KB (${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
  
  // Recommendations
  console.log('\n💡 Optimization Recommendations:\n');
  
  const largeFiles = files.filter(f => f.size > 100 * 1024); // > 100KB
  if (largeFiles.length > 0) {
    console.log(`⚠ Large files (>100KB) detected:`);
    largeFiles.forEach(f => {
      console.log(`   - ${f.path}: ${f.sizeKB}KB`);
      console.log(`     Consider: code splitting, lazy loading, or further minification`);
    });
    console.log('');
  }
  
  if (totalSize > 500 * 1024) {
    console.log(`⚠ Total bundle size is ${(totalSize / 1024).toFixed(1)}KB (>500KB)`);
    console.log(`   Consider: dynamic imports, lazy loading, or removing unused code\n`);
  }
  
  // Check for duplicate code patterns
  console.log('📊 Module Distribution:');
  const modulesByDir = {};
  files.forEach(f => {
    const dir = path.dirname(f.path);
    if (!modulesByDir[dir]) modulesByDir[dir] = { count: 0, size: 0 };
    modulesByDir[dir].count++;
    modulesByDir[dir].size += f.size;
  });
  
  Object.entries(modulesByDir)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([dir, stats]) => {
      console.log(`   ${dir || '(root)'}: ${stats.count} files, ${(stats.size / 1024).toFixed(1)}KB`);
    });
}

analyzeBundle();

