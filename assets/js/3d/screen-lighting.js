import * as THREE from "three";
import { scene } from "./scene.js";
import { getCurrentImageTexture, getCurrentVideoTexture, getScreenObject } from "./texture.js";

let screenLight = null;
let screenObject = null;
let hemisphereLight = null;
let secondaryLight = null;
let lastColorUpdate = 0;
const COLOR_UPDATE_INTERVAL = 250; // Update color every 250ms (was 100ms)
let colorSamplingEnabled = true;
const hsl = { h: 0, s: 0, l: 0 }; // Reusable HSL object for color manipulation
/** Reusable canvas and context for color sampling — avoids creating new ones each call */
let _sampleCanvas = null;
let _sampleCtx = null;
const _sampledColor = new THREE.Color();
const _ambientColor = new THREE.Color();
const _worldPos = new THREE.Vector3();

/**
 * Initialize screen-based lighting system
 * Creates a colored light that samples colors from the screen texture
 */
export function initScreenLighting(screenObj) {
  screenObject = screenObj;

  // Create a point light positioned near the screen with higher intensity
  // Position will be set based on screen object position
  screenLight = new THREE.PointLight(0xffffff, 2.0, 30); // Increased intensity and range
  screenLight.position.set(0, 0, 0);
  scene.add(screenLight);

  // Also create a hemisphere light for ambient color bleeding with stronger effect
  hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.8); // Increased intensity
  hemisphereLight.position.set(0, 5, 0);
  scene.add(hemisphereLight);

  // Add a second point light for more color spread
  secondaryLight = new THREE.PointLight(0xffffff, 1.5, 25);
  secondaryLight.position.set(0, 0, 0);
  scene.add(secondaryLight);

  return { screenLight, hemisphereLight, secondaryLight };
}

/**
 * Sample average color from texture
 * Uses a small canvas to read pixel data and calculate average color
 */
function sampleTextureColor(texture) {
  if (!texture || !texture.image) return null;

  // Lazy-init reusable canvas
  if (!_sampleCanvas) {
    _sampleCanvas = document.createElement("canvas");
    _sampleCanvas.width = 32;
    _sampleCanvas.height = 32;
    _sampleCtx = _sampleCanvas.getContext("2d", { willReadFrequently: true });
  }

  try {
    _sampleCtx.drawImage(texture.image, 0, 0, 32, 32);
    const imageData = _sampleCtx.getImageData(0, 0, 32, 32);
    const data = imageData.data;

    let r = 0, g = 0, b = 0;
    const pixelCount = 32 * 32;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    _sampledColor.setRGB(r / pixelCount / 255, g / pixelCount / 255, b / pixelCount / 255);
    return _sampledColor;
  } catch (error) {
    return null;
  }
}

/**
 * Update screen lighting based on current texture colors
 */
export function updateScreenLighting(currentTime) {
  if (!screenLight || !colorSamplingEnabled) return;
  
  // Throttle color updates for performance
  if (currentTime - lastColorUpdate < COLOR_UPDATE_INTERVAL) return;
  lastColorUpdate = currentTime;
  
  // Try to get color from current texture (image or video)
  let color = null;
  const imageTexture = getCurrentImageTexture();
  const videoTexture = getCurrentVideoTexture();
  
  if (videoTexture && videoTexture.image) {
    // For video, sample from the video element
    color = sampleTextureColor(videoTexture);
  } else if (imageTexture) {
    // For images, sample from the texture
    color = sampleTextureColor(imageTexture);
  }
  
  if (color) {
    // Boost saturation and brightness in-place (no clone)
    color.getHSL(hsl);
    hsl.s = Math.min(1.0, hsl.s * 1.5);
    hsl.l = Math.min(1.0, hsl.l * 1.2);
    color.setHSL(hsl.h, hsl.s, hsl.l);

    screenLight.color.copy(color);
    screenLight.intensity = 3.0;

    if (hemisphereLight) {
      _ambientColor.set(0xffffff).lerp(color, 0.6);
      hemisphereLight.color.copy(_ambientColor);
      hemisphereLight.intensity = 1.2;
    }

    if (secondaryLight) {
      secondaryLight.color.copy(color);
      secondaryLight.intensity = 2.0;
    }

    const currentScreenObject = getScreenObject();
    if (currentScreenObject) {
      currentScreenObject.getWorldPosition(_worldPos);
      screenLight.position.copy(_worldPos);
      screenLight.position.z += 0.5;

      if (secondaryLight) {
        secondaryLight.position.copy(_worldPos);
        secondaryLight.position.z += 0.3;
        secondaryLight.position.y += 0.2;
      }
    }
  }
}

/**
 * Enable or disable color sampling
 */
export function setColorSamplingEnabled(enabled) {
  colorSamplingEnabled = enabled;
}

/**
 * Get the screen light for external control
 */
export function getScreenLight() {
  return screenLight;
}

