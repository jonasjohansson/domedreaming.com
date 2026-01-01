const htmlmin = require('html-minifier-next');

module.exports = function (eleventyConfig) {
  // Use gitignore to avoid processing ignored files (performance optimization)
  eleventyConfig.setUseGitIgnore(true);
  
  // HTML minification
  eleventyConfig.addTransform('htmlmin', async function(content) {
    if (this.page.outputPath && this.page.outputPath.endsWith('.html')) {
      let minified = await htmlmin.minify(content, {
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
        decodeEntities: true,
        minifyCSS: true,        // Minify inline CSS
        minifyJS: true,         // Minify inline JS
        preventAttributesEscaping: true,
        removeComments: true,
        removeOptionalTags: true,
        removeRedundantAttributes: true,
      });
      return minified;
    }
    return content;
  });

  // Ignore the old index.html since we're using index.njk
  eleventyConfig.ignores.add("index.html");
  
  // Ignore README files
  eleventyConfig.ignores.add("**/README.md");

  // Ignore source files that shouldn't be in output
  eleventyConfig.ignores.add("assets/background.ai");
  eleventyConfig.ignores.add("assets/models/*.blend");
  
  // Copy all static assets including JS/CSS
  // Note: .blend and .ai source files are excluded via .eleventyignore
  eleventyConfig.addPassthroughCopy({
    "assets/img": "assets/img",
    "assets/fonts": "assets/fonts",
    "assets/favicon": "assets/favicon",
    "assets/models": "assets/models",
    "assets/media": "assets/media",
    "assets/js": "assets/js",
    "assets/css": "assets/css",
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
    markdownTemplateEngine: "njk",
    // Performance optimizations
    dataTemplateEngine: false, // Don't process data files as templates (faster)
  };
};

