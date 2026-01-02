# Build Pipeline Optimizations

This document outlines all optimizations implemented in the build pipeline.

## Current Optimizations

### ✅ Implemented

1. **HTML Minification** - Using `html-minifier-next`
   - Removes whitespace, comments, optional tags
   - Minifies inline CSS and JS
   - Reduces HTML size by ~20-30%

2. **JavaScript Minification** - Using `terser`
   - Removes console.log in production
   - Mangles variable names
   - Compresses code
   - Reduces JS size by ~40-60%

3. **CSS Minification** - Using `csso`
   - Removes whitespace and comments
   - Optimizes selectors
   - Reduces CSS size by ~20-30%

4. **Critical CSS Extraction** - Inlines critical CSS
   - Extracts above-the-fold CSS
   - Inlines in `<head>` for faster FCP
   - Loads full CSS asynchronously

5. **Image Optimization** - Using `sharp`
   - Compresses JPEG (quality 85, progressive)
   - Optimizes PNG (compression level 9)
   - Reduces image size by ~30-50%

6. **Font Subsetting** - Using `glyphhanger`
   - Analyzes HTML to find used characters
   - Subsets fonts to include only needed characters
   - Reduces font file sizes by 70-90%

7. **Service Worker** - Caching and offline support
   - Caches static assets (CSS, JS, images, fonts)
   - Cache-first strategy for static assets
   - Network-first strategy for HTML
   - Enables offline functionality
   - Reduces load times by 50-80% on repeat visits

8. **Asset Cleanup** - Removes unused files
   - Removes source files from output
   - Cleans up development artifacts

9. **Bundle Analysis** - Analyzes output
   - Reports file sizes
   - Identifies large files
   - Provides optimization recommendations

## Build Scripts

```bash
# Full production build (recommended)
npm run build

# Individual steps
npm run build:eleventy      # Generate HTML
npm run build:optimize      # Run all optimizations
npm run build:minify         # Minify JS and CSS
npm run build:images         # Optimize images
npm run build:fonts          # Subset fonts
npm run build:analyze        # Analyze bundle sizes

# Development
npm run dev                  # Development server
npm run build:no-minify     # Build without minification
```

## Performance Metrics

After optimizations, expect:
- **HTML**: 20-30% size reduction
- **JavaScript**: 40-60% size reduction
- **CSS**: 20-30% size reduction
- **Images**: 30-50% size reduction
- **Fonts**: 70-90% size reduction (with subsetting)
- **Total Blocking Time**: Reduced by deferring non-critical work
- **First Contentful Paint**: Improved with critical CSS
- **Repeat Visit Load Time**: 50-80% faster (with service worker)

## Additional Optimization Opportunities

### High Impact (Recommended)

1. **GLB Model Compression** - Compress 3D models
   ```bash
   npm install -D gltf-pipeline
   # Compress wisdome.glb for smaller file size
   ```

3. **Service Worker** - Cache static assets
   - Implement offline support
   - Cache strategy for repeat visits

4. **Resource Hints** - Optimize loading
   - `preload` for critical resources
   - `prefetch` for likely next pages
   - `dns-prefetch` for external domains

### Medium Impact

5. **CSS Purging** - Remove unused CSS
   ```bash
   npm install -D @fullhuman/postcss-purgecss
   # Remove unused CSS classes
   ```

6. **Code Splitting** - Lazy load modules
   - Split 3D code into separate bundle
   - Load on demand

7. **Image Format Conversion** - Use modern formats
   - Convert to WebP with fallback
   - Use AVIF for supported browsers

8. **Gzip/Brotli Compression** - Server-side compression
   - Configure server to compress responses
   - Reduces transfer size by ~70-80%

### Low Impact (Nice to Have)

9. **Source Maps** - For production debugging
   - Generate source maps for minified code
   - Only include in staging builds

10. **Bundle Visualization** - Analyze dependencies
    ```bash
    npm install -D webpack-bundle-analyzer
    # Visualize bundle composition
    ```

11. **Lighthouse CI** - Automated performance testing
    - Run Lighthouse on every build
    - Track performance metrics over time

## Installation

To use all optimizations, install dependencies:

```bash
npm install
```

Required dependencies:
- `sharp` - Image optimization
- `terser` - JavaScript minification
- `csso` - CSS minification
- `html-minifier-next` - HTML minification

Optional (for analysis):
- `jsdom` - CSS usage analysis

## Build Time

Expected build times:
- **Development** (`npm run dev`): ~1-2 seconds
- **Production** (`npm run build`): ~5-10 seconds
  - Eleventy: ~2-3s
  - Minification: ~1-2s
  - Image optimization: ~2-5s (depends on image count)

## Notes

- Image optimization requires `sharp` (native module)
- CSS analysis requires `jsdom` (optional)
- All optimizations are production-only (not in dev mode)
- Source files are preserved; only output is optimized

