import * as THREE from "three";
import { scene, renderer, camera } from "./scene.js";

let discoBall = null;
let discoBallGroup = null;
let spotLights = [];
let reflectionLights = []; // Lights that simulate reflections from disco ball
let rotationSpeed = 0.5; // Rotation speed in radians per second
let lightRotationSpeed = 1.0; // Light rotation speed (can be different from ball rotation)
let cubeCamera = null;
let envMap = null;
let envMapUpdateInterval = 0;
const ENV_MAP_UPDATE_INTERVAL = 0.5; // Update environment map every 0.5 seconds

/**
 * Creates an environment map from the scene using CubeCamera
 * This captures the actual room/environment for reflections
 */
function createEnvironmentMap(position, hideDiscoBall = false) {
  // Create a render target for the cube map
  // Increased resolution for higher quality reflections
  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });

  // Create a cube camera to render the scene from 6 directions
  cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
  cubeCamera.position.copy(position);
  
  // Temporarily hide the disco ball so it doesn't reflect itself
  if (hideDiscoBall && discoBall) {
    discoBall.visible = false;
  }
  
  // Update the cube camera to capture the scene
  cubeCamera.update(renderer, scene);
  
  // Restore disco ball visibility
  if (hideDiscoBall && discoBall) {
    discoBall.visible = true;
  }
  
  return cubeRenderTarget.texture;
}

/**
 * Creates a low-poly disco ball with reflective material
 * Uses IcosahedronGeometry for a faceted sphere appearance
 */
function createDiscoBall(radius = 0.5, position = { x: 0, y: 5, z: 0 }) {
  // Create a high-quality sphere with many facets for disco ball effect
  // Increased segments for smoother, higher quality reflections
  const geometry = new THREE.SphereGeometry(
    radius,      // radius (meters)
    256,         // width segments (increased from 128 for better quality)
    256          // height segments (increased from 128 for better quality)
  );
  
  // Create environment map from the scene using CubeCamera
  envMap = createEnvironmentMap(position);
  
  // Create highly reflective material - mirror-like
  // Using flatShading: true makes each face reflect independently (disco ball effect)
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1.0, // Fully metallic for mirror reflection
    roughness: 0.0, // Perfectly smooth for mirror-like reflection
    envMap: envMap, // Use the generated environment map
    envMapIntensity: 1.5, // Boost environment map intensity
    flatShading: true, // Flat shading creates faceted appearance (not smooth/round)
    side: THREE.DoubleSide,
    // Quality improvements
    precision: 'highp', // High precision for better quality
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = false; // Disable shadows for performance
  mesh.receiveShadow = false;
  
  return mesh;
}

/**
 * Creates multiple wide spot lights positioned above and around the disco ball
 * These lights shine ON the disco ball, and the ball's facets reflect them outward
 */
function createDiscoLights(discoBallPosition, count = 4, radius = 3.0) {
  const lights = [];
  
  // Create a few bright lights positioned above the disco ball
  // These will be the main lights that the disco ball reflects
  for (let i = 0; i < count; i++) {
    // Distribute lights around the disco ball, mostly from above
    const angle = (i / count) * Math.PI * 2;
    const height = 1.5 + Math.sin(i * 0.5) * 0.3; // Position above the ball
    
    // Create a WIDE spot light with larger angle for better coverage
    // Parameters: color, intensity, distance, angle (wider = more coverage), penumbra, decay
    const light = new THREE.SpotLight(0xffffff, 5.0, 20, Math.PI / 3, 0.5, 1.0);
    // Math.PI / 3 = 60 degrees (much wider than before)
    // Higher intensity (5.0) and wider angle for better disco ball illumination
    
    // Position light above and around the disco ball
    light.position.set(
      discoBallPosition.x + Math.cos(angle) * radius,
      discoBallPosition.y + height,
      discoBallPosition.z + Math.sin(angle) * radius
    );
    
    // Point the light at the disco ball
    light.target.position.copy(discoBallPosition);
    light.target.updateMatrixWorld();
    
    // Add target to scene (required for spot lights)
    scene.add(light.target);
    scene.add(light);
    
    lights.push({
      light,
      angle,
      baseHeight: height,
      radius,
    });
  }
  
  // Add a bright directional light from above (classic disco ball setup)
  const topLight = new THREE.DirectionalLight(0xffffff, 3.0);
  topLight.position.set(discoBallPosition.x, discoBallPosition.y + 5, discoBallPosition.z);
  topLight.target.position.copy(discoBallPosition);
  scene.add(topLight);
  scene.add(topLight.target);
  
  // Store the directional light separately
  lights.push({
    light: topLight,
    angle: 0,
    baseHeight: 5,
    radius: 0,
    isDirectional: true,
  });
  
  return lights;
}

