/**
 * Bundle the entire app including Three.js for tree-shaking and single file output
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT_DIR = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "assets", "js");

async function bundle() {
  try {
    console.log("Bundling application with Three.js...\n");

    const result = await esbuild.build({
      entryPoints: [path.join(ROOT_DIR, "assets", "js", "main.js")],
      bundle: true,
      minify: true,
      format: "esm",
      outfile: path.join(OUTPUT_DIR, "app.bundle.js"),
      target: ["es2020"],
      treeShaking: true,
      metafile: true,
      // Keep recast-navigation external (loaded from CDN)
      external: [
        "@recast-navigation/core",
        "@recast-navigation/wasm",
        "@recast-navigation/generators",
        "@recast-navigation/three",
      ],
      // Resolve node_modules
      nodePaths: [path.join(ROOT_DIR, "node_modules")],
    });

    // Report bundle size
    const outputs = result.metafile.outputs;
    for (const [file, info] of Object.entries(outputs)) {
      const sizeKB = (info.bytes / 1024).toFixed(1);
      console.log(`✓ ${path.basename(file)}: ${sizeKB}KB`);
    }

    // Show what was included
    const inputs = result.metafile.inputs;
    const threeSize = Object.entries(inputs)
      .filter(([k]) => k.includes("node_modules/three"))
      .reduce((sum, [, v]) => sum + v.bytes, 0);
    const appSize = Object.entries(inputs)
      .filter(([k]) => k.startsWith("assets/"))
      .reduce((sum, [, v]) => sum + v.bytes, 0);

    console.log(`\nBreakdown:`);
    console.log(`  Three.js modules: ${(threeSize / 1024).toFixed(1)}KB (source)`);
    console.log(`  App code: ${(appSize / 1024).toFixed(1)}KB (source)`);

    console.log("\n✅ App bundle complete");
  } catch (error) {
    console.error("Bundle failed:", error);
    process.exit(1);
  }
}

bundle();
