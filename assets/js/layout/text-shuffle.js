// Character-level text shuffle transition between .shuffle-text and content-credits
// Uses the same scramble character set as the polar grid texture

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>[]{}|/\\~";
const SCRAMBLE_OUT_MS = 800;
const RESOLVE_SPREAD_MS = 1200;
const STEP_INTERVAL = 80; // ms between character changes — fewer, chunkier steps

let currentState = "main"; // "main" or "credits"
let isAnimating = false;
let mainHTML = "";
let creditsHTML = "";

/**
 * Walk all text nodes inside an element and wrap each character in a <span>.
 * Returns an array of the non-whitespace spans (the ones we'll animate).
 */
function wrapCharsInSpans(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  const spans = [];

  textNodes.forEach((tNode) => {
    const text = tNode.textContent;
    if (text.length === 0) return;

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const span = document.createElement("span");
      span.textContent = ch;
      span.dataset.original = ch;
      fragment.appendChild(span);

      // Only animate visible, non-space characters
      if (ch !== " " && ch !== "\n" && ch !== "\r" && ch !== "\t") {
        spans.push(span);
      }
    }

    tNode.parentNode.replaceChild(fragment, tNode);
  });

  return spans;
}

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function toggleText() {
  const shuffleEl = document.querySelector(".shuffle-text");
  const creditsEl = document.querySelector(".content-credits");
  if (!shuffleEl || isAnimating) return;

  isAnimating = true;
  const targetHTML = currentState === "main" ? creditsHTML : mainHTML;
  const targetState = currentState === "main" ? "credits" : "main";

  // Phase 1: wrap current chars and scramble them out
  const outSpans = wrapCharsInSpans(shuffleEl);
  const outStart = performance.now();
  let lastOutStep = 0;

  function animateOut(now) {
    const elapsed = now - outStart;
    const progress = Math.min(elapsed / SCRAMBLE_OUT_MS, 1);
    const stepIndex = Math.floor(elapsed / STEP_INTERVAL);

    // Only update characters on new steps
    if (stepIndex > lastOutStep) {
      lastOutStep = stepIndex;
      outSpans.forEach((span) => {
        if (Math.random() < 0.15 + progress * 0.4) {
          span.textContent = randomChar();
        }
      });
    }

    if (progress < 1) {
      requestAnimationFrame(animateOut);
    } else {
      // Phase 2: swap to target HTML and scramble in
      shuffleEl.innerHTML = targetHTML;

      // Hide the bottom credits when its text is shown in shuffle area (avoid duplication)
      if (creditsEl) {
        creditsEl.style.display = targetState === "credits" ? "none" : "";
      }

      const inSpans = wrapCharsInSpans(shuffleEl);

      // Assign each span a random time at which it resolves
      inSpans.forEach((span) => {
        span._resolveAt = Math.random() * RESOLVE_SPREAD_MS;
        span.textContent = randomChar();
      });

      const inStart = performance.now();
      let lastInStep = 0;

      function animateIn(now) {
        const elapsed = now - inStart;
        const stepIndex = Math.floor(elapsed / STEP_INTERVAL);
        let allDone = true;

        inSpans.forEach((span) => {
          if (elapsed >= span._resolveAt) {
            span.textContent = span.dataset.original;
          } else {
            // Only scramble on new steps
            if (stepIndex > lastInStep) {
              span.textContent = randomChar();
            }
            allDone = false;
          }
        });

        if (stepIndex > lastInStep) lastInStep = stepIndex;

        if (!allDone) {
          requestAnimationFrame(animateIn);
        } else {
          // Restore clean HTML (removes wrapper spans, keeps links working)
          shuffleEl.innerHTML = targetHTML;
          currentState = targetState;
          isAnimating = false;
        }
      }

      requestAnimationFrame(animateIn);
    }
  }

  requestAnimationFrame(animateOut);
}

export function initTextShuffle() {
  const shuffleEl = document.querySelector(".shuffle-text");
  const creditsEl = document.querySelector(".content-credits");

  if (!shuffleEl || !creditsEl) return;

  // Store both HTML states — main from the shuffle-text span, credits from the credits div inner content
  mainHTML = shuffleEl.innerHTML;
  // Extract just the inner content of the credits paragraph (strip the wrapping <p class="small">)
  const creditsP = creditsEl.querySelector("p");
  creditsHTML = creditsP ? creditsP.innerHTML : creditsEl.innerHTML;

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    if (isAnimating) return;
    if (document.body.classList.contains("dome-mode")) return;
    // Don't hijack typing in inputs
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.target.isContentEditable) return;

    e.preventDefault();
    toggleText();
  });
}
