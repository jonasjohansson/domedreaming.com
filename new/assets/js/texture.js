import * as THREE from "three";
import { configureTexture, applyTextureToScreen, getMaterial } from "./utils.js";
import { SCREEN_MATERIAL_SETTINGS } from "./config.js";

let screenObject = null;
let currentVideoTexture = null;
let currentVideo = null;
let currentImageTexture = null;

export function setScreenObject(obj) {
  screenObject = obj;
}

export function getCurrentVideoTexture() {
  return currentVideoTexture;
}

export function getCurrentVideo() {
  return currentVideo;
}

export function loadDefaultScreenTexture() {
  if (!screenObject) return;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    "assets/media/background.jpg",
    (texture) => {
      configureTexture(texture);
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
        applyTextureToScreen(texture, screenObject);
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

    applyTextureToScreen(videoTexture, screenObject);
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

