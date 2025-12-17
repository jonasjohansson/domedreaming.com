import * as THREE from "three";
import * as settingsModule from "../settings.js";

let ledRimObject = null;
let ledPixels = [];
let ledStripGroup = null;
const LED_COUNT = 384;
const LED_RADIUS = 0.03; // Size of each LED pixel (smaller for more subtle look)

// Animation parameters (exported for GUI control)
let animationTime = 0;
export let pulseSpeed = 2.0; // Will be updated from settings
export let pulseWidth = 0.3; // Will be updated from settings
export let baseIntensity = 0.0; // Will be updated from settings (0 = off when not pulsing)
export let maxIntensity = 4.0; // Will be updated from settings
export let mirrored = false; // Mirror animation (pulse from center both ways)
export let colorPalette = {
  hueStart: 0.5,
  hueRange: 0.3,
  saturation: 1.0,
  lightness: 0.5,
};

// Load settings from localStorage
export function loadLEDStripSettings() {
  pulseSpeed = settingsModule.ledStripSettings.pulseSpeed;
  pulseWidth = settingsModule.ledStripSettings.pulseWidth;
  baseIntensity = settingsModule.ledStripSettings.baseIntensity;
  maxIntensity = settingsModule.ledStripSettings.maxIntensity;
  mirrored = settingsModule.ledStripSettings.mirrored || false;
  colorPalette.hueStart = settingsModule.ledStripSettings.hueStart;
  colorPalette.hueRange = settingsModule.ledStripSettings.hueRange;
  colorPalette.saturation = settingsModule.ledStripSettings.saturation;
  colorPalette.lightness = settingsModule.ledStripSettings.lightness;

  // Apply rim visibility
  const rimVisible = settingsModule.ledStripSettings.rimVisible !== undefined ? settingsModule.ledStripSettings.rimVisible : false; // Default to false
  setRimVisible(rimVisible);
}

export function setPulseSpeed(value) {
  pulseSpeed = value;
  settingsModule.ledStripSettings.pulseSpeed = value;
  saveLEDStripSettings();
}

export function setPulseWidth(value) {
  pulseWidth = value;
  settingsModule.ledStripSettings.pulseWidth = value;
  saveLEDStripSettings();
}

export function setBaseIntensity(value) {
  baseIntensity = value;
  settingsModule.ledStripSettings.baseIntensity = value;
  saveLEDStripSettings();
}

export function setMaxIntensity(value) {
  maxIntensity = value;
  settingsModule.ledStripSettings.maxIntensity = value;
  saveLEDStripSettings();
}

export function setColorPalette(hueStart, hueRange, saturation, lightness) {
  colorPalette.hueStart = hueStart;
  colorPalette.hueRange = hueRange;
  colorPalette.saturation = saturation;
  colorPalette.lightness = lightness;
  settingsModule.ledStripSettings.hueStart = hueStart;
  settingsModule.ledStripSettings.hueRange = hueRange;
  settingsModule.ledStripSettings.saturation = saturation;
  settingsModule.ledStripSettings.lightness = lightness;
  saveLEDStripSettings();
}

export function setMirrored(value) {
  mirrored = value;
  settingsModule.ledStripSettings.mirrored = value;
  saveLEDStripSettings();
}

function saveLEDStripSettings() {
  import("./model.js").then((model) => {
    settingsModule.saveSettings(model.fbxMeshes, model.glbLights);
  });
}

export function findLEDRim(model) {
  if (!model) {
    console.warn("findLEDRim: model is null");
    return null;
  }

  let found = null;
  const allNames = [];
  model.traverse((child) => {
    allNames.push(child.name || "unnamed");
    if (child.name === "LED_Rim" || child.name.includes("LED_Rim") || child.name.toLowerCase().includes("led")) {
      found = child;
      console.log(`Found LED rim object: "${child.name}", type: ${child.type || child.constructor.name}`);
    }
  });

  if (!found) {
    console.warn("LED_Rim object not found. Available object names:", allNames.filter((n) => n).slice(0, 20));
  }

  return found;
}

