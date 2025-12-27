module.exports = function (eleventyConfig) {
  // Ignore the old index.html since we're using index.njk
  eleventyConfig.ignores.add("index.html");
  
  // Ignore README files
  eleventyConfig.ignores.add("**/README.md");
  
  // Copy all static assets including JS/CSS
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
    markdownTemplateEngine: "njk"
  };
};

