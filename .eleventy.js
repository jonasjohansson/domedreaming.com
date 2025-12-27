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
      },
      optimizeDeps: {
        // Exclude modules that are loaded via import maps
        exclude: [
          "three",
          "@recast-navigation/core",
          "@recast-navigation/wasm",
          "@recast-navigation/generators",
          "@recast-navigation/three",
        ],
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
      resolve: {
        alias: [
          // Use array format to ensure order - more specific first
          {
            find: /^three\/addons\/postprocessing\/(.*)$/,
            replacement: path.resolve(__dirname, "assets/js/libs/three/addons/postprocessing/$1"),
          },
          {
            find: /^three\/addons\/shaders\/(.*)$/,
            replacement: path.resolve(__dirname, "assets/js/libs/three/addons/shaders/$1"),
          },
          {
            find: /^three\/addons\/lines\/(.*)$/,
            replacement: path.resolve(__dirname, "assets/js/libs/three/addons/lines/$1"),
          },
          {
            find: /^three\/addons\/utils\/(.*)$/,
            replacement: path.resolve(__dirname, "assets/js/libs/utils/$1"),
          },
          {
            find: "three/addons/loaders/GLTFLoader.js",
            replacement: path.resolve(__dirname, "assets/js/libs/three/GLTFLoader.js"),
          },
          {
            find: "three/addons/loaders/DRACOLoader.js",
            replacement: path.resolve(__dirname, "assets/js/libs/three/loaders/DRACOLoader.js"),
          },
          {
            find: /^three\/addons\/(.*)$/,
            replacement: path.resolve(__dirname, "assets/js/libs/three/addons/$1"),
          },
          {
            find: /^three$/,
            replacement: path.resolve(__dirname, "assets/js/libs/three/three.module.js"),
          },
          {
            find: "@recast-navigation/core",
            replacement: path.resolve(__dirname, "assets/js/libs/recast-navigation/core/index.mjs"),
          },
          {
            find: "@recast-navigation/wasm",
            replacement: path.resolve(__dirname, "assets/js/libs/recast-navigation/core/recast-navigation.wasm-compat.js"),
          },
          {
            find: "@recast-navigation/generators",
            replacement: path.resolve(__dirname, "assets/js/libs/recast-navigation/generators/index.mjs"),
          },
          {
            find: "@recast-navigation/three",
            replacement: path.resolve(__dirname, "assets/js/libs/recast-navigation/three/index.mjs"),
          },
        ],
      },
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