export function createLEDStrip(rimObject) {
  if (!rimObject) {
    console.warn("LED_Rim object not found");
    return;
  }

  ledRimObject = rimObject;
  ledStripGroup = new THREE.Group();
  ledStripGroup.name = "LED_Strip";

  // Get rim geometry to extract actual vertex positions
  let rimGeometry = null;
  let rimMesh = null;

  rimObject.traverse((child) => {
    if (child.isMesh && child.geometry) {
      rimMesh = child;
      rimGeometry = child.geometry;
    }
  });

  // Calculate rim dimensions
  const box = new THREE.Box3();
  box.setFromObject(rimObject);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Use the largest dimension as radius (assuming circular rim)
  // For inside edge, we need the inner radius (significantly smaller than outer)
  let outerRadius = Math.max(size.x, size.z) / 2;
  const rimHeight = size.y / 2;

  // Inner radius - LEDs should be well inside the rim
  // Make inner radius much smaller (about 70-80% of outer radius) to place LEDs inside the sphere
  let innerRadius = outerRadius * 0.75; // 75% of outer radius - well inside

  // If radius is too small, use a default value
  if (outerRadius < 0.1) {
    console.warn(`LED Rim radius too small (${outerRadius.toFixed(2)}), using default 5.0`);
    outerRadius = 5.0;
    innerRadius = 3.5; // Much smaller for inner positioning
  }

  console.log(
    `LED Rim dimensions: outerRadius=${outerRadius.toFixed(2)}, innerRadius=${innerRadius.toFixed(2)}, height=${rimHeight.toFixed(
      2
    )}, size:`,
    size
  );
  console.log(`Rim object position:`, rimObject.position);
  console.log(`Rim object rotation:`, rimObject.rotation);
  console.log(`Rim object scale:`, rimObject.scale);
  console.log(`Rim object matrix:`, rimObject.matrix);

  // Try to extract actual vertex positions from rim geometry if available
  let positions = [];

  if (rimGeometry && rimGeometry.attributes && rimGeometry.attributes.position) {
    // Extract vertices from the rim geometry
    const positionsAttr = rimGeometry.attributes.position;
    const vertexCount = positionsAttr.count;
    console.log(`Found rim geometry with ${vertexCount} vertices`);

    // Get all vertices
    const vertices = [];
    for (let i = 0; i < vertexCount; i++) {
      const x = positionsAttr.getX(i);
      const y = positionsAttr.getY(i);
      const z = positionsAttr.getZ(i);
      vertices.push(new THREE.Vector3(x, y, z));
    }

    // Find the minimum Y value (bottom of rim)
    const minY = Math.min(...vertices.map((v) => v.y));
    const maxY = Math.max(...vertices.map((v) => v.y));
    const yRange = maxY - minY;
    const bottomY = minY + yRange * 0.1; // 10% from bottom (inside edge)

    console.log(`Rim Y range: ${minY.toFixed(2)} to ${maxY.toFixed(2)}, using bottom Y: ${bottomY.toFixed(2)}`);

    // Find vertices near the bottom edge (inside edge of rim)
    const bottomVertices = vertices
      .filter((v) => Math.abs(v.y - bottomY) < yRange * 0.15) // Within 15% of bottom edge
      .map((v) => {
        // Project to XZ plane and get distance from center
        const distance = Math.sqrt(v.x * v.x + v.z * v.z);
        return { vertex: v, distance, angle: Math.atan2(v.z, v.x) };
      })
      .sort((a, b) => a.angle - b.angle); // Sort by angle

    if (bottomVertices.length > 10) {
      console.log(`Found ${bottomVertices.length} bottom edge vertices`);

      // Instead of using path distance, use angular distribution for perfect evenness
      // Calculate the center point of the rim
      const centerX = bottomVertices.reduce((sum, bv) => sum + bv.vertex.x, 0) / bottomVertices.length;
      const centerZ = bottomVertices.reduce((sum, bv) => sum + bv.vertex.z, 0) / bottomVertices.length;
      const centerY = bottomY;
      const center = new THREE.Vector3(centerX, centerY, centerZ);

      // Calculate average radius from center
      const avgRadius =
        bottomVertices.reduce((sum, bv) => {
          const dx = bv.vertex.x - centerX;
          const dz = bv.vertex.z - centerZ;
          return sum + Math.sqrt(dx * dx + dz * dz);
        }, 0) / bottomVertices.length;

      // Use angular distribution for perfectly even spacing
      for (let i = 0; i < LED_COUNT; i++) {
        // Perfect angular distribution
        const angle = (i / LED_COUNT) * Math.PI * 2;

        // Find the closest vertex to this angle for reference
        let closestVertex = bottomVertices[0];
        let minAngleDiff = Infinity;
        for (const bv of bottomVertices) {
          const vAngle = Math.atan2(bv.vertex.z - centerZ, bv.vertex.x - centerX);
          let angleDiff = Math.abs(vAngle - angle);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
          if (angleDiff < minAngleDiff) {
            minAngleDiff = angleDiff;
            closestVertex = bv;
          }
        }

        // Use the inner radius, but maintain the Y position from geometry
        const localPos = new THREE.Vector3(
          centerX + Math.cos(angle) * innerRadius,
          closestVertex.vertex.y, // Use Y from closest vertex
          centerZ + Math.sin(angle) * innerRadius
        );
        positions.push(localPos);
      }
      console.log(`Created ${positions.length} evenly distributed LED positions using angular distribution`);
    } else {
      // Fallback to calculated circle - perfectly evenly distributed
      console.log(`Not enough bottom vertices (${bottomVertices.length}), using perfectly evenly distributed circle positions`);
      for (let i = 0; i < LED_COUNT; i++) {
        // Perfect angular distribution (no offset, starts at 0)
        const angle = (i / LED_COUNT) * Math.PI * 2;
        const localPos = new THREE.Vector3(Math.cos(angle) * innerRadius, bottomY, Math.sin(angle) * innerRadius);
        positions.push(localPos);
      }
    }
  } else {
    // No geometry found, use calculated circle - perfectly evenly distributed
    console.log("No rim geometry found, using perfectly evenly distributed circle positions");
    for (let i = 0; i < LED_COUNT; i++) {
      // Perfect angular distribution (no offset, starts at 0)
      const angle = (i / LED_COUNT) * Math.PI * 2;
      const localPos = new THREE.Vector3(Math.cos(angle) * innerRadius, -rimHeight, Math.sin(angle) * innerRadius);
      positions.push(localPos);
    }
  }

  // Ensure exactly LED_COUNT evenly distributed positions
  if (positions.length !== LED_COUNT) {
    console.log(`Adjusting positions from ${positions.length} to ${LED_COUNT} for even distribution`);
    const adjustedPositions = [];
    for (let i = 0; i < LED_COUNT; i++) {
      const t = i / LED_COUNT;
      const index1 = Math.floor(t * positions.length);
      const index2 = (index1 + 1) % positions.length;
      const frac = t * positions.length - index1;
      const pos = new THREE.Vector3().lerpVectors(positions[index1], positions[index2], frac);
      adjustedPositions.push(pos);
    }
    positions = adjustedPositions;
  }

  // Keep the rim object visible for now to help debug LED positioning
  // rimObject.visible = false;
  // rimObject.traverse((child) => {
  //   if (child.isMesh) {
  //     child.visible = false;
  //   }
  // });

  // Create LED pixels with diffused strip appearance
  // Use a flattened cylinder for a more strip-like, diffused look
  const ledGeometry = new THREE.CylinderGeometry(
    LED_RADIUS * 0.8, // Slightly smaller radius
    LED_RADIUS * 0.8,
    LED_RADIUS * 0.3, // Very thin (strip-like)
    8, // Segments
    1
  );
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x00ffff, // Cyan default
    emissiveIntensity: 0.0, // Start off
    metalness: 0.0,
    roughness: 0.8, // More rough for diffused look
  });

  // Create a diffuser layer (milky white rim) in front of LEDs
  const diffuserGroup = new THREE.Group();
  diffuserGroup.name = "LED_Diffuser";

  // Create a thin ring geometry for the diffuser
  const diffuserGeometry = new THREE.TorusGeometry(
    innerRadius + LED_RADIUS * 0.2, // Slightly in front of LEDs
    LED_RADIUS * 0.15, // Thin ring
    16, // Radial segments
    64 // Tubular segments for smooth circle
  );

  const diffuserMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3, // Semi-transparent milky white
    roughness: 1.0, // Fully rough for diffusion
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const diffuserMesh = new THREE.Mesh(diffuserGeometry, diffuserMaterial);
  diffuserMesh.position.y = -rimHeight;
  diffuserMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
  diffuserGroup.add(diffuserMesh);

  // Ensure we have exactly LED_COUNT positions
  if (positions.length !== LED_COUNT) {
    console.warn(`Position count mismatch: ${positions.length} positions, need ${LED_COUNT}. Creating missing positions.`);
    // If we have fewer positions, interpolate to get exactly LED_COUNT
    while (positions.length < LED_COUNT) {
      const index = positions.length;
      const angle = (index / LED_COUNT) * Math.PI * 2;
      const localPos = new THREE.Vector3(Math.cos(angle) * innerRadius, -rimHeight, Math.sin(angle) * innerRadius);
      positions.push(localPos);
    }
    // If we have more, trim to LED_COUNT
    positions = positions.slice(0, LED_COUNT);
  }

  for (let i = 0; i < LED_COUNT && i < positions.length; i++) {
    const ledMesh = new THREE.Mesh(ledGeometry, baseMaterial.clone());

    // Position LED directly in the rim's local space
    // Since LEDs are children of the rim, they'll automatically follow rim's transform
    ledMesh.position.copy(positions[i]);

    // Make LED face INWARD toward the center (in local space)
    // Look at a point closer to the center (inside the rim)
    const angle = (i / LED_COUNT) * Math.PI * 2;
    // Point toward center (0, y, 0) from the LED position
    const centerPoint = new THREE.Vector3(0, positions[i].y, 0);
    ledMesh.lookAt(centerPoint);

    // Rotate the cylinder to be perpendicular to the rim (strip orientation)
    // The cylinder should be oriented along the rim's tangent
    ledMesh.rotateX(Math.PI / 2); // Rotate 90 degrees so it's flat against the rim

    ledMesh.name = `LED_${i}`;
    ledPixels.push({
      mesh: ledMesh,
      index: i,
      material: ledMesh.material,
    });
    ledStripGroup.add(ledMesh);
  }

  // Add the LED strip group and diffuser as children of the rim object
  // This ensures LEDs move/rotate with the rim
  rimObject.add(ledStripGroup);
  rimObject.add(diffuserGroup);

  // Make sure the LED strip is visible
  ledStripGroup.visible = true;
  ledStripGroup.matrixAutoUpdate = true;

  console.log(`Created LED strip with ${ledPixels.length} pixels (target: ${LED_COUNT}) at inner radius ${innerRadius.toFixed(2)}`);
  console.log(`Positions array length: ${positions.length}`);
  if (ledPixels.length !== LED_COUNT) {
    console.error(`LED count mismatch! Expected ${LED_COUNT}, got ${ledPixels.length}`);
  } else {
    console.log(`✓ Successfully created all ${LED_COUNT} LEDs`);
  }
  console.log(`LED strip group position (local):`, ledStripGroup.position);
  console.log(`LED strip group visible:`, ledStripGroup.visible);
  console.log(`Rim object visible:`, rimObject.visible);

  // Log first few LED positions for debugging
  if (ledPixels.length > 0) {
    const firstLED = ledPixels[0].mesh;
    const worldPos = new THREE.Vector3();
    firstLED.getWorldPosition(worldPos);
    const rimWorldPos = new THREE.Vector3();
    rimObject.getWorldPosition(rimWorldPos);
    const rimWorldQuat = new THREE.Quaternion();
    rimObject.getWorldQuaternion(rimWorldQuat);
    console.log(`First LED local position:`, firstLED.position);
    console.log(`First LED world position:`, worldPos);
    console.log(`Rim object world position:`, rimWorldPos);
    console.log(`Rim object world rotation:`, rimObject.getWorldQuaternion(rimWorldQuat));
    console.log(`Rim object world scale:`, rimObject.getWorldScale(new THREE.Vector3()));

    // Check a few more LEDs
    if (ledPixels.length > 10) {
      const midLED = ledPixels[Math.floor(ledPixels.length / 4)].mesh;
      const midWorldPos = new THREE.Vector3();
      midLED.getWorldPosition(midWorldPos);
      console.log(`Quarter LED world position:`, midWorldPos);
    }
  }
}

