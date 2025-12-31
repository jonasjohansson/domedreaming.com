import { scene, camera, renderer, canvas, resetCamera } from "./3d/scene.js";
import { setupLighting } from "./3d/lighting.js";
import { initPostProcessing, updatePostProcessing } from "./3d/postprocessing.js";
import { setupCameraControls, euler } from "./3d/camera.js";
import { updateMovement, updateRotation } from "./3d/movement.js";
import { loadModel, fbxMeshes, glbLights } from "./3d/model.js";
import {
  loadSettings,
  currentCameraPosition,
  currentCameraRotation,
  startCameraPosition,
  startCameraRotation,
  saveSettings,
} from "./core/settings.js";
import { initScrollIncrement } from "./layout/scroll-increment.js";
import { initGridDotsSystem } from "./layout/grid-dots.js";
import { initDashboard } from "./ui/dashboard.js";
import { initResponsiveHeights } from "./layout/responsive-height.js";
import { getCurrentImageTexture, getCurrentVideoTexture, connectWebcam, loadImage, loadVideo, disconnectWebcam, loadDefaultScreenTexture } from "./3d/texture.js";
import { textureRotationSettings } from "./core/settings.js";
import { updateViewportHeightCSS } from "./core/utils.js";
import { updateScreenLighting } from "./3d/screen-lighting.js";
import { touchMovement } from "./3d/movement.js";

let animationFrameId = null;
let lastTime = 0;
let lastCameraSaveTime = 0;
const CAMERA_SAVE_INTERVAL = 2000;

