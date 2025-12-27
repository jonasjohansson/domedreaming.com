const fs = require('fs');
const path = require('path');

// Simple CSS minifier (removes comments, whitespace, etc.)
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\s*{\s*/g, '{') // Remove spaces around {
    .replace(/\s*}\s*/g, '}') // Remove spaces around }
    .replace(/\s*:\s*/g, ':') // Remove spaces around :
    .replace(/\s*;\s*/g, ';') // Remove spaces around ;
    .replace(/\s*,\s*/g, ',') // Remove spaces around ,
    .replace(/\s*>\s*/g, '>') // Remove spaces around >
    .replace(/\s*\+\s*/g, '+') // Remove spaces around +
    .replace(/\s*~\s*/g, '~') // Remove spaces around ~
    .replace(/;\s*}/g, '}') // Remove semicolon before }
    .trim();
}

// Resolve @import statements and combine CSS files
function combineCSS(filePath, baseDir) {
  let css = fs.readFileSync(filePath, 'utf8');
  
  // Replace @import statements with actual file contents
  css = css.replace(/@import\s+["']([^"']+)["'];/g, (match, importPath) => {
    const importFile = path.resolve(path.dirname(filePath), importPath);
    if (fs.existsSync(importFile)) {
      return combineCSS(importFile, baseDir);
    }
    return ''; // Remove import if file doesn't exist
  });
  
  return css;
}

const docsPath = path.join(__dirname, '../docs/assets/css');
const sourcePath = path.join(__dirname, '../assets/css');

// Process main.css - combine imports and minify
const mainCssPath = path.join(docsPath, 'main.css');
if (fs.existsSync(mainCssPath)) {
  // Read from source to get imports, then combine
  const sourceMainPath = path.join(sourcePath, 'main.css');
  if (fs.existsSync(sourceMainPath)) {
    const combined = combineCSS(sourceMainPath, sourcePath);
    const minified = minifyCSS(combined);
    fs.writeFileSync(mainCssPath, minified, 'utf8');
    console.log(`Minified main.css`);
  }
}

// Minify shader.css
const shaderCssPath = path.join(docsPath, 'shader.css');
if (fs.existsSync(shaderCssPath)) {
  const css = fs.readFileSync(shaderCssPath, 'utf8');
  const minified = minifyCSS(css);
  fs.writeFileSync(shaderCssPath, minified, 'utf8');
  console.log(`Minified shader.css`);
}
