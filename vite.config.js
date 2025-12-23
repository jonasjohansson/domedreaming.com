import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Optimize images with high quality settings using Sharp
// Only optimizes if source is newer than destination
// Returns true if optimized, false if skipped
async function optimizeImage(srcPath, destPath) {
  const ext = extname(srcPath).toLowerCase();

  try {
    mkdirSync(dirname(destPath), { recursive: true });

    // Check if destination exists and if source is newer
    if (existsSync(destPath)) {
      try {
        const srcStats = statSync(srcPath);
        const destStats = statSync(destPath);
        // If source is not newer, skip optimization
        // Use getTime() for accurate comparison (milliseconds)
        const srcTime = srcStats.mtime.getTime();
        const destTime = destStats.mtime.getTime();
        // Add 1000ms buffer to account for file system timestamp precision
        if (srcTime <= destTime + 1000) {
          return false; // Already optimized and up to date
        }
      } catch (statError) {
        // If we can't read stats, proceed with optimization
        // This shouldn't happen normally, but handle gracefully
      }
    }

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
      if (!existsSync(destPath)) {
        copyFileSync(srcPath, destPath);
        return true;
      }
      const srcStats = statSync(srcPath);
      const destStats = statSync(destPath);
      if (srcStats.mtime.getTime() > destStats.mtime.getTime()) {
        copyFileSync(srcPath, destPath);
        return true;
      }
      return false; // Already up to date
    } else if (ext === ".gif") {
      // GIF files - copy as-is (Sharp can optimize but might lose animation)
      if (!existsSync(destPath)) {
        copyFileSync(srcPath, destPath);
        return true;
      }
      const srcStats = statSync(srcPath);
      const destStats = statSync(destPath);
      if (srcStats.mtime.getTime() > destStats.mtime.getTime()) {
        copyFileSync(srcPath, destPath);
        return true;
      }
      return false; // Already up to date
    } else {
      // Copy other image formats as-is
      if (!existsSync(destPath)) {
        copyFileSync(srcPath, destPath);
        return true;
      }
      const srcStats = statSync(srcPath);
      const destStats = statSync(destPath);
      if (srcStats.mtime.getTime() > destStats.mtime.getTime()) {
        copyFileSync(srcPath, destPath);
        return true;
      }
      return false; // Already up to date
    }
    return true; // Image was optimized
  } catch (e) {
    console.warn(`Could not optimize ${srcPath}, copying as-is:`, e.message);
    copyFileSync(srcPath, destPath);
    return true; // Consider it processed even if it failed
  }
}

