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
        rollupOptions: {
          // Externalize modules that are loaded via import maps at runtime
          external: [
            "three",
            /^three\/addons\/.*/,
            /^@recast-navigation\/.*/,
          ],
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
  
  // Copy assets - Vite will process CSS/JS during build
  eleventyConfig.addPassthroughCopy("assets");
  
  // Copy CNAME for GitHub Pages
  eleventyConfig.addPassthroughCopy("CNAME");
  
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

