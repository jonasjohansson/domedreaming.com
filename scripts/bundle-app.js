/**
 * Bundle the app and vendor libraries separately
 * - vendor.bundle.js: Three.js + addons + lil-gui (for import map)
 * - app.bundle.js: App code only (uses import map for dependencies)
 */

const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const ROOT_DIR = path.join(__dirname, "..");
const outputBase = process.env.ELEVENTY_OUTPUT_DIR || "_site";
const OUTPUT_DIR = path.join(ROOT_DIR, outputBase, "assets", "js");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function bundle() {
  try {
    console.log("Bundling application...\n");

    // 1. Create vendor bundle (Three.js + addons + lil-gui)
    // This will be used via import map
    const vendorEntry = `
      // Re-export Three.js core
      export * from "three";

      // Re-export addons used by the app
      export { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
      export { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
      export { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
      export { RenderPass } from "three/addons/postprocessing/RenderPass.js";
      export { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
      export { BokehPass } from "three/addons/postprocessing/BokehPass.js";
      export { OutputPass } from "three/addons/postprocessing/OutputPass.js";
      export { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";

      // Re-export addons used by @recast-navigation/three
      export { LineMaterial } from "three/addons/lines/LineMaterial.js";
      export { LineSegments2 } from "three/addons/lines/LineSegments2.js";
      export { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

      // Re-export lil-gui
      export { GUI } from "lil-gui";
    `;

    const vendorResult = await esbuild.build({
      stdin: {
        contents: vendorEntry,
        resolveDir: ROOT_DIR,
        loader: "js",
      },
      bundle: true,
      minify: true,
      format: "esm",
      outfile: path.join(OUTPUT_DIR, "vendor.bundle.js"),
      target: ["es2020"],
      metafile: true,
    });

    const vendorSize = vendorResult.metafile.outputs[Object.keys(vendorResult.metafile.outputs)[0]].bytes;
    console.log(`✓ vendor.bundle.js: ${(vendorSize / 1024).toFixed(1)}KB (Three.js + addons + lil-gui)`);

    // 2. Bundle app code (keeps dependencies external for import map)
    const appResult = await esbuild.build({
      entryPoints: [path.join(ROOT_DIR, "assets", "js", "main.js")],
      bundle: true,
      minify: true,
      format: "esm",
      outfile: path.join(OUTPUT_DIR, "app.bundle.js"),
      target: ["es2020"],
      treeShaking: true,
      metafile: true,
      // All these are resolved via import map
      external: [
        "three",
        "three/addons/*",
        "lil-gui",
        "@recast-navigation/*",
      ],
    });

    const appSize = appResult.metafile.outputs[Object.keys(appResult.metafile.outputs)[0]].bytes;
    console.log(`✓ app.bundle.js: ${(appSize / 1024).toFixed(1)}KB (app code only)`);

    console.log(`\nTotal: ${((vendorSize + appSize) / 1024).toFixed(1)}KB`);
    console.log("\n✅ Bundle complete");
  } catch (error) {
    console.error("Bundle failed:", error);
    process.exit(1);
  }
}

bundle();
