/**
 * Camera transition functionality
 * Handles camera zoom from exterior to interior view during initial scroll
 */

import * as settings from "./settings.js";
import { updateDebugDisplay, debugLog, exposeDebugToWindow } from "./utils/scroll-debug.js";

let scrollProgressCallback = null;
let transitionProgress = 0; // 0 to 1 (0% to 100% of transition)
let accumulatedScroll = 0; // Track accumulated scroll for smooth progress
let maxTransitionScroll = 0; // Store max scroll for debug

/**
 * Animate first page blocks in/out based on transition state
 * @param {boolean} show - true to show blocks, false to hide
 */
function animateFirstPageBlocks(show) {
  const dashboardOverlay = document.getElementById("dashboard-overlay");
  if (dashboardOverlay) {
    if (show) {
      dashboardOverlay.classList.add("blocks-visible");
      console.log("[Camera Transition] First page blocks animated in");
    } else {
      dashboardOverlay.classList.remove("blocks-visible");
      console.log("[Camera Transition] First page blocks animated out");
    }
  }
}

/**
 * Get the row height in pixels
 */
function getRowHeight() {
  const rootStyles = getComputedStyle(document.documentElement);
  const cssRowHeight = parseFloat(rootStyles.getPropertyValue("--row-height"));
  if (!isNaN(cssRowHeight) && cssRowHeight > 0) {
    return cssRowHeight;
  }
  const gridRows = settings.scrollSettings.gridRows || 10;
  return window.innerHeight / gridRows;
}

/**
 * Get the maximum scroll for camera transition phase
 */
function getCameraTransitionMaxScroll() {
  const rowHeight = getRowHeight();
  return rowHeight * settings.cameraTransitionRows;
}

/**
 * Get scroll progress for camera transition (0 to 1)
 * 0 = exterior view, 1 = interior view
 */
export function getCameraTransitionProgress() {
  return transitionProgress;
}

/**
 * Check if we're still in camera transition phase
 */
export function isInCameraTransition() {
  return transitionProgress < 1;
}

/**
 * Set callback for scroll progress updates (for camera transition)
 */
export function setScrollProgressCallback(callback) {
  scrollProgressCallback = callback;
}

/**
 * Manually set scroll progress (for debugging)
 * @param {number} progress - Progress value from 0 to 1
 */
export function setScrollProgress(progress) {
  progress = Math.max(0, Math.min(1, progress));
  transitionProgress = progress;
  accumulatedScroll = progress * maxTransitionScroll;

  debugLog("transition", `Manual progress set to ${(progress * 100).toFixed(2)}%`);

  // Update camera immediately
  if (scrollProgressCallback) {
    scrollProgressCallback(transitionProgress);
  }

  // Update debug display
  updateDebugState();

  // Handle transition state changes
  if (progress >= 1) {
    animateFirstPageBlocks(true);
  } else {
    animateFirstPageBlocks(false);
  }
}

/**
 * Update debug display with current state
 */
function updateDebugState() {
  const rowHeight = getRowHeight();
  const currentScrollY = window.scrollY || window.pageYOffset || 0;
  const inTransition = isInCameraTransition();
  const isAtTop = currentScrollY === 0;

  updateDebugDisplay({
    progress: transitionProgress,
    accumulatedScroll,
    maxTransitionScroll,
    currentScrollY,
    inTransition,
    rowHeight,
    cameraTransitionRows: settings.cameraTransitionRows,
    shouldHandle: inTransition || (isAtTop && transitionProgress < 1),
    isScrollingUp: false, // Will be updated in wheel handler
    isScrollingDown: false, // Will be updated in wheel handler
    isAtTop,
  });
}

/**
 * Initialize camera transition functionality
 */
