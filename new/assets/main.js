// A-Frame Components and Game Logic

// Global storage for screen object
let screenObject = null;
let fbxMeshes = [];

// Debug: Toggle navmesh visibility with 'N' key
document.addEventListener("keydown", (e) => {
  if (e.key === "n" || e.key === "N") {
    const navmesh = document.querySelector("#navmesh");
    if (navmesh) {
      const currentVisible = navmesh.getAttribute("visible");
      navmesh.setAttribute("visible", !currentVisible);
      console.log("Navmesh visibility toggled to:", !currentVisible);
      
      // If making visible, apply green material
      if (!currentVisible) {
        const model = navmesh.getObject3D("mesh");
        if (model) {
          const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide,
          });
          
          model.traverse((child) => {
            if (child.isMesh) {
              child.material = material;
              child.visible = true;
            }
          });
        }
      }
    }
  }
});

// Component to handle Wisdome model setup
AFRAME.registerComponent("wisdome-model", {
  init: function() {
    const el = this.el;
    el.addEventListener("model-loaded", () => {
      this.setupModel();
    });
  },
  
  setupModel: function() {
    const el = this.el;
    const model = el.getObject3D("mesh");
    
    if (!model) {
      console.warn("Model not loaded yet");
      return;
    }
    
    screenObject = null;
    fbxMeshes = [];
    
    // Traverse model to find screen and collect meshes
    model.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase();
        
        // Look for screen objects
        if (
          name.includes("screen") ||
          name.includes("display") ||
          name.includes("monitor") ||
          name.includes("panel") ||
          name.includes("projection") ||
          name.includes("canvas")
        ) {
          screenObject = child;
          // Keep screen visible
          screenObject.visible = true;
        } else {
          // Store other meshes for color control
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          if (material) {
            material.color = new THREE.Color(0xffffff);
            material.needsUpdate = true;
          }
          
          fbxMeshes.push({
            mesh: child,
            name: child.name || "Unnamed",
          });
        }
      }
    });
    
    // If no screen found, use first mesh
    if (!screenObject && model.children.length > 0) {
      model.traverse((child) => {
        if (child.isMesh && !screenObject) {
          screenObject = child;
          screenObject.visible = true;
          fbxMeshes = fbxMeshes.filter((item) => item.mesh !== screenObject);
        }
      });
    }
    
    // Load default background texture
    if (screenObject) {
      this.loadDefaultTexture(screenObject);
    }
    
    // Hide loading screen
    const loadingDiv = document.getElementById("loading");
    if (loadingDiv) {
      loadingDiv.classList.add("hidden");
    }
    
    // Position player on navmesh
    this.positionPlayer();
    
    console.log("Wisdome model loaded with", fbxMeshes.length, "meshes");
    if (screenObject) {
      console.log("Screen object found:", screenObject.name);
    }
  },
  
  loadDefaultTexture: function(screenObject) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      "assets/media/background.jpg",
      (texture) => {
        texture.flipY = true;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        
        const material = Array.isArray(screenObject.material)
          ? screenObject.material[0]
          : screenObject.material;
        
        if (material) {
          if (material.map) material.map.dispose();
          if (material.emissiveMap) material.emissiveMap.dispose();
          material.map = texture;
          material.emissiveMap = texture;
          material.emissive = new THREE.Color(0xffffff);
          material.emissiveIntensity = 1.0;
          material.needsUpdate = true;
        } else {
          screenObject.material = new THREE.MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 1.0,
          });
        }
      },
      undefined,
      () => {}
    );
  },
  
  positionPlayer: function() {
    const rig = document.querySelector("#rig");
    const cam = document.querySelector("#cam");
    
    if (!rig) {
      console.warn("Rig not found");
      return;
    }
    
    // Set starting position
    rig.setAttribute("position", {
      x: 0.24088717289064746,
      y: 2.52,
      z: -1.7162879880386888
    });
    
    // Set starting camera rotation
    if (cam) {
      cam.setAttribute("rotation", {
        x: -9.854874076250143,
        y: 539.726243013233,
        z: 0
      });
    }
    
    console.log("Player positioned at:", rig.getAttribute("position"));
    if (cam) {
      console.log("Camera rotation set to:", cam.getAttribute("rotation"));
    }
  },
  
  createColorGUI: function(fbxMeshes) {
    if (fbxMeshes.length === 0) return;
    
    // GUI will be created here if needed
    // For now, we'll skip it and focus on core functionality
    console.log("GUI would be created for", fbxMeshes.length, "meshes");
  },
});

// Drag and drop functionality
let isDragging = false;
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;

const dropZone = document.getElementById("drop-zone");

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlightScreen(isHighlight) {
  if (!screenObject) return;
  
  const material = Array.isArray(screenObject.material)
    ? screenObject.material[0]
    : screenObject.material;
  
  if (material) {
    if (isHighlight) {
      material.emissive = new THREE.Color(0x0096ff);
      material.emissiveIntensity = 0.5;
    } else {
      material.emissive = new THREE.Color(0x000000);
      material.emissiveIntensity = 0;
    }
  }
}

