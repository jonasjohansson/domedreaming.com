import { scene, camera, renderer, canvas } from "./3d/scene.js";
import { setupLighting } from "./3d/lighting.js";
import { initPostProcessing, updatePostProcessing } from "./3d/postprocessing.js";
import { setupCameraControls } from "./3d/camera.js";
import { updateMovement } from "./3d/movement.js";
import { loadModel, fbxMeshes, glbLights } from "./3d/model.js";
import {
  loadSettings,
  canvasSettings,
  currentCameraPosition,
  currentCameraRotation,
  startCameraPosition,
  startCameraRotation,
  saveSettings,
} from "./settings.js";
import { updateLEDAnimation } from "./3d/led-strip.js";
import { initScrollIncrement } from "./scroll-increment.js";
import { initGridDotsSystem } from "./grid-dots.js";
import { initDashboard } from "./dashboard.js";
import { initResponsiveHeights } from "./responsive-height.js";
import { initASCIIDecorative } from "./ascii-decorative.js";
import { getCurrentImageTexture, getCurrentVideoTexture, connectWebcam, loadImage, loadVideo } from "./3d/texture.js";
import { textureRotationSettings } from "./settings.js";
import { getRowHeight, updateViewportHeightCSS } from "./utils.js";

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000;


function setCanvasHeight() {
  const canvasContainer = document.getElementById("canvas-container");
  const canvasWrapper = document.querySelector(".canvas-wrapper");
  if (!canvasContainer || !canvasWrapper) return;

  const rowHeight = getRowHeight();
  const targetHeight = rowHeight * 10;

  canvasContainer.style.height = `${targetHeight}px`;
  canvasContainer.style.padding = "0";
  canvasContainer.style.margin = "0";
  canvasWrapper.style.height = `${targetHeight}px`;
}

function applyDomeDreamingFont() {
  const mainElement = document.querySelector("main");
  if (!mainElement) return;

  const walker = document.createTreeWalker(mainElement, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.classList.contains("dome-dreaming-text")) continue;
    if (/dome\s+dreaming/i.test(node.textContent)) {
      textNodes.push(node);
    }
  }

  textNodes.forEach((textNode) => {
    const parent = textNode.parentNode;
    if (!parent) return;

    const text = textNode.textContent;
    const regex = /(dome\s+dreaming)/gi;
    const parts = text.split(regex);

    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part && /^dome\s+dreaming$/i.test(part)) {
        const span = document.createElement("span");
        span.className = "dome-dreaming-text";
        span.textContent = part;
        fragment.appendChild(span);
      } else if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });

    parent.replaceChild(fragment, textNode);
  });
}


async function init() {
  await loadSettings();

  updateViewportHeightCSS();

  initScrollIncrement();
  initGridDotsSystem();
  initResponsiveHeights();
  initDashboard();
  applyDomeDreamingFont();

  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        setupLighting();
        initPostProcessing();
        setupCameraControls();
      },
      { timeout: 1000 }
    );
  } else {
    setTimeout(() => {
      setupLighting();
      initPostProcessing();
      setupCameraControls();
      initParallaxLayer();
    }, 50);
  }

  const webcamLink = document.getElementById("connect-webcam-link");
  if (webcamLink) {
    webcamLink.addEventListener("click", (e) => {
      e.preventDefault();
      connectWebcam();
    });
  }

  const uploadFileLink = document.getElementById("upload-file-link");
  if (uploadFileLink) {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*,video/*";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.type.startsWith("image/")) {
          loadImage(file);
        } else if (file.type.startsWith("video/")) {
          loadVideo(file);
        }
      }
      fileInput.value = "";
    });

    uploadFileLink.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  setCanvasHeight();

  const handleResize = () => {
    updateViewportHeightCSS();
    setCanvasHeight();
  };
  window.addEventListener("resize", handleResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
  }

  window.addEventListener("orientationchange", () => {
    setTimeout(handleResize, 100);
  });


  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        loadModel();
        startRenderLoop();
      },
      { timeout: 2000 }
    );
  } else {
    requestAnimationFrame(() => {
      setTimeout(() => {
        loadModel();
        startRenderLoop();
      }, 100);
    });
  }
}

function animate(currentTime) {
  animationFrameId = requestAnimationFrame(animate);

  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  updateMovement();

  currentCameraPosition.x = camera.position.x;
  currentCameraPosition.y = camera.position.y;
  currentCameraPosition.z = camera.position.z;
  currentCameraRotation.x = camera.rotation.x;
  currentCameraRotation.y = camera.rotation.y;
  currentCameraRotation.z = camera.rotation.z;

  const timeSinceLastSave = currentTime - lastCameraSaveTime;
  if (timeSinceLastSave >= CAMERA_SAVE_INTERVAL) {
    Object.assign(startCameraPosition, currentCameraPosition);
    Object.assign(startCameraRotation, currentCameraRotation);
    saveSettings(fbxMeshes, glbLights);
    lastCameraSaveTime = currentTime;
  }

  updateLEDAnimation(deltaTime);
  updateTextureRotation(deltaTime);

  updatePostProcessing();
}

function updateTextureRotation(deltaTime) {
  if (!textureRotationSettings.enabled) return;

  const imageTexture = getCurrentImageTexture();
  const videoTexture = getCurrentVideoTexture();
  const texture = imageTexture || videoTexture;

  if (texture) {
    if (!texture.center || texture.center.x !== 0.5 || texture.center.y !== 0.5) {
      if (!texture.center) {
        texture.center = new THREE.Vector2(0.5, 0.5);
      } else {
        texture.center.set(0.5, 0.5);
      }
    }
    
    texture.rotation -= textureRotationSettings.speed * deltaTime;
    
    while (texture.rotation < 0) {
      texture.rotation += Math.PI * 2;
    }
  }
}

function startRenderLoop() {
  lastTime = performance.now();
  animate(lastTime);
}

function initDomeMode() {
  const enterDomeBtn = document.getElementById("enter-dome-btn");
  const body = document.body;

  function enterDomeMode(shouldRequestPointerLock = false) {
    if (body.classList.contains("dome-mode")) return;

    body.classList.add("dome-mode");
    document.documentElement.style.overflow = "hidden";

    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
      const actualVh = getComputedStyle(document.documentElement).getPropertyValue("--actual-vh");
      canvasContainer.style.height = actualVh || "100vh";
      canvasContainer.style.width = "100vw";
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (shouldRequestPointerLock && canvas && !isMobile) {
      const requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
      if (requestPointerLock) {
        requestPointerLock.call(canvas);
      }
    }

    if (isMobile) {
    }
  }

  function exitDomeMode() {
    if (body.classList.contains("dome-mode")) {
      body.classList.remove("dome-mode");
      document.documentElement.style.overflow = "auto";

      const canvasContainer = document.getElementById("canvas-container");
      if (canvasContainer) {
        setCanvasHeight();
        // Reset width to default (remove inline style to let CSS handle it)
        canvasContainer.style.width = "";
      }
    }
    if (
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas)
    ) {
      document.exitPointerLock();
    }
  }

  window.enterDomeModeFromCanvas = () => {
    enterDomeMode(true);
  };

  if (enterDomeBtn && canvas) {
    enterDomeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      enterDomeMode(true);
    });
    enterDomeBtn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      enterDomeMode(true);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      exitDomeMode();
    }
  });

  function onPointerLockChange() {
    const isLocked =
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isLocked && body.classList.contains("dome-mode") && !isMobile) {
      exitDomeMode();
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init();
    initDomeMode();
  });
} else {
  init();
  initDomeMode();
}
