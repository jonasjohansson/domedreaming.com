/**
 * Parallax layer functionality
 * Creates a decorative parallax layer with images
 */

// Parallax items configuration
const PARALLAX_ITEMS = [
  { x: 2, w: 2, y: 3, h: 2, factor: 0.2, img: "assets/img/tiny-massive.jpg" },
  { x: 5, w: 3, y: 7, h: 3, factor: 0.6, img: "assets/img/nordic-lights.jpg" },
  { x: 10, w: 2, y: 12, h: 2, factor: 0.35, img: "assets/img/arctic-lights.png" },
  { x: 13, w: 2, y: 15, h: 2, factor: 0.45, img: "assets/img/visualia.jpg" },
  { x: 1, w: 3, y: 18, h: 2, factor: 0.25, img: "assets/img/akiko-nakayama.jpg" },
  { x: 6, w: 2, y: 22, h: 3, factor: 0.55, img: "assets/img/ieva-balode.jpg" },
  { x: 9, w: 3, y: 26, h: 2, factor: 0.3, img: "assets/img/michaela-french.webp" },
  { x: 13, w: 2, y: 29, h: 2, factor: 0.5, img: "assets/img/annie-tadne.jpg" },
  { x: 3, w: 2, y: 32, h: 2, factor: 0.4, img: "assets/img/lina-selander.png" },
  { x: 7, w: 3, y: 35, h: 2, factor: 0.65, img: "assets/img/calvin-guillot.jpg" },
  { x: 12, w: 2, y: 38, h: 2, factor: 0.28, img: "assets/img/untold-garden.jpg" },
  { x: 2, w: 3, y: 40, h: 2, factor: 0.48, img: "assets/img/jesper-wallerborg.jpg" },
  { x: 8, w: 1, y: 1, h: 1, factor: 0.22, img: "assets/img/anna-lundh.png" },
  { x: 12, w: 4, y: 4, h: 4, factor: 0.58, img: "assets/img/rhythm-in-light-mary-ellen-bute.jpg" },
  { x: 1, w: 1, y: 6, h: 1, factor: 0.32, img: "assets/img/elena-malakhatka.png" },
  { x: 7, w: 5, y: 9, h: 2, factor: 0.42, img: "assets/img/fredrik-edstrom.jpg" },
  { x: 14, w: 1, y: 11, h: 3, factor: 0.38, img: "assets/img/jakob-skote.jpg" },
  { x: 4, w: 2, y: 14, h: 1, factor: 0.52, img: "assets/img/merle-karp.jpg" },
  { x: 11, w: 3, y: 17, h: 5, factor: 0.28, img: "assets/img/valentin-malmgren.jpg" },
  { x: 2, w: 1, y: 20, h: 1, factor: 0.62, img: "assets/img/simon-ryden.png" },
  { x: 8, w: 4, y: 23, h: 3, factor: 0.33, img: "assets/img/suvi-parilla.png" },
  { x: 1, w: 2, y: 25, h: 2, factor: 0.47, img: "assets/img/nils-bergendahl.jpg" },
  { x: 12, w: 1, y: 28, h: 1, factor: 0.36, img: "assets/img/oscar-wemmert.jpg" },
  { x: 5, w: 5, y: 31, h: 2, factor: 0.54, img: "assets/img/lennart-strom.jpg" },
  { x: 11, w: 2, y: 34, h: 4, factor: 0.26, img: "assets/img/hakan-lidbo.jpg" },
  { x: 3, w: 1, y: 37, h: 1, factor: 0.44, img: "assets/img/idun-isdrake.jpeg" },
  { x: 9, w: 3, y: 39, h: 3, factor: 0.56, img: "assets/img/asa-andersson-broms.jpg" },
  { x: 15, w: 1, y: 5, h: 2, factor: 0.3, img: "assets/img/axel-jonsson.jpg" },
  { x: 4, w: 4, y: 8, h: 1, factor: 0.5, img: "assets/img/sebastian-hager.jpg" },
  { x: 14, w: 1, y: 13, h: 2, factor: 0.34, img: "assets/img/ash-reed.jpg" },
  { x: 6, w: 2, y: 16, h: 4, factor: 0.48, img: "assets/img/tiny-massive-2.jpg" },
  { x: 1, w: 1, y: 19, h: 3, factor: 0.4, img: "assets/img/untold-garden-2.jpg" },
  { x: 10, w: 3, y: 21, h: 1, factor: 0.46, img: "assets/img/baltic-analog-lab.jpg" },
  { x: 13, w: 2, y: 24, h: 3, factor: 0.29, img: "assets/img/aavistus-festival.jpg" },
  { x: 7, w: 1, y: 27, h: 2, factor: 0.51, img: "assets/img/nonagon-festival.jpg" },
  { x: 2, w: 4, y: 30, h: 1, factor: 0.37, img: "assets/img/kokong-festival.jpg" },
  { x: 9, w: 2, y: 33, h: 5, factor: 0.43, img: "assets/img/paul-bourke-test-pattern.png" },
  { x: 15, w: 1, y: 36, h: 2, factor: 0.39, img: "assets/img/movie-drome.png" },
];

let parallaxLayer = null;

/**
 * Create parallax items
 */
function createParallaxItems() {
  if (!parallaxLayer) return;

  // Clear existing items
  parallaxLayer.innerHTML = "";

  // Create parallax items
  PARALLAX_ITEMS.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.className = `parallax-item x-${item.x} w-${item.w} y-${item.y} h-${item.h}`;
    itemElement.setAttribute("data-parallax-factor", item.factor);

    const imgElement = document.createElement("img");
    imgElement.src = item.img;
    imgElement.alt = "";

    itemElement.appendChild(imgElement);
    parallaxLayer.appendChild(itemElement);
  });
}

/**
 * Initialize parallax layer
 */
export function initParallaxLayer() {
  // Remove existing layer if any
  const existingLayer = document.getElementById("parallax-layer");
  if (existingLayer) {
    existingLayer.remove();
  }

  // Create layer
  parallaxLayer = document.createElement("div");
  parallaxLayer.id = "parallax-layer";
  parallaxLayer.className = "grid parallax-layer";
  parallaxLayer.style.display = "none"; // Hidden by default, can be toggled
  document.body.appendChild(parallaxLayer);

  createParallaxItems();
}

