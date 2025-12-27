import * as THREE from "three";
import { configureTexture, applyTextureToScreen, getMaterial } from "./utils.js";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";
import { screenSettings, textureRotationSettings } from "../settings.js";

let screenObject = null;
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;
let currentWebcamStream = null;

export function setScreenObject(obj) {
  screenObject = obj;
}

export function getCurrentVideoTexture() {
  return currentVideoTexture;
}

export function getCurrentVideo() {
  return currentVideo;
}

export function getCurrentImageTexture() {
  return currentImageTexture;
}

export function loadDefaultScreenTexture(imagePath = screenSettings.defaultImage || "assets/media/background.jpg") {
  if (!screenObject) return;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    imagePath,
    (texture) => {
      configureTexture(texture);
      texture.rotation = 0; // Reset rotation when loading new texture
      applyTextureToScreen(texture, screenObject);
      currentImageTexture = texture;
    },
    undefined,
    () => {}
  );
}

export function loadImage(file) {
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
        texture.rotation = 0; // Reset rotation when loading new texture
        applyTextureToScreen(texture, screenObject);
        currentImageTexture = texture;
        
        // Disable auto-rotate and reset rotation when user uploads an image
        textureRotationSettings.enabled = false;
        if (currentImageTexture) currentImageTexture.rotation = 0;

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

export function loadVideo(file) {
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
    videoTexture.rotation = 0; // Reset rotation when loading new texture

    applyTextureToScreen(videoTexture, screenObject);
    currentVideoTexture = videoTexture;
    currentVideo = video;
    
    // Disable auto-rotate and reset rotation when user uploads a video
    textureRotationSettings.enabled = false;
    if (currentVideoTexture) currentVideoTexture.rotation = 0;

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

export function connectWebcam() {
  if (!screenObject) return;

  // Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Webcam access is not available in your browser.");
    return;
  }

  // Request webcam access
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then((stream) => {
      // Cleanup previous sources
      if (currentVideoTexture) {
        currentVideoTexture.dispose();
        currentVideoTexture = null;
      }
      if (currentVideo) {
        currentVideo.pause();
        currentVideo.srcObject = null;
        currentVideo = null;
      }
      if (currentImageTexture) {
        currentImageTexture.dispose();
        currentImageTexture = null;
      }
      if (currentWebcamStream) {
        currentWebcamStream.getTracks().forEach((track) => track.stop());
        currentWebcamStream = null;
      }

      // Create video element for webcam stream
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      video.addEventListener("loadedmetadata", () => {
        video.play();

        const videoTexture = new THREE.VideoTexture(video);
        configureTexture(videoTexture);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.rotation = 0;

        applyTextureToScreen(videoTexture, screenObject);
        currentVideoTexture = videoTexture;
        currentVideo = video;
        currentWebcamStream = stream;
        
        // Disable auto-rotate and reset rotation when webcam is connected
        textureRotationSettings.enabled = false;
        if (currentVideoTexture) currentVideoTexture.rotation = 0;

        // Brief flash effect
        const material = getMaterial(screenObject);
        if (material) {
          setTimeout(() => {
            Object.assign(material, SCREEN_MATERIAL_SETTINGS);
            material.needsUpdate = true;
          }, 200);
        }
      });

      video.addEventListener("error", () => {
        alert("Error accessing webcam.");
      });
    })
    .catch((error) => {
      console.error("Error accessing webcam:", error);
      alert("Could not access webcam. Please check permissions.");
    });
}

export function disconnectWebcam() {
  if (currentWebcamStream) {
    currentWebcamStream.getTracks().forEach((track) => track.stop());
    currentWebcamStream = null;
  }
  if (currentVideoTexture) {
    currentVideoTexture.dispose();
    currentVideoTexture = null;
  }
  if (currentVideo) {
    currentVideo.pause();
    currentVideo.srcObject = null;
    currentVideo = null;
  }
  // Optionally load default texture when disconnecting
  // loadDefaultScreenTexture();
}

export function setupDragAndDrop() {
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

  document.addEventListener(
    "dragenter",
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("drag-over");
      highlightScreen(true);
    },
    false
  );

  document.addEventListener(
    "dragover",
    (e) => {
      preventDefaults(e);
      dropZone.classList.add("drag-over");
      highlightScreen(true);
    },
    false
  );

  document.addEventListener(
    "dragleave",
    (e) => {
      preventDefaults(e);
      if (e.clientX === 0 && e.clientY === 0) {
        dropZone.classList.remove("drag-over");
        highlightScreen(false);
      }
    },
    false
  );

  document.addEventListener(
    "drop",
    (e) => {
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
    },
    false
  );
}