document.addEventListener("dragenter", (e) => {
  preventDefaults(e);
  if (!isDragging) {
    isDragging = true;
    dropZone.classList.add("drag-over");
    highlightScreen(true);
  }
}, false);

document.addEventListener("dragover", (e) => {
  preventDefaults(e);
  if (!isDragging) {
    isDragging = true;
    dropZone.classList.add("drag-over");
    highlightScreen(true);
  }
}, false);

document.addEventListener("dragleave", (e) => {
  preventDefaults(e);
  if (e.clientX === 0 && e.clientY === 0) {
    isDragging = false;
    dropZone.classList.remove("drag-over");
    highlightScreen(false);
  }
}, false);

document.addEventListener("drop", (e) => {
  preventDefaults(e);
  isDragging = false;
  dropZone.classList.remove("drag-over");
  highlightScreen(false);
  handleDrop(e);
}, false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 0) {
    const file = files[0];
    if (file.type.startsWith("image/")) {
      loadImage(file);
    } else if (file.type.startsWith("video/")) {
      loadVideo(file);
    }
  }
}

function loadImage(file) {
  if (!screenObject) return;
  
  // Make screen visible when loading image
  screenObject.visible = true;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      e.target.result,
      (texture) => {
        // Clean up previous media
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
        
        texture.flipY = true;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        
        const material = Array.isArray(screenObject.material)
          ? screenObject.material[0]
          : screenObject.material;
        
        if (material) {
          if (material.map) material.map.dispose();
          if (material.emissiveMap) material.emissiveMap.dispose();
          material.map = texture;
          material.emissiveMap = texture;
          material.emissive = new THREE.Color(0xffffff);
          material.emissiveIntensity = 1.0;
          material.needsUpdate = true;
          material.transparent = false;
          material.opacity = 1.0;
        } else {
          screenObject.material = new THREE.MeshStandardMaterial({
            map: texture,
            emissiveMap: texture,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 1.0,
            transparent: false,
            opacity: 1.0,
          });
        }
        
        currentImageTexture = texture;
        
        // Visual feedback
        const mat = Array.isArray(screenObject.material)
          ? screenObject.material[0]
          : screenObject.material;
        if (mat) {
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveIntensity = 0.3;
          setTimeout(() => {
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0;
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
  
  // Make screen visible when loading video
  screenObject.visible = true;
  
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  
  video.addEventListener("loadedmetadata", () => {
    video.play();
    
    // Clean up previous media
    if (currentVideoTexture) {
      currentVideoTexture.dispose();
    }
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
    videoTexture.flipY = true;
    videoTexture.wrapS = THREE.RepeatWrapping;
    videoTexture.wrapT = THREE.RepeatWrapping;
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    
    const material = Array.isArray(screenObject.material)
      ? screenObject.material[0]
      : screenObject.material;
    
    if (material) {
      if (material.map) material.map.dispose();
      if (material.emissiveMap) material.emissiveMap.dispose();
      material.map = videoTexture;
      material.emissiveMap = videoTexture;
      material.emissive = new THREE.Color(0xffffff);
      material.emissiveIntensity = 1.0;
      material.needsUpdate = true;
      material.transparent = false;
      material.opacity = 1.0;
    } else {
      screenObject.material = new THREE.MeshStandardMaterial({
        map: videoTexture,
        emissiveMap: videoTexture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 1.0,
        transparent: false,
        opacity: 1.0,
      });
    }
    
    currentVideoTexture = videoTexture;
    currentVideo = video;
    
    // Update video texture in animation loop
    const scene = document.querySelector("a-scene");
    scene.addEventListener("renderstart", function updateVideoTexture() {
      if (currentVideoTexture && currentVideo && !currentVideo.paused) {
        currentVideoTexture.needsUpdate = true;
      }
    });
    
    // Visual feedback
    const mat = Array.isArray(screenObject.material)
      ? screenObject.material[0]
      : screenObject.material;
    if (mat) {
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveIntensity = 0.3;
      setTimeout(() => {
        mat.emissive = new THREE.Color(0x000000);
        mat.emissiveIntensity = 0;
      }, 200);
    }
  });
  
  video.addEventListener("error", () => {});
}

// Log camera values (press 'C' key)
document.addEventListener("keydown", (e) => {
  if (e.key === "c" || e.key === "C") {
    const rig = document.querySelector("#rig");
    const cam = document.querySelector("#cam");
    if (rig && cam) {
      const pos = rig.getAttribute("position");
      const rot = cam.getAttribute("rotation");
      console.log("Rig Position:", pos);
      console.log("Camera Rotation:", rot);
      console.log("Full config:", {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: { x: rot.x, y: rot.y, z: rot.z },
      });
    }
  }
});
