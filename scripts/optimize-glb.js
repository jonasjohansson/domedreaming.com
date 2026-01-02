const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const docsModelPath = path.join(__dirname, '../docs/assets/models');
const sourceModelPath = path.join(__dirname, '../assets/models');

/**
 * Optimize GLB models using gltf-pipeline
 * Note: Requires gltf-pipeline to be installed globally or via npm
 */
function optimizeGLB() {
  console.log('Optimizing GLB models...\n');
  
  // Check if gltf-pipeline is available
  let gltfPipelineAvailable = false;
  try {
    execSync('gltf-pipeline --version', { stdio: 'ignore' });
    gltfPipelineAvailable = true;
  } catch (e) {
    // Try npx
    try {
      execSync('npx --yes gltf-pipeline --version', { stdio: 'ignore' });
      gltfPipelineAvailable = true;
    } catch (e2) {
      console.warn('⚠ gltf-pipeline not found.');
      console.warn('   Install with: npm install -g gltf-pipeline');
      console.warn('   Or use: npx gltf-pipeline');
      console.warn('   Skipping GLB optimization.\n');
      return;
    }
  }
  
  if (!fs.existsSync(sourceModelPath)) {
    console.warn(`⚠ Source models directory not found: ${sourceModelPath}`);
    return;
  }
  
  // Find all GLB files
  const glbFiles = [];
  const entries = fs.readdirSync(sourceModelPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.glb')) {
      glbFiles.push(entry.name);
    }
  }
  
  if (glbFiles.length === 0) {
    console.log('No GLB files found to optimize.');
    return;
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(docsModelPath)) {
    fs.mkdirSync(docsModelPath, { recursive: true });
  }
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let optimizedCount = 0;
  
  for (const glbFile of glbFiles) {
    const sourceFile = path.join(sourceModelPath, glbFile);
    const destFile = path.join(docsModelPath, glbFile);
    
    const originalSize = fs.statSync(sourceFile).size;
    totalOriginalSize += originalSize;
    
    try {
      // Use gltf-pipeline to compress
      // -d: draco compression
      // -b: binary output (GLB)
      const command = `gltf-pipeline -i "${sourceFile}" -o "${destFile}" -d -b`;
      
      try {
        execSync(command, { stdio: 'pipe' });
      } catch (e) {
        // Try with npx
        execSync(`npx --yes ${command}`, { stdio: 'pipe' });
      }
      
      const newSize = fs.statSync(destFile).size;
      totalNewSize += newSize;
      optimizedCount++;
      
      const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
      console.log(`✓ ${glbFile}: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
    } catch (error) {
      console.warn(`⚠ ${glbFile}: Error during optimization, copying as-is`);
      console.warn(`   ${error.message}`);
      // Fallback: copy as-is
      fs.copyFileSync(sourceFile, destFile);
      totalNewSize += originalSize;
    }
  }
  
  console.log(`\n✅ GLB optimization complete:`);
  console.log(`   ${optimizedCount} optimized`);
  if (totalOriginalSize > 0) {
    const totalSavings = ((1 - totalNewSize / totalOriginalSize) * 100).toFixed(1);
    console.log(`   Total: ${(totalOriginalSize / 1024).toFixed(1)}KB → ${(totalNewSize / 1024).toFixed(1)}KB (${totalSavings}% reduction)`);
  }
}

optimizeGLB();

