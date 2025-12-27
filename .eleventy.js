const path = require("path");

module.exports = async function (eleventyConfig) {
  // Import Vite plugin (ESM in CommonJS config)
  const EleventyPluginVite = (await import("@11ty/eleventy-plugin-vite")).default;
  
  // Add Vite plugin with standard configuration
  eleventyConfig.addPlugin(EleventyPluginVite, {
    viteOptions: {
      clearScreen: false,
      appType: "mpa",
      base: "/",
      server: {
        middlewareMode: true,
        fs: {
          allow: [__dirname],
          deny: [".11ty-vite"], // Don't serve from temp folder
        },
      },
      optimizeDeps: {
        // Exclude CDN-loaded modules from pre-bundling (they're loaded via import map)
        exclude: [
          "three",
          "@recast-navigation/core",
          "@recast-navigation/wasm",
          "@recast-navigation/generators",
          "@recast-navigation/three",
        ],
        // Don't scan output directories
        entries: [],
      },
      resolve: {
        // Don't try to resolve CDN modules - they're external
        alias: {
          // This ensures Vite doesn't try to resolve these modules
        },
      },
      build: {
        emptyOutDir: true,
        minify: "esbuild",
        cssMinify: true,
        cssCodeSplit: false, // Single CSS file
        rollupOptions: {
          // Externalize CDN-loaded modules
          external: [
            "three",
            /^three\/addons\/.*/,
            /^@recast-navigation\/.*/,
          ],
          output: {
            assetFileNames: "assets/[ext]/[name].[hash][extname]",
            chunkFileNames: "assets/js/[name].[hash].js",
            entryFileNames: "assets/js/[name].[hash].js",
          },
        },
      },
      plugins: [
        // Mark CDN modules as external (loaded via import map at runtime)
        {
          name: "externalize-cdn-modules",
          enforce: "pre",
          resolveId(id) {
            // Mark CDN modules as external - they're loaded via import map at runtime
            // These should be external in both dev and build modes
            if (id === "three" || id.startsWith("three/") || id.startsWith("@recast-navigation/")) {
              return { id, external: true };
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
  
  // Copy static assets (Vite processes JS/CSS from source, so we only copy non-processed assets)
  eleventyConfig.addPassthroughCopy({
    "assets/img": "assets/img",
    "assets/fonts": "assets/fonts",
    "assets/favicon": "assets/favicon",
    "assets/models": "assets/models",
    "assets/media": "assets/media",
    // Copy JS/CSS for dev mode (Vite processes from source in build)
    "assets/js": "assets/js",
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

