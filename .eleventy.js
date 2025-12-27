const path = require("path");

module.exports = async function (eleventyConfig) {
  // Import Vite plugin (ESM in CommonJS config)
  const EleventyPluginVite = (await import("@11ty/eleventy-plugin-vite")).default;
  
  // Add Vite plugin
  eleventyConfig.addPlugin(EleventyPluginVite, {
    tempFolderName: ".11ty-vite",
    viteOptions: {
      clearScreen: false,
      appType: "mpa",
      base: "/", // Base path for assets
      server: {
        middlewareMode: true,
        fs: {
          // Allow serving from project root (includes docs directory)
          allow: [__dirname],
        },
        // Don't pre-transform files in docs directory
        hmr: {
          overlay: false, // Disable error overlay for these warnings
        },
      },
      // Don't pre-transform files in docs
      ssr: {
        noExternal: [], // Don't externalize anything for SSR (we're not using SSR)
      },
      optimizeDeps: {
        // Exclude modules that are loaded via import maps from CDN
        exclude: [
          "three",
          "@recast-navigation/core",
          "@recast-navigation/wasm",
          "@recast-navigation/generators",
          "@recast-navigation/three",
        ],
        entries: [], // Don't scan dependencies from the output directory
        // Don't scan the docs directory
        include: [],
      },
      // Set root to current directory so Vite resolves paths correctly
      root: __dirname,
      build: {
        emptyOutDir: true, // Clear directory before build
        minify: "esbuild", // Minify JS (esbuild is built-in, no extra dependency)
        cssMinify: true, // Minify CSS
        cssCodeSplit: false, // Combine all CSS into a single file
        // Optimize asset handling
        assetsInlineLimit: 0, // Don't inline CSS - let Vite process @imports properly
        rollupOptions: {
          // Externalize modules that are loaded via import maps at runtime
          external: [
            "three",
            /^three\/addons\/.*/,
            /^@recast-navigation\/.*/,
          ],
          output: {
            // Better chunking strategy
            manualChunks: undefined, // Let Vite handle chunking automatically
            assetFileNames: "assets/[ext]/[name].[hash][extname]",
            chunkFileNames: "assets/js/[name].[hash].js",
            entryFileNames: "assets/js/[name].[hash].js",
          },
        },
      },
      plugins: [
        // Plugin to skip processing files in docs and mark external modules
        {
          name: "skip-docs-and-externalize",
          enforce: "pre", // Run before other plugins
          resolveId(id, importer) {
            // Allow CSS files to be processed even if they're in docs/_site (for @import resolution)
            if (id.endsWith('.css')) {
              // Resolve CSS imports relative to the source location
              if (id.startsWith('./') && importer) {
                // This is a relative CSS import - let Vite resolve it
                return null; // Let Vite handle the resolution
              }
            }
            
            // If the file itself is in docs or _site, don't process it (except CSS)
            if ((id.includes("/docs/") || id.includes("\\docs\\") || id.includes("/_site/") || id.includes("\\_site\\")) && !id.endsWith('.css')) {
              return { id, external: true };
            }
            // Skip processing files in the output directory (docs or _site) - mark all imports as external
            // BUT allow CSS files to be processed
            if (importer && ((importer.includes("/docs/") || importer.includes("\\docs\\")) || (importer.includes("/_site/") || importer.includes("\\_site\\"))) && !id.endsWith('.css')) {
              // For any import from docs or _site, mark as external so Vite doesn't process
              return { id, external: true };
            }
            // Mark three and three/addons as external (loaded from CDN)
            if (id === "three" || id.startsWith("three/")) {
              return { id, external: true };
            }
            // Mark recast-navigation modules as external (loaded from CDN)
            if (id.startsWith("@recast-navigation/")) {
              return { id, external: true };
            }
          },
          load(id) {
            // Don't process files in the docs or _site directories - they're already built
            // BUT allow CSS files to be processed so @import statements are resolved
            if ((id.includes("/docs/") || id.includes("\\docs\\") || id.includes("/_site/") || id.includes("\\_site\\")) && !id.endsWith('.css')) {
              return null;
            }
          },
        },
      ],
    },
  });

  // Ignore the old index.html since we're using index.njk
  eleventyConfig.ignores.add("index.html");
  
  // Ignore README files
  eleventyConfig.ignores.add("**/README.md");
  
  // Copy static assets that Vite doesn't process
  // In dev mode, Vite needs source files; in build mode, Vite processes them
  // So we copy everything, but Vite will handle CSS/JS processing
  eleventyConfig.addPassthroughCopy({
    "assets/img": "assets/img",
    "assets/fonts": "assets/fonts",
    "assets/favicon": "assets/favicon",
    "assets/models": "assets/models",
    "assets/media": "assets/media",
    // Copy JS source files for dev mode (Vite processes them)
    "assets/js": "assets/js",
    // Copy CSS source files for dev mode (Vite processes them)
    "assets/css": "assets/css"
  });
  
  // Copy other root files
  eleventyConfig.addPassthroughCopy("*.pdf");
  eleventyConfig.addPassthroughCopy("CNAME");

  // Use different output directories for dev vs build
  // Default to _site for dev, use docs for production builds
  const outputDir = process.env.ELEVENTY_OUTPUT_DIR || "_site";

  return {
    dir: {
      input: ".",
      output: outputDir,
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};

