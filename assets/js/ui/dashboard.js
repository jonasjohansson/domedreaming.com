function handleImageClick(block) {
  document.querySelectorAll(".dashboard-block.active, .page-content .block.active").forEach((el) => {
    el.classList.remove("active");
  });
  block.classList.add("active");
}

export function initDashboard() {
  const blocks = document.querySelectorAll(".dashboard-block");
  blocks.forEach((block) => {
    block.addEventListener("click", () => {
      handleImageClick(block);
    });
  });

  const pageContentImages = document.querySelectorAll(".page-content .block img");
  pageContentImages.forEach((img) => {
    const block = img.closest(".block");
    if (block) {
      block.addEventListener("click", () => {
        handleImageClick(block);
      });
    }
  });
}
