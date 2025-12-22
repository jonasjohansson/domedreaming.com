import * as THREE from "three";
import { scene } from "./scene.js";

export function setupLighting() {
  // Simple ambient light only - GLB lights will provide the main lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  // Fog removed - no atmospheric fog
  scene.fog = null;
}