// Canvas container height is now handled by CSS (100% of page-section)
// No JavaScript height setting needed

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
    }, 50);
  }

  // Create file input for uploads (reusable)
  let fileInput = null;
  function getFileInput() {
    if (!fileInput) {
      fileInput = document.createElement("input");
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
    }
    return fileInput;
  }

  // Handle links outside dome mode
  const webcamLink = document.getElementById("connect-webcam-link");
  if (webcamLink) {
    webcamLink.addEventListener("click", (e) => {
      e.preventDefault();
      connectWebcam();
    });
  }

  const uploadFileLink = document.getElementById("upload-file-link");
  if (uploadFileLink) {
    uploadFileLink.addEventListener("click", (e) => {
      e.preventDefault();
      getFileInput().click();
    });
  }


  // Handle keyboard layout buttons
  const keyboardUploadBtn = document.getElementById("keyboard-upload-btn");
  if (keyboardUploadBtn) {
    keyboardUploadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      getFileInput().click();
    });
  }

  // Reset function: reset camera, clear textures, stop webcam
  window.resetToDefaults = function() {
    try {
      // Disconnect webcam if active
      disconnectWebcam();
      
      // Load default texture (this will dispose of current textures internally)
      loadDefaultScreenTexture();
      
      // Reset camera to original position and rotation
      resetCamera(startCameraPosition, startCameraRotation, euler);
      
      // Update current camera position/rotation tracking
      Object.assign(currentCameraPosition, startCameraPosition);
      Object.assign(currentCameraRotation, startCameraRotation);
    } catch (error) {
      console.error("Error during reset:", error);
    }
  };

  // Set up reset button handler
  function setupResetButton() {
    const resetBtn = document.getElementById("keyboard-reset-btn");
    if (resetBtn) {
      const handleReset = function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (window.resetToDefaults) {
          window.resetToDefaults();
        }
        return false;
      };
      
      // Remove ALL existing event listeners by cloning and replacing
      const newBtn = resetBtn.cloneNode(true);
      resetBtn.parentNode.replaceChild(newBtn, resetBtn);
      
      // Set inline onclick (highest priority)
      newBtn.onclick = handleReset;
      
      // Add event listeners with capture phase
      newBtn.addEventListener("click", handleReset, { capture: true, passive: false });
      newBtn.addEventListener("touchend", handleReset, { capture: true, passive: false });
      
      return true;
    }
    return false;
  }
  
  // Set up camera button handler - asks for permission
  function setupCameraButton() {
    const cameraBtn = document.getElementById("keyboard-camera-btn");
    if (cameraBtn) {
      const handleCamera = function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Ask user if they want to connect webcam
        if (confirm("Do you want to connect your webcam to the screen?")) {
          connectWebcam();
        }
        return false;
      };
      
      // Remove ALL existing event listeners by cloning and replacing
      const newBtn = cameraBtn.cloneNode(true);
      cameraBtn.parentNode.replaceChild(newBtn, cameraBtn);
      
      // Set inline onclick
      newBtn.onclick = handleCamera;
      
      // Add event listeners
      newBtn.addEventListener("click", handleCamera, { capture: true, passive: false });
      newBtn.addEventListener("touchend", handleCamera, { capture: true, passive: false });
      
      return true;
    }
    return false;
  }
  
  // Set up both buttons
  setupResetButton();
  setupCameraButton();
  
  // Retry if not found
  setTimeout(() => {
    if (!document.getElementById("keyboard-reset-btn")) {
      setupResetButton();
    }
    if (!document.getElementById("keyboard-camera-btn")) {
      setupCameraButton();
    }
  }, 500);

  // keyboardExitBtn is now handled in initDomeMode() to support both enter and exit

  // WASD button controls (keyboard layout)
  const wasdButtons = document.querySelectorAll(".wasd-key-btn");
  
  wasdButtons.forEach((btn) => {
      const key = btn.getAttribute("data-key");
      if (!key) return;

      // Touch start
      btn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add("active");
        if (key === "w") touchMovement.forward = true;
        if (key === "s") touchMovement.backward = true;
        if (key === "a") touchMovement.left = true;
        if (key === "d") touchMovement.right = true;
        if (key === "q") touchMovement.rotateLeft = true;
        if (key === "e") touchMovement.rotateRight = true;
      });

      // Touch end - always remove active state
      btn.addEventListener("touchend", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("active");
        if (key === "w") touchMovement.forward = false;
        if (key === "s") touchMovement.backward = false;
        if (key === "a") touchMovement.left = false;
        if (key === "d") touchMovement.right = false;
        if (key === "q") touchMovement.rotateLeft = false;
        if (key === "e") touchMovement.rotateRight = false;
      });

      // Touch cancel - also remove active state
      btn.addEventListener("touchcancel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("active");
        if (key === "w") touchMovement.forward = false;
        if (key === "s") touchMovement.backward = false;
        if (key === "a") touchMovement.left = false;
        if (key === "d") touchMovement.right = false;
        if (key === "q") touchMovement.rotateLeft = false;
        if (key === "e") touchMovement.rotateRight = false;
      });

      // Mouse events for testing
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add("active");
        if (key === "w") touchMovement.forward = true;
        if (key === "s") touchMovement.backward = true;
        if (key === "a") touchMovement.left = true;
        if (key === "d") touchMovement.right = true;
        if (key === "q") touchMovement.rotateLeft = true;
        if (key === "e") touchMovement.rotateRight = true;
      });

      // Mouse up - always remove active state
      btn.addEventListener("mouseup", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("active");
        if (key === "w") touchMovement.forward = false;
        if (key === "s") touchMovement.backward = false;
        if (key === "a") touchMovement.left = false;
        if (key === "d") touchMovement.right = false;
        if (key === "q") touchMovement.rotateLeft = false;
        if (key === "e") touchMovement.rotateRight = false;
      });

      // Mouse leave - remove active state if mouse leaves button
      btn.addEventListener("mouseleave", (e) => {
        btn.classList.remove("active");
        if (key === "w") touchMovement.forward = false;
        if (key === "s") touchMovement.backward = false;
        if (key === "a") touchMovement.left = false;
        if (key === "d") touchMovement.right = false;
        if (key === "q") touchMovement.rotateLeft = false;
        if (key === "e") touchMovement.rotateRight = false;
      });

      // Click - ensure active state is removed
      btn.addEventListener("click", (e) => {
        btn.classList.remove("active");
      });

      btn.addEventListener("mouseleave", () => {
        btn.classList.remove("active");
        if (key === "w") touchMovement.forward = false;
        if (key === "s") touchMovement.backward = false;
        if (key === "a") touchMovement.left = false;
        if (key === "d") touchMovement.right = false;
        if (key === "q") touchMovement.rotateLeft = false;
        if (key === "e") touchMovement.rotateRight = false;
      });
    });

  const handleResize = () => {
    updateViewportHeightCSS();
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
  updateRotation(deltaTime);

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

  updateTextureRotation(deltaTime);
  updateScreenLighting(currentTime);

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
  const keyboardExitBtn = document.getElementById("keyboard-exit-btn");
  const body = document.body;

  function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
           "ontouchstart" in window || 
           navigator.maxTouchPoints > 0;
  }

  function updateEnterExitButton() {
    if (keyboardExitBtn) {
      if (body.classList.contains("dome-mode")) {
        if (isMobile()) {
          // On mobile, show "exit" button
          keyboardExitBtn.textContent = "exit";
          keyboardExitBtn.style.display = "flex";
        } else {
          // On desktop, hide the button (user presses ESC to exit)
          keyboardExitBtn.style.display = "none";
        }
      } else {
        // Not in dome mode, show "enter" button
        keyboardExitBtn.textContent = "enter";
        keyboardExitBtn.style.display = "flex";
      }
    }
  }

  function enterDomeMode(shouldRequestPointerLock = false) {
    if (body.classList.contains("dome-mode")) return;

    body.classList.add("dome-mode");
    document.documentElement.style.overflow = "hidden";
    updateEnterExitButton();

    const canvasContainer = document.getElementById("canvas-container");
    if (canvasContainer) {
      const actualVh = getComputedStyle(document.documentElement).getPropertyValue("--actual-vh");
      canvasContainer.style.height = actualVh || "100vh";
      canvasContainer.style.width = "100vw";

      // Trigger resize to update canvas and camera
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 0);
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (shouldRequestPointerLock && canvas && !isMobile) {
      // Request pointer lock after a small delay to ensure canvas is ready
      // Browsers require user interaction, so this should be called from a click handler
      setTimeout(() => {
      const requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
      if (requestPointerLock) {
        requestPointerLock.call(canvas);
      }
      }, 100);
    }

    if (isMobile) {
    }
  }

  function exitDomeMode() {
    // Exit pointer lock first if active
    if (
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas)
    ) {
      document.exitPointerLock();
    }

    // Then exit dome mode
    if (body.classList.contains("dome-mode")) {
      body.classList.remove("dome-mode");
      document.documentElement.style.overflow = "auto";

      const canvasContainer = document.getElementById("canvas-container");
      if (canvasContainer) {
        // Reset width to default (remove inline style to let CSS handle it)
        canvasContainer.style.width = "";
      }
      updateEnterExitButton();
    }
  }

  window.enterDomeModeFromCanvas = () => {
    enterDomeMode(true);
  };

  // Keyboard enter/exit button - behaves like old "dome simulator" link
  if (keyboardExitBtn) {
    // Click event - exactly like old "dome simulator" link
    keyboardExitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // If not in dome mode, enter (exactly like old link)
      if (!body.classList.contains("dome-mode")) {
        enterDomeMode(true);
      } else if (isMobile()) {
        // Only allow exit on mobile when already in dome mode
        exitDomeMode();
      }
      // On desktop when in dome mode, do nothing (user presses ESC)
    });
    
    // Touch event - exactly like old "dome simulator" link
    keyboardExitBtn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      // If not in dome mode, enter (exactly like old link)
      if (!body.classList.contains("dome-mode")) {
      enterDomeMode(true);
      } else if (isMobile()) {
        // Only allow exit on mobile when already in dome mode
        exitDomeMode();
      }
      // On desktop when in dome mode, do nothing (user presses ESC)
    });
  }

  // Initialize button text
  updateEnterExitButton();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("dome-mode")) {
      // If pointer lock is active, ESC will exit it first, then onPointerLockChange will call exitDomeMode
      // If pointer lock is not active, exit dome mode directly
      if (
        !canvas ||
        (document.pointerLockElement !== canvas &&
          document.mozPointerLockElement !== canvas &&
          document.webkitPointerLockElement !== canvas)
      ) {
      exitDomeMode();
      } else {
        // Pointer lock is active, exit it (which will trigger onPointerLockChange to exit dome mode)
        document.exitPointerLock();
      }
    }
  });

  function onPointerLockChange() {
    const isLocked =
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || "ontouchstart" in window || navigator.maxTouchPoints > 0;
    // If pointer lock is lost while in dome mode (user pressed ESC), exit dome mode
    if (!isLocked && body.classList.contains("dome-mode") && !isMobile) {
      // Exit dome mode when pointer lock is lost (user pressed ESC)
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
