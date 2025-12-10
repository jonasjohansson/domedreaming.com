import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.21/+esm";
import { init as initRecastNavigation, NavMeshQuery, importNavMesh } from "@recast-navigation/core";
import { threeToSoloNavMesh } from "@recast-navigation/three";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================
const CAMERA_HEIGHT = 1.6;
const NAVMESH_SEARCH_BOX = { x: 5, y: 10, z: 5 };
const SCREEN_MATERIAL_SETTINGS = {
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
  color: new THREE.Color(0xffffff),
  toneMapped: false,
  transparent: false,
  opacity: 1.0,
};

// ============================================================================
// SCENE SETUP
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;

const canvasContainer = document.getElementById("canvas-container");
canvasContainer.appendChild(renderer.domElement);
const canvas = renderer.domElement;

// ============================================================================
// STATE VARIABLES
// ============================================================================
let isPointerLocked = false;
let isTouching = false;
let modelLoaded = false;
let recastInitialized = false;
let euler = new THREE.Euler(0, 0, 0, "YXZ");
let wisdomeModel = null;
let screenObject = null;
let navmesh = null;
let navmeshMeshes = [];
let navMeshQuery = null;
let fbxMeshes = [];
let gui = null;
let glbLights = []; // Grouped lights from GLB
let glbLightsGroup = null; // Group container for GLB lights

// Media
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;

// Movement
const keys = {};
let moveSpeed = 0.02;
let qeRotationSpeed = 0;
let touchStartX = 0;
let touchStartY = 0;

// Day/Night mode
let isNightMode = false;
let gradientOverlay = null;

// Camera settings
let cameraSettings = {
  sensitivity: 0.002,
  rotationSpeed: 120,
};