// Plugin to copy and optimize static assets
function copyStaticAssets() {
  return {
    name: "copy-static-assets",
    async closeBundle() {
      // Copy fonts, models, and favicon as-is (no optimization needed)
      const copyAsIs = [
        { src: "assets/fonts", dest: "docs/assets/fonts" },
        { src: "assets/models", dest: "docs/assets/models" },
        { src: "assets/js/libs", dest: "docs/assets/js/libs" },
        { src: "assets/favicon", dest: "docs/assets/favicon" },
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

      // Extract image paths from HTML
      function extractImagePaths() {
        const htmlPath = join(__dirname, "index.html");
        const htmlContent = readFileSync(htmlPath, "utf-8");
        const imagePaths = new Set();

        // Match src="assets/img/..." and src="assets/media/..."
        const imgRegex = /src=["'](assets\/(?:img|media)\/[^"']+)["']/g;
        let match;
        while ((match = imgRegex.exec(htmlContent)) !== null) {
          imagePaths.add(match[1]);
        }

        // Also check CSS files for background images
        const cssPath = join(__dirname, "assets/css/main.css");
        if (existsSync(cssPath)) {
          const cssContent = readFileSync(cssPath, "utf-8");
          const bgImgRegex = /url\(["']?([^"')]+\.(?:jpg|jpeg|png|gif|webp|svg))["']?\)/gi;
          while ((match = bgImgRegex.exec(cssContent)) !== null) {
            const path = match[1];
            if (path.startsWith("assets/")) {
              imagePaths.add(path);
            }
          }
        }

        return Array.from(imagePaths);
      }

      // Optimize images (only if changed and referenced in HTML/CSS)
      console.log("Extracting referenced images from HTML/CSS...");
      const referencedImages = extractImagePaths();
      console.log(`Found ${referencedImages.length} referenced image(s)`);

      // Define cleanup function now that referencedImages is available
      function cleanUnreferencedImages() {
        const imageDirs = [{ dest: "docs/assets/img" }, { dest: "docs/assets/media" }];

        function cleanDir(dirPath) {
          if (!existsSync(dirPath)) return;

          try {
            const entries = readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
              const entryPath = join(dirPath, entry.name);

              if (entry.isDirectory()) {
                cleanDir(entryPath);
                // Remove empty directories after cleaning (including Links folder)
                try {
                  const subEntries = readdirSync(entryPath);
                  if (subEntries.length === 0) {
                    const fs = require("fs");
                    fs.rmdirSync(entryPath);
                  }
                } catch (e) {
                  // Ignore errors
                }
              } else {
                // Check if this file is in the referenced images list
                // entryPath is like "/path/to/docs/assets/img/TinyMassive.jpg" or "/path/to/docs/assets/img/Links/TinyMassive.jpg"
                // We need to convert it to "assets/img/TinyMassive.jpg" format (flattened)
                const relativePath = entryPath.replace(join(__dirname, "docs/"), "").replace(/\\/g, "/");

                // Check if it matches any referenced image path (flattened)
                const isReferenced = referencedImages.some((ref) => {
                  const normalizedRef = ref
                    .replace(/\\/g, "/")
                    .replace(/\/Links\//, "/")
                    .replace(/Links\//, "");
                  // Exact match (both flattened)
                  return relativePath === normalizedRef;
                });

                if (!isReferenced) {
                  // Remove unreferenced file
                  try {
                    const fs = require("fs");
                    fs.unlinkSync(entryPath);
                    console.log(`Removed unreferenced: ${relativePath}`);
                  } catch (e) {
                    // Ignore errors
                  }
                }
              }
            }
          } catch (e) {
            // Ignore errors
          }
        }

        imageDirs.forEach(({ dest }) => {
          cleanDir(join(__dirname, dest));
        });

        // Remove Links folder if it exists (we're flattening the structure)
        const linksFolder = join(__dirname, "docs/assets/img/Links");
        if (existsSync(linksFolder)) {
          try {
            const fs = require("fs");
            const entries = readdirSync(linksFolder);
            if (entries.length === 0) {
              fs.rmdirSync(linksFolder);
            } else {
              // Remove all files in Links folder (they should be in root now)
              for (const entry of entries) {
                const entryPath = join(linksFolder, entry);
                try {
                  if (statSync(entryPath).isFile()) {
                    fs.unlinkSync(entryPath);
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              // Try to remove the folder again
              try {
                fs.rmdirSync(linksFolder);
              } catch (e) {
                // Ignore if not empty
              }
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }

      // Clean unreferenced images
      cleanUnreferencedImages();

      // Process only referenced images
      async function processReferencedImages() {
        let optimized = 0;
        let skipped = 0;

        for (const imagePath of referencedImages) {
          // imagePath is like "assets/img/Links/TinyMassive.jpg"
          // Flatten structure: remove "Links/" subdirectory
          const srcPath = join(__dirname, imagePath);
          const flattenedPath = imagePath.replace(/\/Links\//, "/").replace(/Links\//, "");
          const destPath = join(__dirname, "docs", flattenedPath);

          if (!existsSync(srcPath)) {
            console.warn(`Referenced image not found: ${imagePath}`);
            continue;
          }

          // Ensure destination directory exists
          mkdirSync(dirname(destPath), { recursive: true });

          const ext = extname(imagePath).toLowerCase();
          if ([".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif"].includes(ext)) {
            const wasOptimized = await optimizeImage(srcPath, destPath);
            if (wasOptimized) {
              optimized++;
            } else {
              skipped++;
            }
          } else {
            // Copy non-image files as-is (PDFs, etc.) - only if changed
            if (!existsSync(destPath)) {
              copyFileSync(srcPath, destPath);
            } else {
              const srcStats = statSync(srcPath);
              const destStats = statSync(destPath);
              if (srcStats.mtime > destStats.mtime) {
                copyFileSync(srcPath, destPath);
              }
            }
          }
        }

        return { optimized, skipped };
      }

      const { optimized: optimizedCount, skipped: skippedCount } = await processReferencedImages();

      // Remove Links folder completely (we're flattening the structure)
      const linksFolder = join(__dirname, "docs/assets/img/Links");
      if (existsSync(linksFolder)) {
        try {
          const fs = require("fs");
          // Remove all files and subdirectories in Links folder
          const entries = readdirSync(linksFolder, { withFileTypes: true });
          for (const entry of entries) {
            const entryPath = join(linksFolder, entry.name);
            try {
              if (entry.isDirectory()) {
                fs.rmSync(entryPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(entryPath);
              }
            } catch (e) {
              // Ignore errors
            }
          }
          // Remove the Links folder itself
          try {
            fs.rmdirSync(linksFolder);
            console.log("Removed Links folder (structure flattened)");
          } catch (e) {
            // If it's not empty, try recursive removal
            try {
              fs.rmSync(linksFolder, { recursive: true, force: true });
              console.log("Removed Links folder (structure flattened)");
            } catch (e2) {
              // Ignore errors
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }

      if (optimizedCount > 0) {
        console.log(`Image optimization complete! Optimized ${optimizedCount} image(s), skipped ${skippedCount} (already up to date).`);
      } else {
        console.log(`Image optimization complete! All images up to date (skipped ${skippedCount}).`);
      }
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
  // Use relative paths for assets (works from any subdirectory)
  base: "./",
  optimizeDeps: {
    exclude: ["@recast-navigation/core", "@recast-navigation/wasm", "@recast-navigation/generators", "@recast-navigation/three"],
  },
  // Disable caching for development
  server: {
    port: 3000,
    open: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  },
  build: {
    outDir: "docs",
    emptyOutDir: false, // Don't empty - we'll handle cleanup manually for images
    // Increase chunk size warning limit (Three.js is large)
    chunkSizeWarningLimit: 1000,
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
        // Manual chunks for better code splitting
        manualChunks: (id) => {
          // Split three.js into its own chunk
          if (id.includes("three.module.js") || id.includes("three.core.js")) {
            return "three";
          }
          // Split three.js addons into separate chunk
          if (id.includes("three/addons") || id.includes("postprocessing") || id.includes("shaders") || id.includes("GLTFLoader")) {
            return "three-addons";
          }
          // Split 3D related code
          if (id.includes("/3d/")) {
            return "3d";
          }
          // Split dashboard into separate chunk
          if (id.includes("dashboard.js")) {
            return "dashboard";
          }
        },
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
  plugins: [
    resolveThreeImports(),
    copyStaticAssets(),
    // Plugin to flatten image paths in HTML (remove Links/ subdirectory)
    {
      name: "flatten-image-paths",
      transformIndexHtml(html) {
        // Remove /Links/ from image paths in HTML
        return html.replace(/src=["']assets\/img\/Links\/([^"']+)["']/g, 'src="assets/img/$1"');
      },
      async writeBundle() {
        // Also update the built HTML file
        const htmlPath = join(__dirname, "docs", "index.html");
        if (existsSync(htmlPath)) {
          let htmlContent = readFileSync(htmlPath, "utf-8");
          htmlContent = htmlContent.replace(/src=["']assets\/img\/Links\/([^"']+)["']/g, 'src="assets/img/$1"');
          writeFileSync(htmlPath, htmlContent, "utf-8");
        }
      },
    },
  ],
});
