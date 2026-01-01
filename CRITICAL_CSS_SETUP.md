# Critical CSS Setup Guide

## How It Works

### 1. **Extract Critical CSS** (`scripts/extract-critical-css.js`)
- Runs after Eleventy builds
- Extracts only CSS needed for above-the-fold content:
  - CSS variables (`:root`)
  - Base styles (`html`, `body`)
  - Grid system (`.grid`, `.x-1` through `.x-12`)
  - Loading overlay (`#loading-overlay`)
  - Canvas container (`#canvas-container`)
  - First section styles
  - Typography basics
  - Font faces
- Saves to `docs/critical.css`

### 2. **Inline Critical CSS** (`scripts/inline-critical-css.js`)
- Reads `docs/critical.css`
- Inlines it in `<head>` as `<style>` tag
- Sets up async loading for full CSS file
- Updates `docs/index.html`

### 3. **Result**

**Before:**
```html
<link rel="stylesheet" href="assets/css/main.css" />
<!-- Blocks rendering until CSS loads -->
```

**After:**
```html
<style>
  /* Critical CSS inlined here (~5-10KB) */
  :root { --color-bg: #000000; ... }
  body { font-family: ... }
  /* etc */
</style>
<link rel="preload" href="assets/css/main.css" as="style" 
      onload="this.onload=null;this.rel='stylesheet'" />
<noscript><link rel="stylesheet" href="assets/css/main.css" /></noscript>
<!-- Full CSS loads asynchronously, doesn't block rendering -->
```

## Benefits

1. **Faster First Contentful Paint (FCP)**
   - Page renders immediately with critical styles
   - No waiting for full CSS file

2. **Better User Experience**
   - Users see content faster
   - Progressive enhancement (styles load in background)

3. **Performance Score Improvement**
   - Reduces render-blocking resources
   - Improves Lighthouse score

## Build Process

The build script now runs:
1. Eleventy builds site → `docs/`
2. Cleanup unused files
3. Minify JavaScript
4. **Extract critical CSS** → `docs/critical.css`
5. **Inline critical CSS** → Updates `docs/index.html`

## How to Use

Just run your normal build:
```bash
npm run build
```

The critical CSS extraction and inlining happens automatically!

## Manual Testing

To test if it's working:

1. Build the site: `npm run build`
2. Check `docs/index.html` - should have `<style>` tag with critical CSS
3. Check that full CSS loads asynchronously (check Network tab in DevTools)
4. Verify page renders immediately without waiting for CSS

## Troubleshooting

**If critical CSS is too large:**
- Adjust selectors in `extract-critical-css.js`
- Remove non-essential styles from extraction

**If styles are missing:**
- Add missing selectors to extraction script
- Check that CSS file paths are correct

**If async loading doesn't work:**
- Check browser console for errors
- Verify `loadCSS` polyfill is included
- Test with JavaScript disabled (should use `<noscript>` fallback)

