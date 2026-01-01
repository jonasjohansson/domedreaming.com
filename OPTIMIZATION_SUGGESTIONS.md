# Optimization Suggestions for Dome Dreaming

## Production Pipeline

### 1. CSS Minification
**Current**: CSS files are not minified
**Suggestion**: Add CSS minification to build process

```javascript
// scripts/minify-css.js
const fs = require('fs');
const path = require('path');
const cssnano = require('cssnano');
const postcss = require('postcss');

// Minify all CSS files in docs/assets/css
```

**Benefits**: Reduces CSS file size by 20-30%

### 2. Image Optimization Pipeline
**Current**: Images are copied as-is
**Suggestion**: Add image optimization step

```bash
# Add to package.json
"build:images": "imagemin assets/img/**/*.{jpg,png} --out-dir=docs/assets/img --plugin=imagemin-mozjpeg --plugin=imagemin-pngquant"
```

**Benefits**: Significant file size reduction (6,482 KiB potential savings per Lighthouse)

### 3. Build Script Improvements
**Current**: Sequential execution
**Suggestion**: Parallelize where possible

```json
{
  "scripts": {
    "build": "npm run build:eleventy && npm run build:assets",
    "build:eleventy": "ELEVENTY_OUTPUT_DIR=docs eleventy",
    "build:assets": "npm run build:js & npm run build:css & npm run build:images",
    "build:js": "node scripts/minify-js.js",
    "build:css": "node scripts/minify-css.js",
    "build:images": "node scripts/optimize-images.js"
  }
}
```

### 4. Source Maps for Production Debugging
**Suggestion**: Generate source maps for minified JS (optional, for debugging)

```javascript
// In minify-js.js
const result = await minify(code, {
  sourceMap: {
    filename: file,
    url: file + '.map'
  },
  // ... other options
});
```

## Code Structure

### 5. TypeScript or JSDoc
**Current**: Plain JavaScript
**Suggestion**: Add JSDoc comments for better IDE support and documentation

```javascript
/**
 * Loads and applies a texture to the 3D screen
 * @param {THREE.Texture} texture - The texture to apply
 * @param {THREE.Mesh} screenObject - The screen mesh object
 * @returns {Promise<void>}
 */
export async function applyTextureToScreen(texture, screenObject) {
  // ...
}
```

### 6. Environment Variables
**Suggestion**: Use environment variables for configuration

```javascript
// .env.example
NODE_ENV=production
ELEVENTY_OUTPUT_DIR=docs
ENABLE_SOURCE_MAPS=false
```

### 7. Error Handling Improvements
**Current**: Some console.error/warn statements
**Suggestion**: Centralized error handling

```javascript
// assets/js/core/error-handler.js
export function handleError(error, context) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }
  // Could send to error tracking service in production
}
```

### 8. Constants File
**Suggestion**: Extract magic numbers and strings

```javascript
// assets/js/core/constants.js
export const CONFIG = {
  CAMERA_SAVE_INTERVAL: 2000,
  GRID_COLUMNS: 16,
  GRID_ROWS: 16,
  MOBILE_BREAKPOINT: 768,
  LANDSCAPE_BREAKPOINT: 1024
};
```

## Performance

### 9. CSS Critical Path
**Suggestion**: Extract critical CSS for above-the-fold content

```javascript
// scripts/extract-critical-css.js
// Use penthouse or critical CSS extractor
```

### 10. Lazy Load Non-Critical CSS
**Current**: All CSS loaded synchronously
**Suggestion**: Load non-critical CSS asynchronously

```html
<link rel="preload" href="assets/css/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="assets/css/main.css"></noscript>
```

### 11. Service Worker for Caching
**Suggestion**: Add service worker for offline support and caching

```javascript
// sw.js - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/assets/css/main.css',
        '/assets/js/main.js',
        // ... other critical assets
      ]);
    })
  );
});
```

### 12. Bundle Analysis
**Suggestion**: Add bundle size analysis

```bash
npm install --save-dev webpack-bundle-analyzer
# Or use source-map-explorer for ES modules
```

## Developer Experience

### 13. Pre-commit Hooks
**Suggestion**: Add Husky + lint-staged

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,css}": ["prettier --write", "git add"]
  }
}
```

### 14. ESLint Configuration
**Suggestion**: Add ESLint for code quality

```json
{
  "extends": ["eslint:recommended"],
  "env": {
    "browser": true,
    "es2021": true
  },
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  }
}
```

### 15. Prettier Configuration
**Suggestion**: Consistent code formatting

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

## Code Quality

### 16. Remove Unused CSS
**Suggestion**: Use PurgeCSS to remove unused CSS

```javascript
// .eleventy.js
const purgecss = require('@fullhuman/postcss-purgecss');
// Configure to scan .njk files
```

### 17. CSS Custom Properties Optimization
**Current**: Many CSS variables
**Suggestion**: Audit and consolidate similar variables

### 18. Module Organization
**Suggestion**: Consider barrel exports for cleaner imports

```javascript
// assets/js/3d/index.js
export { scene, camera, renderer } from './scene.js';
export { setupLighting } from './lighting.js';
// ... etc
```

Then: `import { scene, camera, setupLighting } from './3d/index.js';`

## Testing & Quality Assurance

### 19. Visual Regression Testing
**Suggestion**: Add Percy or Chromatic for visual testing

### 20. Lighthouse CI
**Suggestion**: Automate Lighthouse checks in CI/CD

```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun
```

## Documentation

### 21. README Improvements
**Suggestion**: Add comprehensive README with:
- Setup instructions
- Build process
- Architecture overview
- Deployment guide

### 22. Code Comments
**Suggestion**: Add more inline comments for complex logic (especially 3D rendering)

## Security

### 23. Content Security Policy
**Suggestion**: Add CSP headers

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; ...">
```

### 24. Dependency Auditing
**Suggestion**: Regular security audits

```bash
npm audit
npm audit fix
```

## Monitoring

### 25. Analytics & Error Tracking
**Suggestion**: Add error tracking (Sentry) and analytics

```javascript
// Only in production
if (process.env.NODE_ENV === 'production') {
  // Initialize Sentry
}
```

## Quick Wins (High Priority)

1. ✅ **CSS Minification** - Easy to implement, immediate benefit
2. ✅ **Image Optimization** - Huge file size savings
3. ✅ **Remove console statements in production** - Already done via minify
4. ✅ **Bundle unused file cleanup** - Already implemented
5. ⚠️ **CSS Critical Path** - Medium effort, good performance gain
6. ⚠️ **Service Worker** - Medium effort, great UX improvement

## Medium Priority

7. **TypeScript/JSDoc** - Better developer experience
8. **ESLint/Prettier** - Code quality and consistency
9. **Environment variables** - Better configuration management
10. **Error handling** - Better debugging and monitoring

## Lower Priority (Nice to Have)

11. **Service Worker** - Offline support
12. **Visual regression testing** - Quality assurance
13. **Lighthouse CI** - Automated performance monitoring