/**
 * Creates a texture for light projection (disco ball light spots pattern)
 * This creates a circular gradient texture that simulates light spots
 */
function createLightSpotTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Create gradient for light spot (bright center, fading edges)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)'); // Bright white center
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Transparent edges
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates lights that simulate reflections from the disco ball
 * Uses texture-based approach: spot lights positioned at disco ball pointing outward
 * The texture creates soft light spots on surfaces
 */
function createReflectionLights(discoBallPosition, count = 12) {
  const lights = [];
  
  // Create a light spot texture for visual effect
  const lightSpotTexture = createLightSpotTexture();
  
  // Create multiple spot lights positioned at disco ball, pointing outward
  // These simulate the light reflections bouncing off the disco ball facets
  for (let i = 0; i < count; i++) {
    // Distribute lights in directions around the disco ball
    const theta = (i / count) * Math.PI * 2; // Azimuth angle
    const phi = Math.PI / 4 + (Math.random() - 0.5) * Math.PI / 4; // Angle down (30-60 degrees)
    
    // Calculate target position (where light would hit)
    const distance = 12; // Distance from disco ball where light hits
    const x = discoBallPosition.x + distance * Math.sin(phi) * Math.cos(theta);
    const y = discoBallPosition.y - distance * Math.cos(phi); // Point downward
    const z = discoBallPosition.z + distance * Math.sin(phi) * Math.sin(theta);
    
    // Create a spot light positioned at disco ball, pointing outward
    const light = new THREE.SpotLight(0xffffff, 2.5, 25, Math.PI / 8, 0.4, 1.0);
    light.position.copy(discoBallPosition); // Start from disco ball
    light.target.position.set(x, y, z); // Point in reflection direction
    light.target.updateMatrixWorld();
    
    scene.add(light);
    scene.add(light.target);
    
    lights.push({
      light,
      theta,
      phi,
      targetPosition: new THREE.Vector3(x, y, z),
      texture: lightSpotTexture, // Store texture for potential future use
    });
  }
  
  return lights;
}

/**
 * Initialize the disco ball in the scene
 * @param {Object} options - Configuration options
 * @param {number} options.radius - Radius of the disco ball (default: 0.5)
 * @param {Object} options.position - Position {x, y, z} (default: {x: 0, y: 5, z: 0})
 * @param {number} options.lightCount - Number of spot lights (default: 8)
 * @param {number} options.lightRadius - Distance of lights from ball (default: 2.0)
 * @param {number} options.rotationSpeed - Ball rotation speed (default: 0.5)
 * @param {number} options.lightRotationSpeed - Light rotation speed (default: 1.0)
 */
