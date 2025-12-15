import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { scene, camera, renderer, setResizeHandler } from "./scene.js";
import { bloomSettings } from "./settings.js";

let composer = null;
let renderPass = null;
let bloomPass = null;
let fxaaPass = null;
let outputPass = null;

export function initPostProcessing() {
  const canvasContainer = document.getElementById("canvas-container");
  const rect = canvasContainer.getBoundingClientRect();
  const resolution = new THREE.Vector2(rect.width, rect.height);

  // Create render target with multisampling for better quality
  const renderTarget = new THREE.WebGLRenderTarget(resolution.width, resolution.height, {
    type: THREE.HalfFloatType,
    samples: 4, // Multisampling for anti-aliasing
  });

  // Create effect composer
  composer = new EffectComposer(renderer, renderTarget);

  // Create render pass
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Create bloom pass for glowing effects (load from saved settings)
  bloomPass = new UnrealBloomPass(resolution, bloomSettings.strength, bloomSettings.radius, bloomSettings.threshold);
  composer.addPass(bloomPass);

  // Create FXAA pass for anti-aliasing
  fxaaPass = new FXAAPass();
  composer.addPass(fxaaPass);

  // Create output pass for tone mapping
  outputPass = new OutputPass();
  composer.addPass(outputPass);

  // Update resize handler to include post-processing
  setResizeHandler(() => {
    const canvasContainer = document.getElementById("canvas-container");
    const rect = canvasContainer.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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




