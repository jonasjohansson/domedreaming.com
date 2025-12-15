#!/bin/bash

# Script to download all external sources locally
# Run with: bash download-external-sources.sh

echo "Creating directories..."
mkdir -p assets/libs/three
mkdir -p assets/libs/three/examples/jsm/loaders
mkdir -p assets/libs/lil-gui
mkdir -p assets/libs/recast-navigation/core
mkdir -p assets/libs/recast-navigation/wasm
mkdir -p assets/libs/recast-navigation/generators
mkdir -p assets/libs/recast-navigation/three

echo ""
echo "Downloading Three.js..."
curl -L -o assets/libs/three/three.module.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js

echo "Downloading Three.js GLTFLoader..."
curl -L -o assets/libs/three/examples/jsm/loaders/GLTFLoader.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js

echo "Downloading lil-gui..."
curl -L -o assets/libs/lil-gui/lil-gui.esm.js \
  https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm

echo "Downloading @recast-navigation/core..."
curl -L -o assets/libs/recast-navigation/core/index.mjs \
  https://unpkg.com/@recast-navigation/core@0.38.0/dist/index.mjs

echo "Downloading @recast-navigation/wasm..."
curl -L -o assets/libs/recast-navigation/wasm/recast-navigation.wasm-compat.js \
  https://unpkg.com/@recast-navigation/wasm@0.38.0/dist/recast-navigation.wasm-compat.js

echo "Downloading @recast-navigation/generators..."
curl -L -o assets/libs/recast-navigation/generators/index.mjs \
  https://unpkg.com/@recast-navigation/generators@0.38.0/dist/index.mjs

echo "Downloading @recast-navigation/three..."
curl -L -o assets/libs/recast-navigation/three/index.mjs \
  https://unpkg.com/@recast-navigation/three@0.38.0/dist/index.mjs

echo ""
echo "✅ All files downloaded!"
echo ""
echo "⚠️  Next steps:"
echo "1. Check EXTERNAL_SOURCES.md for instructions on updating import paths"
echo "2. You may need to download additional WASM files for recast-navigation"
echo "3. Test the site and check browser console for any missing dependencies"






