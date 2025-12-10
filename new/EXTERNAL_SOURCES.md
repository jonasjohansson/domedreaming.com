# External Sources and Scripts

This document lists all external sources and scripts that need to be downloaded locally.

## JavaScript Libraries

### 1. Three.js

- **URL**: `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
- **Version**: 0.160.0
- **Type**: ES Module
- **Used in**: `index.html` (importmap)
- **Download**: https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js

### 2. Three.js Addons (GLTFLoader)

- **Base URL**: `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/`
- **Specific file**: `loaders/GLTFLoader.js`
- **Full URL**: `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js`
- **Version**: 0.160.0
- **Type**: ES Module
- **Used in**: `assets/js/navmesh.js`, `assets/js/model.js`
- **Download**: https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js

### 3. lil-gui

- **URL**: `https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm`
- **Version**: 0.21
- **Type**: ES Module
- **Used in**: `assets/js/gui.js`
- **Download**: https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm

### 4. @recast-navigation/core

- **URL**: `https://unpkg.com/@recast-navigation/core@0.38.0/dist/index.mjs`
- **Version**: 0.38.0
- **Type**: ES Module
- **Used in**: `index.html` (importmap), `assets/js/navmesh.js`
- **Download**: https://unpkg.com/@recast-navigation/core@0.38.0/dist/index.mjs

### 5. @recast-navigation/wasm

- **URL**: `https://unpkg.com/@recast-navigation/wasm@0.38.0/dist/recast-navigation.wasm-compat.js`
- **Version**: 0.38.0
- **Type**: ES Module (WASM wrapper)
- **Used in**: `index.html` (importmap)
- **Download**: https://unpkg.com/@recast-navigation/wasm@0.38.0/dist/recast-navigation.wasm-compat.js
- **Note**: This may also require WASM files. Check the package for additional dependencies.

### 6. @recast-navigation/generators

- **URL**: `https://unpkg.com/@recast-navigation/generators@0.38.0/dist/index.mjs`
- **Version**: 0.38.0
- **Type**: ES Module
- **Used in**: `index.html` (importmap)
- **Download**: https://unpkg.com/@recast-navigation/generators@0.38.0/dist/index.mjs

### 7. @recast-navigation/three

- **URL**: `https://unpkg.com/@recast-navigation/three@0.38.0/dist/index.mjs`
- **Version**: 0.38.0
- **Type**: ES Module
- **Used in**: `index.html` (importmap), `assets/js/navmesh.js`
- **Download**: https://unpkg.com/@recast-navigation/three@0.38.0/dist/index.mjs

## Fonts

### Google Fonts (Inter Tight)

- **Preconnect URLs**:
  - `https://fonts.googleapis.com`
  - `https://fonts.gstatic.com`
- **Note**: Currently no font CSS is loaded (the font link was removed). If you want to use Inter Tight, you'll need to either:
  1. Add back the Google Fonts link, or
  2. Download the font files locally

## Download Script

You can use this bash script to download all files:

```bash
#!/bin/bash

# Create directories
mkdir -p assets/libs/three
mkdir -p assets/libs/three/examples/jsm/loaders
mkdir -p assets/libs/lil-gui
mkdir -p assets/libs/recast-navigation/core
mkdir -p assets/libs/recast-navigation/wasm
mkdir -p assets/libs/recast-navigation/generators
mkdir -p assets/libs/recast-navigation/three

# Download Three.js
curl -o assets/libs/three/three.module.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js

# Download Three.js GLTFLoader
curl -o assets/libs/three/examples/jsm/loaders/GLTFLoader.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js

# Download lil-gui
curl -o assets/libs/lil-gui/lil-gui.esm.js \
  https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm

# Download recast-navigation packages
curl -o assets/libs/recast-navigation/core/index.mjs \
  https://unpkg.com/@recast-navigation/core@0.38.0/dist/index.mjs

curl -o assets/libs/recast-navigation/wasm/recast-navigation.wasm-compat.js \
  https://unpkg.com/@recast-navigation/wasm@0.38.0/dist/recast-navigation.wasm-compat.js

curl -o assets/libs/recast-navigation/generators/index.mjs \
  https://unpkg.com/@recast-navigation/generators@0.38.0/dist/index.mjs

curl -o assets/libs/recast-navigation/three/index.mjs \
  https://unpkg.com/@recast-navigation/three@0.38.0/dist/index.mjs

echo "All files downloaded!"
```

## After Downloading

After downloading, you'll need to update the importmap in `index.html` to point to local files:

```html
<script type="importmap">
  {
    "imports": {
      "three": "./assets/libs/three/three.module.js",
      "three/addons/": "./assets/libs/three/examples/jsm/",
      "@recast-navigation/core": "./assets/libs/recast-navigation/core/index.mjs",
      "@recast-navigation/wasm": "./assets/libs/recast-navigation/wasm/recast-navigation.wasm-compat.js",
      "@recast-navigation/generators": "./assets/libs/recast-navigation/generators/index.mjs",
      "@recast-navigation/three": "./assets/libs/recast-navigation/three/index.mjs"
    }
  }
</script>
```

And update `assets/js/gui.js`:

```javascript
import GUI from "./libs/lil-gui/lil-gui.esm.js";
```

## Important Notes

1. **WASM Files**: The recast-navigation WASM package may require additional `.wasm` binary files. Check the package documentation or inspect network requests to find all required files.

2. **Dependencies**: Some packages may have internal dependencies that also need to be downloaded. Check the browser console for any 404 errors after switching to local files.

3. **CORS**: When testing locally, you may need to serve files through a local web server (not `file://`) to avoid CORS issues.

4. **Version Pinning**: All versions are pinned. Make sure to download the exact versions listed to avoid compatibility issues.