export function initDiscoBall(options = {}) {
  const {
    radius = 0.5,
    position = { x: 0, y: 5, z: 0 },
    lightCount = 8,
    lightRadius = 2.0,
    rotationSpeed: rotSpeed = 0.5,
    lightRotationSpeed: lightRotSpeed = 1.0,
  } = options;

  rotationSpeed = rotSpeed;
  lightRotationSpeed = lightRotSpeed;

  // Create a group to hold the disco ball and its lights
  discoBallGroup = new THREE.Group();
  discoBallGroup.name = "DiscoBall";

  // Create the disco ball (this will also create the initial environment map)
  discoBall = createDiscoBall(radius, position);
  discoBallGroup.add(discoBall);
  
  // Capture initial environment map (disco ball will be hidden during capture)
  // We need to do this after adding to group but before adding to scene
  // Actually, we'll do it after adding to scene so the scene is complete

  // Create spot lights around the disco ball
  spotLights = createDiscoLights(position, lightCount, lightRadius);
  spotLights.forEach(({ light }) => {
    discoBallGroup.add(light);
  });

  // Create reflection lights that simulate light bouncing off disco ball
  reflectionLights = createReflectionLights(position, 16);
  // Don't add to group - these are separate scene lights

  // Add the group to the scene
  scene.add(discoBallGroup);
  
  // Capture initial environment map now that everything is in the scene
  // Hide disco ball temporarily to avoid self-reflection
  discoBall.visible = false;
  if (cubeCamera) {
    cubeCamera.update(renderer, scene);
  }
  discoBall.visible = true;

  console.log(`Disco ball created at (${position.x}, ${position.y}, ${position.z}) with ${lightCount} lights`);
}

/**
 * Update the disco ball
 * Periodically updates the environment map to reflect scene changes
 * Disco ball and lights remain static (no rotation)
 */
export function updateDiscoBall(deltaTime) {
  if (!discoBall || !discoBallGroup) return;

  // Rotate the disco ball slightly counter-clockwise (positive Y rotation)
  discoBall.rotation.y += rotationSpeed * deltaTime;

  // Update environment map periodically to reflect scene changes
  envMapUpdateInterval += deltaTime;
  if (envMapUpdateInterval >= ENV_MAP_UPDATE_INTERVAL && cubeCamera && discoBall.material) {
    const ballPosition = discoBall.position;
    
    // Update cube camera position to match disco ball
    cubeCamera.position.copy(ballPosition);
    
    // Temporarily hide the disco ball so it doesn't reflect itself
    discoBall.visible = false;
    
    // Update the cube camera to capture the current scene
    cubeCamera.update(renderer, scene);
    
    // Restore disco ball visibility
    discoBall.visible = true;
    
    // Mark material as needing update (though envMap reference should auto-update)
    discoBall.material.needsUpdate = true;
    
    envMapUpdateInterval = 0;
  }

  // Lights stay static - no rotation or movement
  // Just ensure they're pointing at the disco ball
  const ballPosition = discoBall.position;
  spotLights.forEach((lightData) => {
    const { light, isDirectional } = lightData;
    
    // Keep lights pointing at the disco ball (static position)
    light.target.position.copy(ballPosition);
    light.target.updateMatrixWorld();
  });
  
  // Update reflection lights to maintain their positions relative to disco ball
  // (They're already positioned correctly, but we could animate them if needed)
}

/**
 * Remove the disco ball from the scene
 */
export function removeDiscoBall() {
  if (discoBallGroup) {
    // Remove all lights and their targets
    spotLights.forEach(({ light }) => {
      if (light.target) {
        scene.remove(light.target);
      }
      scene.remove(light);
      light.dispose();
    });
    spotLights = [];
    
    // Remove reflection lights
    reflectionLights.forEach(({ light }) => {
      scene.remove(light);
      light.dispose();
    });
    reflectionLights = [];

    // Remove the disco ball
    scene.remove(discoBallGroup);
    discoBallGroup = null;
    discoBall = null;
  }
  
  // Clean up environment map resources
  if (cubeCamera) {
    cubeCamera.renderTarget.dispose();
    cubeCamera = null;
  }
  
  if (envMap) {
    envMap.dispose();
    envMap = null;
  }
}

/**
 * Get the disco ball object (for external manipulation)
 */
export function getDiscoBall() {
  return discoBall;
}

/**
 * Get the disco ball group
 */
export function getDiscoBallGroup() {
  return discoBallGroup;
}

/**
 * Set rotation speed
 */
export function setRotationSpeed(speed) {
  rotationSpeed = speed;
}

/**
 * Set light rotation speed
 */
export function setLightRotationSpeed(speed) {
  lightRotationSpeed = speed;
}

