import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { scene, camera, renderer, setResizeHandler } from "./scene.js";
import { bloomSettings } from "../settings.js";

let composer = null;
let renderPass = null;
let bloomPass = null;
let fxaaPass = null;
let outputPass = null;

export function initPostProcessing() {
  const canvasContainer = document.getElementById("canvas-container");
  const rect = canvasContainer.getBoundingClientRect();
  const resolution = new THREE.Vector2(rect.width, rect.height);

  // Create render target - reduced quality for performance
  const renderTarget = new THREE.WebGLRenderTarget(resolution.width, resolution.height, {
    type: THREE.HalfFloatType,
    samples: 0, // Disable multisampling for better performance
  });

  // Create effect composer
  composer = new EffectComposer(renderer, renderTarget);

  // Create render pass
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Create bloom pass for glowing effects (load from saved settings)
  const initialStrength = bloomSettings.enabled !== false ? bloomSettings.strength : 0;
  bloomPass = new UnrealBloomPass(resolution, initialStrength, bloomSettings.radius, bloomSettings.threshold);
  bloomPass.enabled = bloomSettings.enabled !== false;
  composer.addPass(bloomPass);

  // FXAA disabled for better performance
  // fxaaPass = new FXAAPass();
  // composer.addPass(fxaaPass);

  // Output pass disabled for better performance - use direct render instead
  // outputPass = new OutputPass();
  // composer.addPass(outputPass);

  // Update resize handler to include post-processing
  setResizeHandler(() => {
    const canvasContainer = document.getElementById("canvas-container");
    const rect = canvasContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    resizePostProcessing();
  });

  console.log("Post-processing initialized");
}

export function updatePostProcessing() {
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

export function resizePostProcessing() {
  if (composer) {
    const canvasContainer = document.getElementById("canvas-container");
    const rect = canvasContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    composer.setSize(width, height);

    if (bloomPass) {
      bloomPass.setSize(width, height);
    }

    if (fxaaPass) {
      fxaaPass.setSize(width, height);
    }
  }
}

export function getBloomPass() {
  return bloomPass;
}
