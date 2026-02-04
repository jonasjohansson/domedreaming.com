/**
 * Touch Controls - WASD button controls for mobile devices
 */

let touchMovementRef = null;

/**
 * Set the touch movement reference object
 * @param {Object} touchMovement - Object with movement flags (forward, backward, left, right, rotateLeft, rotateRight)
 */
export function setTouchMovementRef(touchMovement) {
  touchMovementRef = touchMovement;
}

/**
 * Initialize touch controls for WASD buttons
 */
export function initTouchControls() {
  const wasdButtons = document.querySelectorAll(".wasd-key-btn");

  wasdButtons.forEach((btn) => {
    const key = btn.getAttribute("data-key");
    if (!key) return;

    // Touch start
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("active");
      if (touchMovementRef) {
        if (key === "w") touchMovementRef.forward = true;
        if (key === "s") touchMovementRef.backward = true;
        if (key === "a") touchMovementRef.left = true;
        if (key === "d") touchMovementRef.right = true;
        if (key === "q") touchMovementRef.rotateLeft = true;
        if (key === "e") touchMovementRef.rotateRight = true;
      }
    });

    // Touch end
    btn.addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      if (touchMovementRef) {
        if (key === "w") touchMovementRef.forward = false;
        if (key === "s") touchMovementRef.backward = false;
        if (key === "a") touchMovementRef.left = false;
        if (key === "d") touchMovementRef.right = false;
        if (key === "q") touchMovementRef.rotateLeft = false;
        if (key === "e") touchMovementRef.rotateRight = false;
      }
    });

    // Touch cancel
    btn.addEventListener("touchcancel", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      if (touchMovementRef) {
        if (key === "w") touchMovementRef.forward = false;
        if (key === "s") touchMovementRef.backward = false;
        if (key === "a") touchMovementRef.left = false;
        if (key === "d") touchMovementRef.right = false;
        if (key === "q") touchMovementRef.rotateLeft = false;
        if (key === "e") touchMovementRef.rotateRight = false;
      }
    });

    // Mouse down (for testing)
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add("active");
      if (touchMovementRef) {
        if (key === "w") touchMovementRef.forward = true;
        if (key === "s") touchMovementRef.backward = true;
        if (key === "a") touchMovementRef.left = true;
        if (key === "d") touchMovementRef.right = true;
        if (key === "q") touchMovementRef.rotateLeft = true;
        if (key === "e") touchMovementRef.rotateRight = true;
      }
    });

    // Mouse up
    btn.addEventListener("mouseup", (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.remove("active");
      if (touchMovementRef) {
        if (key === "w") touchMovementRef.forward = false;
        if (key === "s") touchMovementRef.backward = false;
        if (key === "a") touchMovementRef.left = false;
        if (key === "d") touchMovementRef.right = false;
        if (key === "q") touchMovementRef.rotateLeft = false;
        if (key === "e") touchMovementRef.rotateRight = false;
      }
    });

    // Mouse leave
    btn.addEventListener("mouseleave", () => {
      btn.classList.remove("active");
      if (touchMovementRef) {
        if (key === "w") touchMovementRef.forward = false;
        if (key === "s") touchMovementRef.backward = false;
        if (key === "a") touchMovementRef.left = false;
        if (key === "d") touchMovementRef.right = false;
        if (key === "q") touchMovementRef.rotateLeft = false;
        if (key === "e") touchMovementRef.rotateRight = false;
      }
    });

    // Click
    btn.addEventListener("click", () => {
      btn.classList.remove("active");
    });
  });
}
