import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { join, resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Optimize images with high quality settings using Sharp
async function optimizeImage(srcPath, destPath) {
  const ext = extname(srcPath).toLowerCase();

  try {
    mkdirSync(dirname(destPath), { recursive: true });

    if (ext === ".jpg" || ext === ".jpeg") {
      await sharp(srcPath)
        .jpeg({
          quality: 92, // High quality (90-95 is excellent)
          progressive: true,
          mozjpeg: true, // Use mozjpeg for better compression
        })
        .toFile(destPath);
    } else if (ext === ".png") {
      await sharp(srcPath)
        .png({
          quality: 90, // High quality
          compressionLevel: 9, // Maximum compression
          adaptiveFiltering: true,
        })
        .toFile(destPath);
    } else if (ext === ".webp") {
      await sharp(srcPath)
        .webp({
          quality: 92, // High quality
          effort: 6, // Higher effort = better compression (0-6)
        })
        .toFile(destPath);
    } else if (ext === ".svg") {
      // For SVG, just copy (can add SVGO optimization later if needed)
      copyFileSync(srcPath, destPath);
    } else if (ext === ".gif") {
      // GIF files - copy as-is (Sharp can optimize but might lose animation)
      copyFileSync(srcPath, destPath);
    } else {
      // Copy other image formats as-is
      copyFileSync(srcPath, destPath);
    }
  } catch (e) {
    console.warn(`Could not optimize ${srcPath}, copying as-is:`, e.message);
    copyFileSync(srcPath, destPath);
  }
}

// Plugin to copy and optimize static assets
function copyStaticAssets() {
  return {
    name: "copy-static-assets",
    async closeBundle() {
      // Copy fonts and models as-is (no optimization needed)
      const copyAsIs = [
        { src: "assets/fonts", dest: "dist/assets/fonts" },
        { src: "assets/models", dest: "dist/assets/models" },
        { src: "assets/js/libs", dest: "dist/assets/js/libs" },
      ];

      function copyDir(src, dest) {
        try {
          mkdirSync(dest, { recursive: true });
          const entries = readdirSync(src, { withFileTypes: true });

          for (const entry of entries) {
            const srcPath = join(src, entry.name);
            const destPath = join(dest, entry.name);

            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              copyFileSync(srcPath, destPath);
            }
          }
        } catch (e) {
          console.warn(`Could not copy ${src}:`, e.message);
        }
      }

      // Copy non-image assets
      copyAsIs.forEach(({ src, dest }) => {
        copyDir(src, dest);
      });

      // Optimize images
      console.log("Optimizing images...");
      const imageDirs = [
        { src: "assets/img", dest: "dist/assets/img" },
        { src: "assets/media", dest: "dist/assets/media" },
      ];

      async function processImageDir(src, dest) {
        try {
          mkdirSync(dest, { recursive: true });
          const entries = readdirSync(src, { withFileTypes: true });

          for (const entry of entries) {
            const srcPath = join(src, entry.name);
            const destPath = join(dest, entry.name);

            if (entry.isDirectory()) {
              await processImageDir(srcPath, destPath);
            } else {
              const ext = extname(entry.name).toLowerCase();
              if ([".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"].includes(ext)) {
                await optimizeImage(srcPath, destPath);
              } else {
                // Copy non-image files as-is (PDFs, etc.)
                copyFileSync(srcPath, destPath);
              }
            }
          }
        } catch (e) {
          console.warn(`Could not process ${src}:`, e.message);
        }
      }

      for (const { src, dest } of imageDirs) {
        await processImageDir(src, dest);
      }
      console.log("Image optimization complete!");
    },
  };
}

// Plugin to resolve three.js imports correctly and handle external CDN packages
function resolveThreeImports() {
  return {
    name: "resolve-three-imports",
    resolveId(id, importer) {
      // Handle CDN packages - resolve to CDN URLs
      // In dev mode, Vite will fetch from CDN; in build mode, they're external
      if (id.startsWith("@recast-navigation/")) {
        const cdnMap = {
          "@recast-navigation/core": "https://unpkg.com/@recast-navigation/core@0.38.0/dist/index.mjs",
          "@recast-navigation/wasm": "https://unpkg.com/@recast-navigation/wasm@0.38.0/dist/recast-navigation.wasm-compat.js",
          "@recast-navigation/generators": "https://unpkg.com/@recast-navigation/generators@0.38.0/dist/index.mjs",
          "@recast-navigation/three": "https://unpkg.com/@recast-navigation/three@0.38.0/dist/index.mjs",
        };
        if (cdnMap[id]) {
          // Return the CDN URL - Vite will handle it
          return cdnMap[id];
        }
      }

      // Handle three/addons/* imports
      if (id.startsWith("three/addons/postprocessing/")) {
        const file = id.replace("three/addons/postprocessing/", "");
        return resolve(__dirname, "assets/js/libs/three/postprocessing", file);
      }
      if (id.startsWith("three/addons/shaders/")) {
        const file = id.replace("three/addons/shaders/", "");
        return resolve(__dirname, "assets/js/libs/three/shaders", file);
      }
      if (id.startsWith("three/addons/loaders/")) {
        const file = id.replace("three/addons/loaders/", "");
        return resolve(__dirname, "assets/js/libs/three", file);
      }
      if (id.startsWith("three/addons/utils/")) {
        const file = id.replace("three/addons/utils/", "");
        return resolve(__dirname, "assets/js/libs/utils", file);
      }
      // Handle base three import
      if (id === "three") {
        return resolve(__dirname, "assets/js/libs/three/three.module.js");
      }
      return null;
    },
  };
}

export default defineConfig({
  root: ".",
  optimizeDeps: {
    exclude: ["@recast-navigation/core", "@recast-navigation/wasm", "@recast-navigation/generators", "@recast-navigation/three"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Minify JavaScript
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
    },
    // Minify CSS
    cssMinify: true,
    rollupOptions: {
      // Externalize CDN packages (handled by import map in HTML)
      external: ["@recast-navigation/core", "@recast-navigation/wasm", "@recast-navigation/generators", "@recast-navigation/three"],
      output: {
        // Clean, organized file naming
        entryFileNames: "assets/js/[name]-[hash].js",
        chunkFileNames: "assets/js/chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "asset";

          // CSS files - organized in css folder with hash
          if (name.endsWith(".css")) {
            return "assets/css/[name]-[hash][extname]";
          }

          // Font files - keep in fonts folder
          if (/\.(woff|woff2|ttf|eot|otf)$/.test(name)) {
            return "assets/fonts/[name][extname]";
          }

          // Images - organized in img folder (will be optimized)
          if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/.test(name)) {
            // Preserve subdirectory structure for images
            const pathParts = name.split("/");
            if (pathParts.length > 1 && pathParts[0] === "img") {
              return `assets/img/${pathParts.slice(1).join("/")}`;
            }
            return `assets/img/[name][extname]`;
          }

          // Other assets
          return "assets/[name][extname]";
        },
      },
    },
  },
  plugins: [resolveThreeImports(), copyStaticAssets()],
  server: {
    port: 3000,
    open: true,
  },
});
