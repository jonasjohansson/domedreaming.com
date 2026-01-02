import * as THREE from "three";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";

/**
 * Generate a random muted color for screen (same as other meshes)
 * Returns RGB values between 0 and 1
 */
function generateRandomMutedColor() {
  // Generate random hue (0-1)
  const hue = Math.random();

  // Moderate saturation (0.25-0.45) for slightly more popping colors
  const saturation = 0.25 + Math.random() * 0.2;

  // Darker lightness (0.2-0.35) for darker but still vibrant colors
  const lightness = 0.2 + Math.random() * 0.15;

  // Use Three.js Color for clean HSL to RGB conversion
  const color = new THREE.Color();
  color.setHSL(hue, saturation, lightness);

  return color;
}

/**
 * Get or generate random color for screen
 */
function getScreenColor() {
  // Ensure savedColorSettings exists
  if (!window.savedColorSettings) {
    window.savedColorSettings = {};
  }

  // Generate random muted color for Screen on each load (like Main_Structure and Floor)
  if (!window.savedColorSettings["Screen"]) {
    const randomColor = generateRandomMutedColor();
    window.savedColorSettings["Screen"] = {
      r: randomColor.r,
      g: randomColor.g,
      b: randomColor.b,
    };
  }

  const colorData = window.savedColorSettings["Screen"];
  return new THREE.Color(colorData.r, colorData.g, colorData.b);
}

export function applyTextureToScreen(texture, screenObject) {
  if (!screenObject) return;

  const material = Array.isArray(screenObject.material) ? screenObject.material[0] : screenObject.material;

  if (!material) {
    const newMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      ...SCREEN_MATERIAL_SETTINGS,
      color: new THREE.Color(0xffffff), // White so texture shows true colors
      emissive: new THREE.Color(0xffffff), // White emissive for brightness
      emissiveMap: texture, // Use texture as emissive map
      emissiveIntensity: 1.0, // Full emissive intensity
    });
    screenObject.material = newMaterial;
    return;
  }

  // Dispose old textures
  if (material.map) material.map.dispose();
  if (material.emissiveMap && material.emissiveMap !== texture) {
    material.emissiveMap.dispose();
  }

  // Apply new texture
  material.map = texture;
  material.emissiveMap = texture; // Use texture as emissive map
  // Apply screen material settings
  Object.assign(material, SCREEN_MATERIAL_SETTINGS);
  // Set color to white so texture shows true colors (like a normal screen)
  material.color.setRGB(1, 1, 1);
  // Set emissive to white with texture for brightness
  material.emissive.setRGB(1, 1, 1);
  material.emissiveIntensity = 1.0; // Full emissive intensity
  material.needsUpdate = true;
}

export function configureTexture(texture) {
  texture.flipY = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = 1; // Flip on X axis (horizontal flip)
  texture.repeat.y = -1; // Keep Y axis normal
  texture.colorSpace = THREE.SRGBColorSpace;
  // Set center to (0.5, 0.5) for rotation around center
  texture.center.set(0.5, 0.5);
  texture.needsUpdate = true;
}

export function getMaterial(mesh) {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

export function colorToHex(color) {
  return `#${Math.floor(color.r * 255)
    .toString(16)
    .padStart(2, "0")}${Math.floor(color.g * 255)
    .toString(16)
    .padStart(2, "0")}${Math.floor(color.b * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

export function pruneObjectChildren(obj) {
  if (!obj || !obj.children) return;
  obj.children = obj.children.filter(Boolean);
  obj.children.forEach((child) => pruneObjectChildren(child));
}

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
