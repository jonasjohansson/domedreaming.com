import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { scene, camera } from "./scene.js";
import { getMaterial, safeTraverse, pruneObjectChildren } from "./utils.js";
import * as settings from "./settings.js";
import { euler, setModelLoaded } from "./camera.js";
import { setScreenObject } from "./texture.js";
import { loadDefaultScreenTexture } from "./texture.js";
import { verifyNavmeshAtStartPosition, initNavmesh, getNavMeshQuery } from "./navmesh.js";

export let wisdomeModel = null;
export let fbxMeshes = [];
export let glbLights = [];
export let glbLightsGroup = null;
export let hotspots = [];

export function loadModel(createColorGUI) {
  const loader = new GLTFLoader();
  const loadingDiv = document.getElementById("loading");

  loader.load(
    "assets/models/wisdome.glb",
    (gltf) => {
      console.log("Wisdome GLB loaded successfully");
      if (!gltf || !gltf.scene) {
        console.error("GLB loaded but scene is missing");
        loadingDiv.innerHTML = '<div style="color: #ff4444;">Error: Model scene is missing.</div>';
        return;
      }
      const object = gltf.scene;
      wisdomeModel = object;
      object.scale.setScalar(1);
      object.position.set(0, 0, 0);

      // Clean up any null/undefined children to avoid traverse errors
      pruneObjectChildren(object);

      // Find and group lights from GLB
      glbLightsGroup = new THREE.Group();
      glbLightsGroup.name = "GLBLights";

      // Find and group lights from GLB - check all possible light types
      safeTraverse(object, (child) => {
        if (child.isLight) {
          glbLights.push(child);
          glbLightsGroup.add(child);
          console.log("Found GLB light:", child.name || "Unnamed", child.type, "intensity:", child.intensity);
        }
      });

      // Also check for lights that might not be detected by isLight
      if (glbLights.length === 0) {
        console.log("No lights found with isLight, checking object for light instances...");
        safeTraverse(object, (child) => {
          if (
            child instanceof THREE.Light ||
            child instanceof THREE.DirectionalLight ||
            child instanceof THREE.PointLight ||
            child instanceof THREE.SpotLight ||
            child instanceof THREE.RectAreaLight ||
            child instanceof THREE.HemisphereLight
          ) {
            if (!glbLights.includes(child)) {
              glbLights.push(child);
              glbLightsGroup.add(child);
              console.log("Found additional light:", child.name || "Unnamed", child.constructor.name);
            }
          }
        });
      }

      if (glbLights.length > 0) {
        scene.add(glbLightsGroup);
        console.log(`Grouped ${glbLights.length} lights from GLB`);

        // Apply saved light settings
        if (window.savedLightSettings) {
          glbLights.forEach((light, index) => {
            const lightName = light.name || `light_${index}`;
            const saved = window.savedLightSettings[lightName];
            if (saved) {
              light.color.setRGB(saved.r, saved.g, saved.b);
              light.intensity = saved.intensity;
            }
          });
        }
      } else {
        console.log("No lights found in GLB file. Lights GUI will not be available.");
      }

      // Find and store hotspots
      safeTraverse(object, (child) => {
        // Look for "Hotspots" group/empty axis
        if (child.name === "Hotspots") {
          safeTraverse(child, (hotspotChild) => {
            // Look for "Hotspot.001" or any object with "Hotspot" in the name
            if (hotspotChild.name === "Hotspot.001" || hotspotChild.name.includes("Hotspot")) {
              // Get world position
              const worldPosition = new THREE.Vector3();
              hotspotChild.getWorldPosition(worldPosition);
              hotspots.push({
                object: hotspotChild,
                position: worldPosition,
                name: hotspotChild.name,
                triggered: false,
              });
              console.log(`Found hotspot: ${hotspotChild.name} at position:`, worldPosition);
            }
          });
        }
      });

      // Process meshes
      safeTraverse(object, (child) => {
        if (child.isMesh) {
          const name = child.name.toLowerCase();

          if (
            name.includes("screen") ||
            name.includes("display") ||
            name.includes("monitor") ||
            name.includes("panel") ||
            name.includes("projection") ||
            name.includes("canvas")
          ) {
            setScreenObject(child);
            child.visible = true;
          } else {
            const material = getMaterial(child);
            const originalColor = material?.color ? material.color.clone() : new THREE.Color(0xffffff);

            // Make materials non-reflective (matte finish)
            if (material) {
              // Set to non-metallic and fully rough to prevent reflections
              if (material.metalness !== undefined) {
                material.metalness = 0;
              }
              if (material.roughness !== undefined) {
                material.roughness = 1.0;
              }
              // Disable specular highlights
              if (material.specular !== undefined) {
                material.specular = new THREE.Color(0x000000);
              }
              if (material.shininess !== undefined) {
                material.shininess = 0;
              }
              material.needsUpdate = true;
            }

            fbxMeshes.push({
              mesh: child,
              name: child.name || "Unnamed",
              originalColor: originalColor,
            });
          }
        }
      });

      // Fallback screen detection - check if screen was found
      let screenObjectFound = false;
      safeTraverse(object, (child) => {
        if (
          child.isMesh &&
          child.name &&
          (child.name.toLowerCase().includes("screen") ||
            child.name.toLowerCase().includes("display") ||
            child.name.toLowerCase().includes("monitor") ||
            child.name.toLowerCase().includes("panel") ||
            child.name.toLowerCase().includes("projection") ||
            child.name.toLowerCase().includes("canvas"))
        ) {
          screenObjectFound = true;
        }
      });

      if (!screenObjectFound && object && object.children.length > 0) {
        safeTraverse(object, (child) => {
          if (child.isMesh && !screenObjectFound) {
            setScreenObject(child);
            child.visible = true;
            fbxMeshes = fbxMeshes.filter((item) => item.mesh !== child);
            screenObjectFound = true;
          }
        });
      }

      scene.add(object);

      // Fade in the site
      setTimeout(() => {
        loadingDiv.classList.add("hidden");
        const canvasContainer = document.getElementById("canvas-container");
        const infoPanel = document.getElementById("info-panel");
        if (canvasContainer) canvasContainer.classList.add("loaded");
        if (infoPanel) infoPanel.classList.add("loaded");
      }, 300);

      // Set camera position
      camera.position.set(settings.startCameraPosition.x, settings.startCameraPosition.y, settings.startCameraPosition.z);
      camera.rotation.set(settings.startCameraRotation.x, settings.startCameraRotation.y, settings.startCameraRotation.z);
      euler.set(settings.startCameraRotation.x, settings.startCameraRotation.y, settings.startCameraRotation.z);

      setModelLoaded(true);

      const navMeshQuery = getNavMeshQuery();
      if (navMeshQuery) {
        verifyNavmeshAtStartPosition();
      }

      initNavmesh();
      createColorGUI();
      loadDefaultScreenTexture();
    },
    undefined,
    (error) => {
      console.error("Error loading 3D model:", error);
      loadingDiv.innerHTML = '<div style="color: #ff4444;">Error loading 3D model.</div>';
    }
  );
}
