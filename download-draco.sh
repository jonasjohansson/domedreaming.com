#!/bin/bash
# Script to download DRACOLoader and decoder files locally

set -e

BASE_DIR="assets/js/libs/three"
DRACO_DIR="${BASE_DIR}/draco"

echo "Creating directories..."
mkdir -p "${DRACO_DIR}"

echo "Downloading DRACOLoader.js..."
curl -s "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/loaders/DRACOLoader.js" \
  -o "${BASE_DIR}/DRACOLoader.js"

echo "Downloading draco_decoder.wasm..."
curl -s "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/libs/draco/gltf/draco_decoder.wasm" \
  -o "${DRACO_DIR}/draco_decoder.wasm"

echo "Downloading draco_decoder.js..."
curl -s "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/libs/draco/gltf/draco_decoder.js" \
  -o "${DRACO_DIR}/draco_decoder.js"

echo "Downloading draco_wasm_wrapper.js..."
curl -s "https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js" \
  -o "${DRACO_DIR}/draco_wasm_wrapper.js"

echo ""
echo "✓ All files downloaded successfully!"
echo ""
echo "Files downloaded:"
ls -lh "${BASE_DIR}/DRACOLoader.js" "${DRACO_DIR}"/*

