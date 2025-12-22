import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { scene, camera } from "./scene.js";
import { getMaterial, safeTraverse, pruneObjectChildren } from "./utils.js";
import * as settings from "../settings.js";
import { euler, setModelLoaded } from "./camera.js";
import { setScreenObject, loadDefaultScreenTexture, setupDragAndDrop } from "./texture.js";
import { verifyNavmeshAtStartPosition, initNavmesh, getNavMeshQuery } from "./navmesh.js";
import { findLEDRim, createLEDStrip } from "./led-strip.js";

export let wisdomeModel = null;
export let fbxMeshes = [];
export let glbLights = [];
export let glbLightsGroup = null;
export let hotspots = [];

export function loadModel(createColorGUI) {
  const loader = new GLTFLoader();
  const loadingDiv = document.getElementById("loading");

  loader.load(
    "assets/models/wisdome-rim.glb",
    (gltf) => {
      console.log("Wisdome GLB loaded successfully");
      if (!gltf || !gltf.scene) {
        console.error("GLB loaded but scene is missing");
        loadingDiv.innerHTML = '<div style="color: #ff4444;">Error: Model scene is missing.</div>';
        return;
      }
      const object = gltf.scene;
      wisdomeModel = object;
      // Reset to default position and rotation
      object.scale.setScalar(1);
      object.position.set(0, 0, 0);
      object.rotation.set(0, 0, 0);
      object.quaternion.set(0, 0, 0, 1); // Reset quaternion to identity

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
              // Clamp intensity to a sane range to avoid blowouts from bad saved data
              const clampedIntensity = Math.max(0, Math.min(saved.intensity ?? light.intensity, 10));
              light.intensity = clampedIntensity;
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

      // Find and create LED strip for LED_Rim
      const ledRim = findLEDRim(object);
      if (ledRim) {
        console.log("Found LED_Rim object, creating LED strip...");
        // Load LED strip settings before creating
        import("./led-strip.js").then((ledStrip) => {
          ledStrip.loadLEDStripSettings();
        });
        createLEDStrip(ledRim);
      } else {
        console.log("LED_Rim object not found in model");
      }

      // Process meshes
      safeTraverse(object, (child) => {
        if (child.isMesh) {
          const name = child.name.toLowerCase();

          // Skip LED_Rim and LED strip objects from mesh processing
          if (name.includes("led_rim") || name.includes("led_strip") || name.startsWith("led_")) {
            return; // Don't add to fbxMeshes
          }

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

            // Enhance materials for better visual quality
            if (material) {
              // Improve material properties for better rendering
              if (material.metalness !== undefined) {
                material.metalness = Math.max(material.metalness || 0, 0.1);
              }
              if (material.roughness !== undefined) {
                material.roughness = Math.min(material.roughness || 0.5, 0.8);
              }
              // Ensure proper color space
              if (material.map) {
                material.map.colorSpace = THREE.SRGBColorSpace;
              }
              // Enable better lighting
              if (material.isMeshBasicMaterial) {
                // Convert basic materials to standard for better lighting
                const newMaterial = new THREE.MeshStandardMaterial({
                  color: material.color,
                  map: material.map,
                  transparent: material.transparent,
                  opacity: material.opacity,
                  metalness: 0.1,
                  roughness: 0.5,
                });
                child.material = newMaterial;
                material = newMaterial;
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

      // Don't set camera position here - it's handled by the scroll transition system
      // Just set the euler for camera controls
      euler.set(settings.exteriorCameraRotation.x, settings.exteriorCameraRotation.y, settings.exteriorCameraRotation.z);

      setModelLoaded(true);

      const navMeshQuery = getNavMeshQuery();
      if (navMeshQuery) {
        verifyNavmeshAtStartPosition();
      }

      initNavmesh();
      createColorGUI();
      loadDefaultScreenTexture();
      setupDragAndDrop(); // Initialize drag and drop for texture updates
    },
    undefined,
    (error) => {
      console.error("Error loading 3D model:", error);
      loadingDiv.innerHTML = '<div style="color: #ff4444;">Error loading 3D model.</div>';
    }
  );
}
