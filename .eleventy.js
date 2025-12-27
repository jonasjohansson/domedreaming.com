module.exports = function (eleventyConfig) {
  // Use gitignore to avoid processing ignored files (performance optimization)
  eleventyConfig.setUseGitIgnore(true);

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