let startCameraPosition = { x: 0, y: 4.698056077957153, z: -3 };
let startCameraRotation = { x: -3, y: 0, z: 3.121154018741333 };
let currentCameraPosition = { x: 0, y: 0, z: 0 };
let currentCameraRotation = { x: 0, y: 0, z: 0 };

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Apply texture to screen material (extracted common function)
function applyTextureToScreen(texture) {
  if (!screenObject) return;
  
  const material = Array.isArray(screenObject.material) 
    ? screenObject.material[0] 
    : screenObject.material;

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
function configureTexture(texture) {
  texture.flipY = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = -1;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

// Get material from mesh (handles arrays)
function getMaterial(mesh) {
  return Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
}

// Color to hex string
function colorToHex(color) {
  return `#${Math.floor(color.r * 255).toString(16).padStart(2, "0")}${Math.floor(color.g * 255).toString(16).padStart(2, "0")}${Math.floor(color.b * 255).toString(16).padStart(2, "0")}`;
}

// ============================================================================
// SETTINGS PERSISTENCE
// ============================================================================

function loadSettings() {
  try {
    const saved = localStorage.getItem("domeDreamingSettings");
    if (!saved) return;

    const settings = JSON.parse(saved);

    if (settings.moveSpeed !== undefined) moveSpeed = settings.moveSpeed;
    
    if (settings.cameraSettings) {
      Object.assign(cameraSettings, settings.cameraSettings);
    }
    
    if (settings.startCameraPosition) {
      Object.assign(startCameraPosition, settings.startCameraPosition);
    }
    
    if (settings.startCameraRotation) {
      Object.assign(startCameraRotation, settings.startCameraRotation);
    }
    
    if (settings.colorSettings) {
      window.savedColorSettings = settings.colorSettings;
    } else {
      window.savedColorSettings = null;
    }

    if (settings.lightSettings) {
      window.savedLightSettings = settings.lightSettings;
    } else {
      window.savedLightSettings = null;
    }

    if (settings.isNightMode !== undefined) {
      isNightMode = settings.isNightMode;
    }
  } catch (error) {
    console.warn("Failed to load settings:", error);
  }
}

function saveSettings() {
  try {
    const colorSettings = {};
    fbxMeshes.forEach((item, index) => {
      const material = getMaterial(item.mesh);
      if (material?.color) {
        const meshName = item.name || `mesh_${index}`;
        colorSettings[meshName] = {
          r: material.color.r,
          g: material.color.g,
          b: material.color.b,
        };
      }
    });

    const lightSettings = {};
    glbLights.forEach((light, index) => {
      const lightName = light.name || `light_${index}`;
      lightSettings[lightName] = {
        r: light.color.r,
        g: light.color.g,
        b: light.color.b,
        intensity: light.intensity,
      };
    });

    const settings = {
      moveSpeed,
      cameraSettings,
      startCameraPosition,
      startCameraRotation,
      colorSettings,
      lightSettings,
      isNightMode,
    };

    localStorage.setItem("domeDreamingSettings", JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save settings:", error);
  }
}

// ============================================================================
// LIGHTING SETUP
// ============================================================================

function setupLighting() {
  // Low ambient light for moody atmosphere
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  // Main directional light (key light) - warmer tone
  const directionalLight = new THREE.DirectionalLight(0xffeedd, 0.8);
  directionalLight.position.set(10, 10, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  directionalLight.shadow.radius = 4;
  directionalLight.shadow.bias = -0.0001;
  scene.add(directionalLight);

  // Fill light (cooler tone)
  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  // Atmospheric accent lights
  const accentLight1 = new THREE.PointLight(0xffaa88, 0.4, 20, 2);
  accentLight1.position.set(-4, 4, -3);
  scene.add(accentLight1);

  const accentLight2 = new THREE.PointLight(0x88aaff, 0.3, 20, 2);
  accentLight2.position.set(4, 4, 3);
  scene.add(accentLight2);

  // Rim light
  const rimLight = new THREE.DirectionalLight(0x4488ff, 0.2);
  rimLight.position.set(-10, 5, -10);
  scene.add(rimLight);

  // Hemisphere light
  const hemisphereLight = new THREE.HemisphereLight(0x4488ff, 0x222222, 0.1);
  scene.add(hemisphereLight);

  // Fog
  scene.fog = new THREE.Fog(0x1a1a1a, 20, 60);
}

// ============================================================================
// GRADIENT OVERLAY (Day/Night Mode)
// ============================================================================

function createGradientOverlay() {
  const gradient = document.createElement("div");
  gradient.id = "gradient-overlay";
  gradient.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 30%;
    pointer-events: none;
    z-index: 100;
    transition: background 1s ease;
  `;
  updateGradientOverlay();
  canvasContainer.appendChild(gradient);
  gradientOverlay = gradient;
}

function updateGradientOverlay() {
  if (!gradientOverlay) return;
  
  if (isNightMode) {
    gradientOverlay.style.background = "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)";
  } else {
    gradientOverlay.style.background = "linear-gradient(to top, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)";
  }
}

function toggleDayNightMode() {
  isNightMode = !isNightMode;
  updateGradientOverlay();
  updateLightingForMode();
  saveSettings();
}

function updateLightingForMode() {
  const intensityMultiplier = isNightMode ? 0.3 : 1.0;
  
  // Update GLB lights
  glbLights.forEach(light => {
    if (window.savedLightSettings) {
      const lightName = light.name || `light_${glbLights.indexOf(light)}`;
      const saved = window.savedLightSettings[lightName];
      if (saved) {
        light.intensity = saved.intensity * intensityMultiplier;
      } else {
        light.intensity *= intensityMultiplier;
      }
    } else {
      light.intensity *= intensityMultiplier;
    }
  });
}

// ============================================================================
// CAMERA CONTROLS
// ============================================================================

function setupCameraControls() {
  // Pointer lock
  function requestPointerLock() {
    const request = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
    if (request) request.call(canvas);
  }

  function onPointerLockChange() {
    const wasLocked = isPointerLocked;
    isPointerLocked = document.pointerLockElement === canvas || 
                     document.mozPointerLockElement === canvas || 
                     document.webkitPointerLockElement === canvas;
    
    if (!wasLocked && isPointerLocked && modelLoaded) {
      euler.setFromQuaternion(camera.quaternion);
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);

  canvas.addEventListener("click", () => {
    if (!isPointerLocked) requestPointerLock();
  });

  // Mouse movement
  function onMouseMove(event) {
    if (!isPointerLocked || !modelLoaded) return;
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    
    euler.y -= movementX * cameraSettings.sensitivity;
    euler.x -= movementY * cameraSettings.sensitivity;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
  }

  canvas.addEventListener("mousemove", onMouseMove);

  // Touch controls
  canvas.addEventListener("touchstart", (event) => {
    if (!modelLoaded) return;
    event.preventDefault();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isTouching = true;
    euler.setFromQuaternion(camera.quaternion);
  }, { passive: false });

  canvas.addEventListener("touchmove", (event) => {
    if (!isTouching || !modelLoaded) return;
    event.preventDefault();
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    euler.y -= deltaX * cameraSettings.sensitivity;
    euler.x -= deltaY * cameraSettings.sensitivity;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.quaternion.setFromEuler(euler);
    
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: false });

  canvas.addEventListener("touchend", (event) => {
    event.preventDefault();
    isTouching = false;
  }, { passive: false });

  canvas.addEventListener("touchcancel", (event) => {
    event.preventDefault();
    isTouching = false;
  }, { passive: false });

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === "c" || e.key === "C") {
      console.log("Camera Position:", camera.position);
      console.log("Camera Rotation:", camera.rotation);
    }
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.key === "q" || e.key === "Q" || e.key === "e" || e.key === "E") {
      qeRotationSpeed = 0;
    }
  });
}

// ============================================================================
// MOVEMENT & NAVMESH
// ============================================================================

function updateMovement() {
  camera.updateMatrixWorld();

  const forward = new THREE.Vector3();
  forward.setFromMatrixColumn(camera.matrixWorld, 2);
  forward.multiplyScalar(-1).normalize();

  const right = new THREE.Vector3();
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  right.normalize();

  const movement = new THREE.Vector3();
  if (keys["w"]) movement.add(forward.clone().multiplyScalar(moveSpeed));
  if (keys["s"]) movement.add(forward.clone().multiplyScalar(-moveSpeed));
  if (keys["a"]) movement.add(right.clone().multiplyScalar(-moveSpeed));
  if (keys["d"]) movement.add(right.clone().multiplyScalar(moveSpeed));

  if (movement.length() === 0) return;

  if (navMeshQuery) {
    const newPosition = camera.position.clone();
    newPosition.x += movement.x;
    newPosition.z += movement.z;

    const feetPosition = {
      x: newPosition.x,
      y: newPosition.y - CAMERA_HEIGHT,
      z: newPosition.z,
    };

    const result = navMeshQuery.findClosestPoint(feetPosition, {
      halfExtents: NAVMESH_SEARCH_BOX,
    });

    if (result.success) {
      camera.position.set(result.point.x, result.point.y + CAMERA_HEIGHT, result.point.z);
    } else {
      // Try sliding along axes
      const tryX = navMeshQuery.findClosestPoint(
        { x: newPosition.x, y: camera.position.y - CAMERA_HEIGHT, z: camera.position.z },
        { halfExtents: NAVMESH_SEARCH_BOX }
      );
      if (tryX.success) {
        camera.position.set(tryX.point.x, tryX.point.y + CAMERA_HEIGHT, camera.position.z);
      } else {
        const tryZ = navMeshQuery.findClosestPoint(
          { x: camera.position.x, y: camera.position.y - CAMERA_HEIGHT, z: newPosition.z },
          { halfExtents: NAVMESH_SEARCH_BOX }
        );
        if (tryZ.success) {
          camera.position.set(camera.position.x, tryZ.point.y + CAMERA_HEIGHT, tryZ.point.z);
        }
      }
    }
  } else {
    camera.position.add(movement);
  }
}

function constrainToNavmesh() {
  if (!navMeshQuery) return;
  const feetPosition = {
    x: camera.position.x,
    y: camera.position.y - CAMERA_HEIGHT,
    z: camera.position.z,
  };
  const result = navMeshQuery.findClosestPoint(feetPosition, {
    halfExtents: NAVMESH_SEARCH_BOX,
  });
  if (result.success) {
    camera.position.y = result.point.y + CAMERA_HEIGHT;
  }
}

// ============================================================================
// NAVMESH LOADING
// ============================================================================

async function initRecast() {
  if (recastInitialized) return;
  try {
    await initRecastNavigation();
    recastInitialized = true;
    loadNavmesh();
  } catch (error) {
    console.error("Failed to initialize recast-navigation:", error);
    recastInitialized = true;
  }
}

async function loadNavmesh() {
  if (!recastInitialized) {
    await initRecast();
    return;
  }

  try {
    const response = await fetch("assets/models/navmesh.bin");
    if (response.ok) {
      const data = await response.arrayBuffer();
      const navMeshData = new Uint8Array(data);
      const { navMesh } = importNavMesh(navMeshData);
      navMeshQuery = new NavMeshQuery(navMesh);
      console.log("Navmesh loaded from navmesh.bin");
      
      if (modelLoaded) {
        verifyNavmeshAtStartPosition();
      }
      return;
    }
  } catch (error) {
    console.log("navmesh.bin not found, will generate from GLTF");
  }

  loadNavmeshGLTF();
}

function loadNavmeshGLTF() {
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    "assets/models/navmesh.gltf",
    async (gltf) => {
      navmesh = gltf.scene;
      navmesh.scale.setScalar(1);
      navmesh.visible = false;

      navmesh.traverse((child) => {
        if (child.isMesh) {
          navmeshMeshes.push(child);
          child.updateMatrixWorld();
        }
      });

      scene.add(navmesh);

      if (navmeshMeshes.length > 0 && recastInitialized) {
        const { success, navMesh } = threeToSoloNavMesh(navmeshMeshes, {
          cs: 0.05,
          ch: 0.05,
          walkableRadius: 0.2,
        });

        if (success) {
          navMeshQuery = new NavMeshQuery(navMesh);
          console.log("Navmesh generated from GLTF");
        }
      }
    },
    undefined,
    (error) => {
      console.warn("Navmesh GLTF not found:", error);
    }
  );
}

function verifyNavmeshAtStartPosition() {
  if (!navMeshQuery || !modelLoaded) return;
  const feetPosition = {
    x: camera.position.x,
    y: camera.position.y - CAMERA_HEIGHT,
    z: camera.position.z,
  };
  const result = navMeshQuery.findClosestPoint(feetPosition, {
    halfExtents: NAVMESH_SEARCH_BOX,
  });
  if (result.success) {
    camera.position.y = result.point.y + CAMERA_HEIGHT;
  }
}

// ============================================================================
// SCREEN TEXTURE LOADING
// ============================================================================

function loadDefaultScreenTexture() {
  if (!screenObject) return;
  
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    "assets/media/background.jpg",
    (texture) => {
      configureTexture(texture);
      applyTextureToScreen(texture);
      currentImageTexture = texture;
    },
    undefined,
    () => {}
  );
}

function loadImage(file) {
  if (!screenObject) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      e.target.result,
      (texture) => {
        // Cleanup
        if (currentVideoTexture) {
          currentVideoTexture.dispose();
          currentVideoTexture = null;
        }
        if (currentVideo) {
          currentVideo.pause();
          currentVideo.src = "";
          URL.revokeObjectURL(currentVideo.src);
          currentVideo = null;
        }
        if (currentImageTexture) {
          currentImageTexture.dispose();
        }

        configureTexture(texture);
        applyTextureToScreen(texture);
        currentImageTexture = texture;

        // Brief flash effect
        const material = getMaterial(screenObject);
        if (material) {
          setTimeout(() => {
            Object.assign(material, SCREEN_MATERIAL_SETTINGS);
            material.needsUpdate = true;
          }, 200);
        }
      },
      undefined,
      () => {}
    );
  };
  reader.readAsDataURL(file);
}

function loadVideo(file) {
  if (!screenObject) return;

  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;

  video.addEventListener("loadedmetadata", () => {
    video.play();

    // Cleanup
    if (currentVideoTexture) currentVideoTexture.dispose();
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.src = "";
      URL.revokeObjectURL(currentVideo.src);
    }
    if (currentImageTexture) {
      currentImageTexture.dispose();
      currentImageTexture = null;
    }

    const videoTexture = new THREE.VideoTexture(video);
    configureTexture(videoTexture);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    applyTextureToScreen(videoTexture);
    currentVideoTexture = videoTexture;
    currentVideo = video;

    // Brief flash effect
    const material = getMaterial(screenObject);
    if (material) {
      setTimeout(() => {
        Object.assign(material, SCREEN_MATERIAL_SETTINGS);
        material.needsUpdate = true;
      }, 200);
    }
  });

  video.addEventListener("error", () => {});
}

// ============================================================================
// DRAG & DROP
// ============================================================================

function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlightScreen(isHighlight) {
    if (!screenObject) return;
    const material = getMaterial(screenObject);
    if (material) {
      if (isHighlight) {
        material.emissive = new THREE.Color(0x0096ff);
        material.emissiveIntensity = 0.8;
      } else {
        Object.assign(material, SCREEN_MATERIAL_SETTINGS);
        material.needsUpdate = true;
      }
    }
  }

  document.addEventListener("dragenter", (e) => {
    preventDefaults(e);
    dropZone.classList.add("drag-over");
    highlightScreen(true);
  }, false);

  document.addEventListener("dragover", (e) => {
    preventDefaults(e);
    dropZone.classList.add("drag-over");
    highlightScreen(true);
  }, false);

  document.addEventListener("dragleave", (e) => {
    preventDefaults(e);
    if (e.clientX === 0 && e.clientY === 0) {
      dropZone.classList.remove("drag-over");
      highlightScreen(false);
    }
  }, false);

  document.addEventListener("drop", (e) => {
    preventDefaults(e);
    dropZone.classList.remove("drag-over");
    highlightScreen(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        loadImage(file);
      } else if (file.type.startsWith("video/")) {
        loadVideo(file);
      }
    }
  }, false);
}

// ============================================================================
// MODEL LOADING & LIGHT GROUPING
// ============================================================================

function loadModel() {
  const loader = new GLTFLoader();
  const loadingDiv = document.getElementById("loading");

  loader.load(
    "assets/models/wisdome.glb",
    (gltf) => {
      console.log("Wisdome GLB loaded successfully");
      const object = gltf.scene;
      wisdomeModel = object;
      object.scale.setScalar(1);
      object.position.set(0, 0, 0);

      // Find and group lights from GLB
      glbLightsGroup = new THREE.Group();
      glbLightsGroup.name = "GLBLights";
      
      object.traverse((child) => {
        if (child.isLight) {
          glbLights.push(child);
          glbLightsGroup.add(child);
          console.log("Found GLB light:", child.name || "Unnamed", child.type);
        }
      });

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
              if (isNightMode) {
                light.intensity *= 0.3;
              }
            }
          });
        }
      }

      // Process meshes
      object.traverse((child) => {
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
            screenObject = child;
            screenObject.visible = true;
          } else {
            const material = getMaterial(child);
            const originalColor = material?.color 
              ? material.color.clone() 
              : new THREE.Color(0xffffff);

            fbxMeshes.push({
              mesh: child,
              name: child.name || "Unnamed",
              originalColor: originalColor,
            });
          }
        }
      });

      // Fallback screen detection
      if (!screenObject && object.children.length > 0) {
        object.traverse((child) => {
          if (child.isMesh && !screenObject) {
            screenObject = child;
            screenObject.visible = true;
            fbxMeshes = fbxMeshes.filter((item) => item.mesh !== screenObject);
          }
        });
      }

      scene.add(object);
      loadingDiv.classList.add("hidden");

      // Set camera position
      camera.position.set(startCameraPosition.x, startCameraPosition.y, startCameraPosition.z);
      camera.rotation.set(startCameraRotation.x, startCameraRotation.y, startCameraRotation.z);
      euler.set(startCameraRotation.x, startCameraRotation.y, startCameraRotation.z);

      modelLoaded = true;

      if (navMeshQuery) {
        verifyNavmeshAtStartPosition();
      }

      initRecast().catch(console.error);
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

// ============================================================================
// GUI CREATION
// ============================================================================

function createColorGUI() {
  if (gui) gui.destroy();

  if (fbxMeshes.length === 0) return;

  gui = new GUI({ title: "Scene Controls" });
  gui.domElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // Day/Night mode toggle
  const modeActions = {
    toggleMode: () => toggleDayNightMode(),
  };
  gui.add(modeActions, "toggleMode").name(isNightMode ? "Switch to Day" : "Switch to Night");

  // Mesh colors
  const meshFolder = gui.addFolder("Mesh Colors");
  fbxMeshes.forEach((item, index) => {
    const mesh = item.mesh;
    const material = getMaterial(mesh);
    if (!material) return;

    if (!material.color) {
      material.color = new THREE.Color(0xffffff);
    }

    const meshName = item.name || `mesh_${index}`;
    let colorToUse = material.color;

    if (window.savedColorSettings?.[meshName]) {
      const saved = window.savedColorSettings[meshName];
      colorToUse = new THREE.Color(saved.r, saved.g, saved.b);
      material.color = colorToUse;
      material.needsUpdate = true;
    }

    const colorObj = { color: colorToHex(colorToUse) };
    const folder = meshFolder.addFolder(item.name || `Mesh ${index + 1}`);
    const colorControl = folder.addColor(colorObj, "color");

    colorControl.onChange((value) => {
      const newColor = new THREE.Color(value);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if (mat) {
            mat.color = newColor;
            mat.needsUpdate = true;
          }
        });
      } else if (mesh.material) {
        mesh.material.color = newColor;
        mesh.material.needsUpdate = true;
      }
      saveSettings();
    });

    folder.open();
  });

  const resetObj = {
    reset: () => {
      fbxMeshes.forEach((item) => {
        const material = getMaterial(item.mesh);
        if (material) {
          material.color = item.originalColor.clone();
          material.needsUpdate = true;
        }
      });
      saveSettings();
      createColorGUI();
    },
  };
  meshFolder.add(resetObj, "reset").name("Reset All Colors");
  meshFolder.open();

  // Light colors (if GLB lights exist)
  if (glbLights.length > 0) {
    const lightFolder = gui.addFolder("GLB Lights");
    glbLights.forEach((light, index) => {
      const lightName = light.name || `Light ${index + 1}`;
      const lightObj = { 
        color: colorToHex(light.color),
        intensity: light.intensity,
      };

      const folder = lightFolder.addFolder(lightName);
      const colorControl = folder.addColor(lightObj, "color");
      const intensityControl = folder.add(lightObj, "intensity", 0, 5, 0.1);

      colorControl.onChange((value) => {
        light.color.setHex(value.replace("#", "0x"));
        saveSettings();
      });

      intensityControl.onChange((value) => {
        light.intensity = value;
        if (isNightMode) {
          light.intensity *= 0.3;
        }
        saveSettings();
      });

      folder.open();
    });
    lightFolder.open();
  }

  // Movement settings
  const movementFolder = gui.addFolder("Movement Settings");
  movementFolder.add({ moveSpeed }, "moveSpeed", 0.001, 0.2, 0.001)
    .name("Move Speed")
    .onChange((value) => {
      moveSpeed = value;
      saveSettings();
    });
  movementFolder.add(cameraSettings, "sensitivity", 0.0001, 0.01, 0.0001)
    .name("Mouse Sensitivity")
    .onChange(() => saveSettings());
  movementFolder.add(cameraSettings, "rotationSpeed", 30, 360, 10)
    .name("Q/E Rotation Speed (deg/sec)")
    .onChange(() => saveSettings());
  movementFolder.open();

  // Camera settings
  const cameraFolder = gui.addFolder("Camera Settings");
  
  const startPosFolder = cameraFolder.addFolder("Starting Position");
  startPosFolder.add(startCameraPosition, "x").name("Start X").onChange(() => saveSettings());
  startPosFolder.add(startCameraPosition, "y").name("Start Y").onChange(() => saveSettings());
  startPosFolder.add(startCameraPosition, "z").name("Start Z").onChange(() => saveSettings());
  
  const startRotFolder = cameraFolder.addFolder("Starting Rotation");
  startRotFolder.add(startCameraRotation, "x").name("Start Rot X").onChange(() => saveSettings());
  startRotFolder.add(startCameraRotation, "y").name("Start Rot Y").onChange(() => saveSettings());
  startRotFolder.add(startCameraRotation, "z").name("Start Rot Z").onChange(() => saveSettings());
  
  const currentPosFolder = cameraFolder.addFolder("Current Position");
  currentPosFolder.add(currentCameraPosition, "x").name("Current X").listen();
  currentPosFolder.add(currentCameraPosition, "y").name("Current Y").listen();
  currentPosFolder.add(currentCameraPosition, "z").name("Current Z").listen();
  
  const currentRotFolder = cameraFolder.addFolder("Current Rotation");
  currentRotFolder.add(currentCameraRotation, "x").name("Current Rot X").listen();
  currentRotFolder.add(currentCameraRotation, "y").name("Current Rot Y").listen();
  currentRotFolder.add(currentCameraRotation, "z").name("Current Rot Z").listen();
  
  const cameraActions = {
    copyCurrentToStart: () => {
      Object.assign(startCameraPosition, currentCameraPosition);
      Object.assign(startCameraRotation, currentCameraRotation);
      saveSettings();
      createColorGUI();
    },
    logCurrentValues: () => {
      console.log("Camera Position:", camera.position);
      console.log("Camera Rotation:", camera.rotation);
    },
  };
  
  cameraFolder.add(cameraActions, "copyCurrentToStart").name("Copy Current → Start");
  cameraFolder.add(cameraActions, "logCurrentValues").name("Log Current Values");
  cameraFolder.open();
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  // Q/E rotation
  if (keys["q"] || keys["Q"]) {
    qeRotationSpeed = -cameraSettings.rotationSpeed * (Math.PI / 180);
  } else if (keys["e"] || keys["E"]) {
    qeRotationSpeed = cameraSettings.rotationSpeed * (Math.PI / 180);
  } else {
    qeRotationSpeed = 0;
  }

  if (qeRotationSpeed !== 0 && modelLoaded) {
    euler.y += qeRotationSpeed * deltaTime;
    camera.quaternion.setFromEuler(euler);
  }

  updateMovement();

  if (navMeshQuery && modelLoaded) {
    constrainToNavmesh();
  }

  // Update GUI values
  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  if (currentVideoTexture && currentVideo && !currentVideo.paused) {
    currentVideoTexture.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

loadSettings();
setupLighting();
setupCameraControls();
setupDragAndDrop();
createGradientOverlay();
loadModel();
animate();

// Window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


