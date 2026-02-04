/**
 * Dome Mode - Fullscreen immersive mode for the 3D dome experience
 */
import { isMobile } from "../core/utils.js";

let canvas = null;
let stopAudioFn = null;
let startAudioFn = null;
let isExitingDomeMode = false;
let usingPointerLock = false;

/**
 * Set the canvas reference (called after 3D loads)
 */
export function setCanvas(canvasElement) {
  canvas = canvasElement;
}

/**
 * Set the audio functions (called after 3D modules load)
 */
export function setAudioFunctions(start, stop) {
  startAudioFn = start;
  stopAudioFn = stop;
}

/**
 * Initialize dome mode functionality
 */
export function initDomeMode() {
  const keyboardExitBtn = document.getElementById("keyboard-exit-btn");
  const body = document.body;

  function updateEnterExitButton() {
    if (keyboardExitBtn) {
      if (body.classList.contains("dome-mode")) {
        if (isMobile()) {
          keyboardExitBtn.textContent = "exit";
          keyboardExitBtn.style.display = "flex";
        } else {
          keyboardExitBtn.style.display = "none";
        }
      } else {
        keyboardExitBtn.textContent = "enter";
        keyboardExitBtn.style.display = "flex";
        keyboardExitBtn.disabled = false;
        keyboardExitBtn.style.pointerEvents = "auto";
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

      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 0);
    }

    const mobile = isMobile();
    usingPointerLock = shouldRequestPointerLock && !mobile;

    if (shouldRequestPointerLock && canvas && !mobile) {
      const isAlreadyLocked =
        document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas;

      if (!isAlreadyLocked) {
        const pointerLockTimeout = setTimeout(() => {
          if (!body.classList.contains("dome-mode") || isExitingDomeMode) {
            return;
          }

          const requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
          if (requestPointerLock) {
            try {
              requestPointerLock.call(canvas).catch((error) => {
                if (error.name !== "SecurityError" && error.name !== "NotAllowedError") {
                  console.warn("Pointer lock request failed:", error);
                }
              });
            } catch (error) {
              if (error.name !== "SecurityError" && error.name !== "NotAllowedError") {
                console.warn("Pointer lock request failed:", error);
              }
            }
          }
        }, 100);

        window.pointerLockTimeout = pointerLockTimeout;
      }
    }

    setTimeout(() => {
      if (window.setupCameraButton) {
        window.setupCameraButton();
      }
    }, 150);
  }

  function exitDomeMode() {
    if (isExitingDomeMode) {
      return;
    }

    isExitingDomeMode = true;

    if (window.pointerLockTimeout) {
      clearTimeout(window.pointerLockTimeout);
      window.pointerLockTimeout = null;
    }

    if (
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas)
    ) {
      try {
        document.exitPointerLock();
      } catch (error) {
        if (error.name !== "SecurityError") {
          console.warn("Error exiting pointer lock:", error);
        }
      }
    }

    if (body.classList.contains("dome-mode")) {
      body.classList.remove("dome-mode");
      document.documentElement.style.overflow = "auto";

      const canvasContainer = document.getElementById("canvas-container");
      if (canvasContainer) {
        canvasContainer.style.width = "";
      }

      updateEnterExitButton();

      setTimeout(() => {
        if (window.setupCameraButton) {
          window.setupCameraButton();
        }
        setTimeout(() => {
          isExitingDomeMode = false;
        }, 100);
      }, 0);
    } else {
      isExitingDomeMode = false;
    }
  }

  window.enterDomeModeFromCanvas = () => {
    enterDomeMode(true);
  };

  window.enterDomeModeWithAudio = async () => {
    enterDomeMode(false);
    if (startAudioFn) {
      try {
        await startAudioFn();
      } catch (error) {
        console.warn("Could not start audio:", error);
      }
    }
  };

  if (keyboardExitBtn) {
    keyboardExitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!body.classList.contains("dome-mode")) {
        enterDomeMode(true);
      } else if (isMobile()) {
        exitDomeMode();
        if (stopAudioFn) {
          try {
            stopAudioFn();
          } catch (error) {
            console.warn("Could not stop audio:", error);
          }
        }
      }
    });

    keyboardExitBtn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!body.classList.contains("dome-mode")) {
        enterDomeMode(true);
      } else if (isMobile()) {
        exitDomeMode();
        if (stopAudioFn) {
          try {
            stopAudioFn();
          } catch (error) {
            console.warn("Could not stop audio:", error);
          }
        }
      }
    });
  }

  updateEnterExitButton();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && body.classList.contains("dome-mode")) {
      exitDomeMode();
      if (stopAudioFn) {
        try {
          stopAudioFn();
        } catch (error) {
          console.warn("Could not stop audio:", error);
        }
      }
    }
  });

  function onPointerLockChange() {
    if (isExitingDomeMode) {
      return;
    }

    const isLocked =
      canvas &&
      (document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas);
    const mobile = isMobile();

    if (!isLocked && body.classList.contains("dome-mode") && !mobile && usingPointerLock) {
      setTimeout(() => {
        if (
          !isExitingDomeMode &&
          body.classList.contains("dome-mode") &&
          !(
            document.pointerLockElement === canvas ||
            document.mozPointerLockElement === canvas ||
            document.webkitPointerLockElement === canvas
          )
        ) {
          exitDomeMode();
        }
      }, 50);
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);
}
