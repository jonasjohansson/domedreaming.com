import * as THREE from "three";
import { canvas, camera } from "./scene.js";
import { cameraSettings } from "./settings.js";

// State variables
export let isPointerLocked = false;
export let isTouching = false;
export let euler = new THREE.Euler(0, 0, 0, "YXZ");
export let modelLoaded = false;
export let touchStartX = 0;
export let touchStartY = 0;
export let keys = {};
export let qeRotationSpeed = 0;

export function setModelLoaded(value) {
  modelLoaded = value;
}

export function setQeRotationSpeed(value) {
  qeRotationSpeed = value;
}

export function setupCameraControls() {
  // Pointer lock
  function requestPointerLock() {
    const request = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
    if (request) request.call(canvas);
  }

  function onPointerLockChange() {
    const wasLocked = isPointerLocked;
    isPointerLocked =
      document.pointerLockElement === canvas || document.mozPointerLockElement === canvas || document.webkitPointerLockElement === canvas;

    if (!wasLocked && isPointerLocked && modelLoaded) {
      euler.setFromQuaternion(camera.quaternion);
    }
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mozpointerlockchange", onPointerLockChange);
  document.addEventListener("webkitpointerlockchange", onPointerLockChange);

  canvas.addEventListener("click", () => {
    // Enter dome mode (fade overlays, request pointer lock, disable scroll)
    if (!isPointerLocked && window.enterDomeModeFromCanvas) {
      window.enterDomeModeFromCanvas();
    }
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
  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (!modelLoaded) return;
      event.preventDefault();
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isTouching = true;
      euler.setFromQuaternion(camera.quaternion);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
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
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (event) => {
      event.preventDefault();
      isTouching = false;
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchcancel",
    (event) => {
      event.preventDefault();
      isTouching = false;
    },
    { passive: false }
  );

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