export function initScrollIncrement() {
  maxTransitionScroll = getCameraTransitionMaxScroll();

  // Initialize state - start at 0% (zoomed out)
  transitionProgress = 0;
  accumulatedScroll = 0;
  console.log("[Camera Transition] Initialized - progress:", transitionProgress, "maxTransitionScroll:", maxTransitionScroll);
  debugLog("transition", `Initialized - maxTransitionScroll: ${maxTransitionScroll.toFixed(2)}px`);

  window.scrollTo({
    top: 0,
    behavior: "auto",
  });

  // Expose debug functions to window
  exposeDebugToWindow(setScrollProgress);

  // Initial debug display update
  updateDebugState();

  // Handle wheel events for camera transition
  window.addEventListener(
    "wheel",
    (event) => {
      const scrollDelta = event.deltaY;
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      const wasInTransition = isInCameraTransition();
      const isScrollingUp = scrollDelta < 0;
      const isScrollingDown = scrollDelta > 0;

      // CRITICAL: If we're not in transition and scrollY > 0, always allow normal page scrolling
      // Don't interfere with normal page scrolling at all
      // Check all scroll positions to be thorough
      const earlyDocScrollTop = document.documentElement.scrollTop || 0;
      const earlyBodyScrollTop = document.body.scrollTop || 0;
      const maxScrollPosition = Math.max(currentScrollY, earlyDocScrollTop, earlyBodyScrollTop);

      if (!wasInTransition && maxScrollPosition > 0) {
        // Allow normal page scrolling - don't prevent default, don't handle it
        console.log("[Camera Transition] Allowing normal page scroll - not in transition, maxScrollPosition > 0:", maxScrollPosition);
        return;
      }

      // Check if we should handle this scroll event:
      // 1. If we're in transition (progress < 1), always handle it
      // 2. If we're scrolling up AND at the top of the page (scrollY === 0), handle it to reverse transition
      // IMPORTANT: Only reverse transition when at the very top, not when scrolling up from anywhere else
      // Check all possible scroll positions to ensure we're truly at the top
      const docScrollTop = document.documentElement.scrollTop || 0;
      const bodyScrollTop = document.body.scrollTop || 0;
      const allScrollPositions = [currentScrollY, docScrollTop, bodyScrollTop];
      const isAtTop = allScrollPositions.every((pos) => pos === 0);
      const transitionComplete = !wasInTransition; // Transition complete means not in transition

      // IMPORTANT: Only prevent default if we're in transition OR (at top AND scrolling up AND transition complete)
      // If scrollY > 0, always allow normal page scrolling
      // Only reverse camera when: transition complete AND at top (all scroll positions === 0) AND scrolling up
      // This ensures normal page scrolling works until you can't scroll up anymore
      // CRITICAL FIX: Only reverse when truly at top (all scroll positions are 0), not just when scrolling up
      const shouldHandle = wasInTransition || (transitionComplete && isScrollingUp && isAtTop);

      debugLog("wheel", `Wheel event - deltaY: ${scrollDelta.toFixed(2)}, shouldHandle: ${shouldHandle}`, {
        deltaY: scrollDelta,
        isScrollingUp,
        isScrollingDown,
        currentScrollY,
        inTransition: wasInTransition,
        progress: transitionProgress,
        isAtTop,
        accumulatedScroll,
      });

      if (shouldHandle) {
        // Final safety check: if we're not in transition, double-check we're truly at the top
        // This prevents premature reversal when scrolling up but not yet at the top
        if (!wasInTransition) {
          // Re-check all scroll positions to ensure we're truly at the top
          const finalDocScrollTop = document.documentElement.scrollTop || 0;
          const finalBodyScrollTop = document.body.scrollTop || 0;
          const finalScrollY = window.scrollY || window.pageYOffset || 0;
          const finalAllPositions = [finalScrollY, finalDocScrollTop, finalBodyScrollTop];
          const trulyAtTop = finalAllPositions.every((pos) => pos === 0);

          if (!trulyAtTop) {
            // Not at top yet - allow normal page scrolling
            debugLog(
              "wheel",
              `Not at top yet - scrollY: ${finalScrollY.toFixed(2)}px, docScrollTop: ${finalDocScrollTop.toFixed(
                2
              )}px, bodyScrollTop: ${finalBodyScrollTop.toFixed(2)}px`
            );
            return;
          }
        }

        // During transition or scrolling up from top when at top: prevent page scroll, accumulate scroll and update progress
        event.preventDefault();

        accumulatedScroll += scrollDelta;
        // Clamp accumulatedScroll to prevent going below 0 or above max
        accumulatedScroll = Math.max(0, Math.min(maxTransitionScroll, accumulatedScroll));

        // Calculate progress directly from accumulated scroll
        const oldProgress = transitionProgress;
        transitionProgress = Math.max(0, Math.min(1, accumulatedScroll / maxTransitionScroll)); // Clamp 0-1

        debugLog("transition", `Progress updated: ${(oldProgress * 100).toFixed(1)}% -> ${(transitionProgress * 100).toFixed(1)}%`);

        // Update debug display
        updateDebugState();

        // Keep page scroll at 0 during transition ONLY if we're actually in transition
        // Don't reset scroll if transition is complete (progress >= 1)
        if (wasInTransition && (window.scrollY !== 0 || window.pageYOffset !== 0)) {
          window.scrollTo({
            top: 0,
            behavior: "auto",
          });
        }

        // Update camera immediately
        if (scrollProgressCallback) {
          console.log("[Camera Transition] Calling scrollProgressCallback with progress:", transitionProgress);
          scrollProgressCallback(transitionProgress);
        }

        // Check if transition just completed
        if (transitionProgress >= 1 && oldProgress < 1) {
          debugLog("transition", "✅ Transition COMPLETE! Progress reached 100%");
          // Ensure camera is set to final position
          if (scrollProgressCallback) {
            scrollProgressCallback(1); // Force to 100%
          }
          // Animate in first page blocks
          animateFirstPageBlocks(true);
        }

        // Check if transition just started (reversed from complete)
        if (transitionProgress < 1 && oldProgress >= 1) {
          debugLog("transition", "🔄 Transition REVERSED! Back in transition phase");
          // Hide first page blocks when reversing
          animateFirstPageBlocks(false);
        }
      } else {
        debugLog("wheel", "Transition complete - allowing normal page scroll");
      }
    },
    { passive: false }
  );

  // Handle scroll events to keep page at 0 during transition
  let lastScrollPosition = 0;
  window.addEventListener(
    "scroll",
    () => {
      const actualScroll = window.scrollY || window.pageYOffset;
      const inTransition = isInCameraTransition();

      debugLog("scroll", `Scroll event - actualScroll: ${actualScroll.toFixed(2)}px, inTransition: ${inTransition}`);

      if (inTransition) {
        // During transition: keep page at 0, update accumulated scroll based on scroll attempt
        if (actualScroll !== 0) {
          const scrollDelta = actualScroll - lastScrollPosition;
          const oldProgress = transitionProgress;
          accumulatedScroll += scrollDelta;
          // Clamp accumulatedScroll to prevent going below 0 or above max
          accumulatedScroll = Math.max(0, Math.min(maxTransitionScroll, accumulatedScroll));
          transitionProgress = Math.max(0, Math.min(1, accumulatedScroll / maxTransitionScroll)); // Clamp 0-1

          debugLog(
            "scroll",
            `Progress updated from scroll: ${(oldProgress * 100).toFixed(1)}% -> ${(transitionProgress * 100).toFixed(1)}%`
          );

          // Update debug display
          updateDebugState();

          // Reset scroll to 0 ONLY if still in transition
          if (transitionProgress < 1) {
            window.scrollTo({
              top: 0,
              behavior: "auto",
            });
            lastScrollPosition = 0;
          } else {
            // Transition just completed, allow scroll
            lastScrollPosition = actualScroll;
          }

          // Update camera
          if (scrollProgressCallback) {
            scrollProgressCallback(transitionProgress);
          }
        } else {
          lastScrollPosition = 0;
        }
      } else {
        // Transition complete - allow normal scrolling, just track position for potential reverse
        // DO NOT reset scroll or interfere in any way
        lastScrollPosition = actualScroll;
      }
    },
    { passive: true }
  );

  // Initial camera update
  if (scrollProgressCallback) {
    debugLog("transition", `Initial camera update - progress: ${transitionProgress}`);
    scrollProgressCallback(transitionProgress);
  }

  // Set up periodic debug updates
  setInterval(() => {
    updateDebugState();
  }, 100); // Update every 100ms
}