export function updateLEDAnimation(deltaTime) {
  if (ledPixels.length === 0) return;

  animationTime += deltaTime * pulseSpeed;

  // Create a pulsing wave effect with continuous movement
  ledPixels.forEach((led, index) => {
    const normalizedIndex = index / LED_COUNT;

    let wavePosition;
    if (mirrored) {
      // Mirror animation: pulse from center going both ways
      // Create two waves that start from opposite sides and meet in middle
      const centerOffset = normalizedIndex - 0.5; // -0.5 to 0.5
      const absOffset = Math.abs(centerOffset);
      // Two pulses starting from center (0.5) going outward
      const wave1 = (0.5 - absOffset + animationTime) % 1.0;
      const wave2 = (0.5 - absOffset - animationTime + 1.0) % 1.0;
      // Use the closer wave
      wavePosition = Math.min(wave1, wave2);
    } else {
      // Normal animation: single wave traveling around continuously
      wavePosition = (normalizedIndex + animationTime) % 1.0;
    }

    const distanceFromWave = Math.abs(wavePosition - 0.5) * 2; // 0 to 1

    // Calculate intensity based on distance from wave center
    let intensity = 0;
    if (distanceFromWave < pulseWidth) {
      // Inside pulse: bright
      intensity = 1.0 - distanceFromWave / pulseWidth;
      intensity = Math.pow(intensity, 2); // Smooth falloff
      intensity = baseIntensity + (maxIntensity - baseIntensity) * intensity; // Scale to max intensity
    } else {
      // Outside pulse: off (baseIntensity should be 0)
      intensity = baseIntensity;
    }

    // Update emissive intensity (lights are off when not in pulse)
    led.material.emissiveIntensity = Math.max(intensity, 0.0);

    // Change color based on position in wave using color palette + continuous drift
    const hueDrift = animationTime * 0.1; // slow continuous movement
    const hue = (colorPalette.hueStart + (normalizedIndex + animationTime * 0.5) * colorPalette.hueRange + hueDrift) % 1.0;
    const color = new THREE.Color().setHSL(hue, colorPalette.saturation, colorPalette.lightness);
    led.material.emissive = color;

    // Ensure LEDs are always visible
    led.mesh.visible = true;
  });
}

export function setLEDColor(color) {
  ledPixels.forEach((led) => {
    led.material.emissive.set(color);
  });
}

export function setLEDIntensity(intensity) {
  ledPixels.forEach((led) => {
    led.material.emissiveIntensity = intensity;
  });
}

export function getLEDStrip() {
  return ledStripGroup;
}

export function getRimObject() {
  return ledRimObject;
}

export function setRimVisible(visible) {
  if (ledRimObject) {
    ledRimObject.visible = visible;
    // Also hide/show all mesh children
    ledRimObject.traverse((child) => {
      if (child.isMesh) {
        child.visible = visible;
      }
    });
  }
}

export function isRimVisible() {
  return ledRimObject ? ledRimObject.visible : true;
}
