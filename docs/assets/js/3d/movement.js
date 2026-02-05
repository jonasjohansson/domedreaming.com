import * as THREE from "three";
import { camera } from "./scene.js";
import { CAMERA_HEIGHT, NAVMESH_SEARCH_BOX } from "./config.js";
import * as settings from "../core/settings.js";
import { keys, qeRotationSpeed, euler, modelLoaded, setQeRotationSpeed } from "./camera.js";
import { hotspots } from "./model.js";

let navMeshQuery = null;

// Touch movement state
export let touchMovement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  rotateLeft: false,  // Q key
  rotateRight: false  // E key
};

export function setNavMeshQuery(query) {
  navMeshQuery = query;
}

export function updateMovement() {
  // Don't allow movement until model is loaded
  if (!modelLoaded) return;
  
  camera.updateMatrixWorld();

  const forward = new THREE.Vector3();
  forward.setFromMatrixColumn(camera.matrixWorld, 2);
  forward.multiplyScalar(-1).normalize();

  const right = new THREE.Vector3();
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  right.normalize();

  const movement = new THREE.Vector3();
  const currentMoveSpeed = settings.moveSpeed;
  // Keyboard controls
  if (keys["w"]) movement.add(forward.clone().multiplyScalar(currentMoveSpeed));
  if (keys["s"]) movement.add(forward.clone().multiplyScalar(-currentMoveSpeed));
  if (keys["a"]) movement.add(right.clone().multiplyScalar(-currentMoveSpeed));
  if (keys["d"]) movement.add(right.clone().multiplyScalar(currentMoveSpeed));
  // Touch controls - double speed for mobile
  const touchMoveSpeed = currentMoveSpeed * 2;
  if (touchMovement.forward) movement.add(forward.clone().multiplyScalar(touchMoveSpeed));
  if (touchMovement.backward) movement.add(forward.clone().multiplyScalar(-touchMoveSpeed));
  if (touchMovement.left) movement.add(right.clone().multiplyScalar(-touchMoveSpeed));
  if (touchMovement.right) movement.add(right.clone().multiplyScalar(touchMoveSpeed));

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

export function constrainToNavmesh() {
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

export function updateRotation(deltaTime) {
  // Q/E rotation
  // Q/E keyboard rotation (Q = right, E = left)
  if (keys["q"] || keys["Q"]) {
    setQeRotationSpeed(settings.cameraSettings.rotationSpeed * (Math.PI / 180));
  } else if (keys["e"] || keys["E"]) {
    setQeRotationSpeed(-settings.cameraSettings.rotationSpeed * (Math.PI / 180));
  } else {
    setQeRotationSpeed(0);
  }

  // Q/E keyboard rotation
  if (qeRotationSpeed !== 0 && modelLoaded) {
    euler.y += qeRotationSpeed * deltaTime;
    camera.quaternion.setFromEuler(euler);
  }
  
  // Q/E touch/button rotation
  if (modelLoaded) {
    const rotationSpeed = 1.5; // Rotation speed in radians per second
    if (touchMovement.rotateLeft) {
      euler.y += rotationSpeed * deltaTime; // Rotate right (increase y) - Q button
      camera.quaternion.setFromEuler(euler);
    }
    if (touchMovement.rotateRight) {
      euler.y -= rotationSpeed * deltaTime; // Rotate left (decrease y) - E button
      camera.quaternion.setFromEuler(euler);
    }
  }
}

export function checkHotspots() {
  if (!modelLoaded || !hotspots || hotspots.length === 0) return;

  const HOTSPOT_TRIGGER_DISTANCE = 0.4; // Distance in units to trigger hotspot (avatar walking over it)

  // Iterate backwards to safely remove items
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const hotspot = hotspots[i];
    if (!hotspot || !hotspot.object || hotspot.triggered) continue; // Already removed or triggered

    // Calculate horizontal distance (ignore Y difference for walking over)
    const dx = camera.position.x - hotspot.position.x;
    const dz = camera.position.z - hotspot.position.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);

    if (horizontalDistance < HOTSPOT_TRIGGER_DISTANCE) {
      // Mark as triggered immediately to prevent multiple alerts
      hotspot.triggered = true;

      // Remove hotspot from scene
      if (hotspot.object.parent) {
        hotspot.object.parent.remove(hotspot.object);
      }
      // Remove from array
      hotspots.splice(i, 1);
      // Show alert (only once)
      alert("");
      console.log(`Hotspot ${hotspot.name} triggered and removed`);
      break; // Exit loop after triggering one hotspot
    }
  }
}
