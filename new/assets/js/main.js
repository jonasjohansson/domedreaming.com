import { scene, camera, renderer } from "./scene.js";
import { loadSettings } from "./settings.js";
import { setupLighting } from "./lighting.js";
import { setupCameraControls, setModelLoaded } from "./camera.js";
import { setupDragAndDrop } from "./texture.js";
import { loadModel } from "./model.js";
import { createColorGUI } from "./gui.js";
import { updateMovement, constrainToNavmesh, updateRotation, checkHotspots } from "./movement.js";
import { getNavMeshQuery } from "./navmesh.js";
import { getCurrentVideoTexture, getCurrentVideo } from "./texture.js";
import { currentCameraPosition, currentCameraRotation } from "./settings.js";
import { modelLoaded } from "./camera.js";
import { initPostProcessing, updatePostProcessing } from "./postprocessing.js";
import { updateLEDAnimation } from "./led-strip.js";

// Initialize
loadSettings();
// Load LED strip settings after main settings are loaded
import("./led-strip.js").then((ledStrip) => {
  ledStrip.loadLEDStripSettings();
});
setupLighting();
setupCameraControls();
setupDragAndDrop();
initPostProcessing();
loadModel(createColorGUI);

// Animation loop
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  updateRotation(deltaTime);
  updateMovement();

  const navMeshQuery = getNavMeshQuery();
  if (navMeshQuery && modelLoaded) {
    constrainToNavmesh();
  }

  // Check for hotspot proximity
  if (modelLoaded) {
    checkHotspots();
  }

  // Update LED strip animation
  if (modelLoaded) {
    updateLEDAnimation(deltaTime);
  }

  // Update GUI values
  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  const currentVideoTexture = getCurrentVideoTexture();
  const currentVideo = getCurrentVideo();
  if (currentVideoTexture && currentVideo && !currentVideo.paused) {
    currentVideoTexture.needsUpdate = true;
  }

  // Use post-processing composer instead of direct render
  updatePostProcessing();
}

animate();
