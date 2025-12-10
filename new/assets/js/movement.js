import * as THREE from "three";
import { camera } from "./scene.js";
import { CAMERA_HEIGHT, NAVMESH_SEARCH_BOX } from "./config.js";
import { moveSpeed, cameraSettings } from "./settings.js";
import { keys, qeRotationSpeed, euler, modelLoaded, setQeRotationSpeed } from "./camera.js";

let navMeshQuery = null;

export function setNavMeshQuery(query) {
  navMeshQuery = query;
}

export function updateMovement() {
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
  if (keys["q"] || keys["Q"]) {
    setQeRotationSpeed(-cameraSettings.rotationSpeed * (Math.PI / 180));
  } else if (keys["e"] || keys["E"]) {
    setQeRotationSpeed(cameraSettings.rotationSpeed * (Math.PI / 180));
  } else {
    setQeRotationSpeed(0);
  }

  if (qeRotationSpeed !== 0 && modelLoaded) {
    euler.y += qeRotationSpeed * deltaTime;
    camera.quaternion.setFromEuler(euler);
  }
}
