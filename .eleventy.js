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
      server: {
        middlewareMode: true,
        fs: {
          // Don't serve files from docs directory - it's the output directory
          deny: ["**/docs/**"],
        },
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
      },
      // Set root to current directory so Vite resolves paths correctly
      root: __dirname,
      build: {
        emptyOutDir: true,
        minify: "esbuild", // Minify JS (esbuild is built-in, no extra dependency)
        cssMinify: true, // Minify CSS
        cssCodeSplit: false, // Combine all CSS into a single file
        // Optimize asset handling
        assetsInlineLimit: 4096, // Inline assets smaller than 4kb
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
        // Plugin to mark three and recast-navigation as external (loaded via import maps from CDN)
        {
          name: "externalize-import-map-modules",
          resolveId(id, importer) {
            // Skip processing files in the output directory (docs)
            if (importer && (importer.includes("/docs/") || importer.includes("\\docs\\"))) {
              // Mark all external modules as external when importing from docs
              if (id === "three" || id.startsWith("three/") || id.startsWith("@recast-navigation/")) {
                return { id, external: true };
              }
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
            // Don't process files in the docs directory - they're already built
            if (id.includes("/docs/") || id.includes("\\docs\\")) {
              return null;
            }
          },
        },
      ],
    },
  });

  // Ignore the old index.html since we're using index.njk
  eleventyConfig.ignores.add("index.html");
  
  // Ignore README files in node_modules and library directories
  eleventyConfig.ignores.add("**/README.md");
  eleventyConfig.ignores.add("assets/js/libs/**/README.md");
  
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

  return {
    dir: {
      input: ".",
      output: "docs",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};

