/**
 * Vertical bars functionality
 * Manages the sidebars with "DOME DREAMING" text
 */

const SIDEBAR_TEXT = "DOME DREAMING";

/**
 * Set up vertical bar text
 */
function setupVerticalBarText() {
  const leftContent = document.querySelector(".vertical-bar-left .vertical-bar-content");
  const rightContent = document.querySelector(".vertical-bar-right .vertical-bar-content");

  // Split text into characters and create vertical layout
  const characters = SIDEBAR_TEXT.split("");
  const verticalText = characters.join("\n");

  // Calculate how many repeats we need to fill the document height
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  // Estimate height per repeat (rough calculation)
  const fontSize = 24; // Match CSS font-size
  const lineHeight = fontSize * 1.2; // Approximate line height
  const charsPerRepeat = characters.length;
  const heightPerRepeat = charsPerRepeat * lineHeight * 2; // *2 for spacing between repeats
  const repeatCount = Math.ceil(documentHeight / heightPerRepeat) + 5; // Add extra for safety

  const repeatedText = Array(repeatCount).fill(verticalText).join("\n\n");

  if (leftContent) {
    leftContent.textContent = repeatedText;
    // Update transform to account for centering
    const scrollY = window.scrollY || window.pageYOffset;
    leftContent.style.transform = `translateX(-50%) translateY(${scrollY}px)`;
  }

  if (rightContent) {
    rightContent.textContent = repeatedText;
    // Update transform to account for centering
    const scrollY = window.scrollY || window.pageYOffset;
    rightContent.style.transform = `translateX(-50%) translateY(${scrollY}px)`;
  }
}

/**
 * Update vertical bars height to match document height
 */
function updateVerticalBarsHeight() {
  const verticalBars = document.querySelector(".vertical-bars");
  if (!verticalBars) return;

  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );

  verticalBars.style.height = `${documentHeight}px`;

  const leftBar = document.querySelector(".vertical-bar-left");
  const rightBar = document.querySelector(".vertical-bar-right");

  if (leftBar) {
    leftBar.style.height = `${documentHeight}px`;
    leftBar.style.minHeight = `${documentHeight}px`;
  }

  if (rightBar) {
    rightBar.style.height = `${documentHeight}px`;
    rightBar.style.minHeight = `${documentHeight}px`;
  }
}

/**
 * Update vertical bar scroll position to follow page scroll
 */
function updateVerticalBarScroll() {
  const leftContent = document.querySelector(".vertical-bar-left .vertical-bar-content");
  const rightContent = document.querySelector(".vertical-bar-right .vertical-bar-content");

  const scrollY = window.scrollY || window.pageYOffset;

  if (leftContent) {
    leftContent.style.transform = `translateX(-50%) translateY(${scrollY}px)`;
  }

  if (rightContent) {
    rightContent.style.transform = `translateX(-50%) translateY(${scrollY}px)`;
  }
}

/**
 * Initialize vertical bars
 */
export function initVerticalBars() {
  // Update height initially and on resize/scroll
  updateVerticalBarsHeight();

  // Set up the text content
  setupVerticalBarText();

  // Update scroll position initially
  updateVerticalBarScroll();

  // Update on scroll and resize
  window.addEventListener(
    "scroll",
    () => {
      updateVerticalBarsHeight();
      updateVerticalBarScroll();
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    updateVerticalBarsHeight();
    setupVerticalBarText(); // Recalculate text on resize
    updateVerticalBarScroll();
  });

  // Watch for DOM changes that might affect document height
  const observer = new MutationObserver(() => {
    updateVerticalBarsHeight();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
}


