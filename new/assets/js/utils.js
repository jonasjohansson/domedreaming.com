import * as THREE from "three";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";

// Apply texture to screen material
export function applyTextureToScreen(texture, screenObject) {
  if (!screenObject) return;

  const material = Array.isArray(screenObject.material) ? screenObject.material[0] : screenObject.material;

  if (!material) {
    screenObject.material = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      ...SCREEN_MATERIAL_SETTINGS,
    });
    return;
  }

  // Dispose old textures
  if (material.map) material.map.dispose();
  if (material.emissiveMap) material.emissiveMap.dispose();

  // Apply new texture
  material.map = texture;
  material.emissiveMap = texture;
  Object.assign(material, SCREEN_MATERIAL_SETTINGS);
  material.needsUpdate = true;
}

// Configure texture settings
export function configureTexture(texture) {
  texture.flipY = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

// Get material from mesh (handles arrays)
export function getMaterial(mesh) {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

// Color to hex string
export function colorToHex(color) {
  return `#${Math.floor(color.r * 255)
    .toString(16)
    .padStart(2, "0")}${Math.floor(color.g * 255)
    .toString(16)
    .padStart(2, "0")}${Math.floor(color.b * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

// Recursively prune null/undefined children to avoid traverse errors
export function pruneObjectChildren(obj) {
  if (!obj || !obj.children) return;
  obj.children = obj.children.filter(Boolean);
  obj.children.forEach((child) => pruneObjectChildren(child));
}

// Safe traverse utility that skips invalid children and prunes them out
export function safeTraverse(obj, callback) {
  if (!obj) return;
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    callback(current);
    if (current.children && current.children.length) {
      for (let i = current.children.length - 1; i >= 0; i--) {
        const child = current.children[i];
        if (child && typeof child.traverse === "function") {
          stack.push(child);
        } else {
          // remove invalid child
          current.children.splice(i, 1);
        }
      }
    }
  }
}








