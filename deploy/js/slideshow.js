document.addEventListener("DOMContentLoaded", function () {
  let promoIndex = 0;
  const slides = document.querySelectorAll(".promo-slide");
  const dots = document.querySelectorAll(".promo-dots .dot");
  const prev = document.querySelector(".promo-prev");
  const next = document.querySelector(".promo-next");

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.remove("active");
      dots[i].classList.remove("active");
    });
    slides[index].classList.add("active");
    dots[index].classList.add("active");
  }

  function nextSlide() {
    promoIndex = (promoIndex + 1) % slides.length;
    showSlide(promoIndex);
  }

  function prevSlide() {
    promoIndex = (promoIndex - 1 + slides.length) % slides.length;
    showSlide(promoIndex);
  }

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      promoIndex = i;
      showSlide(i);
    });
  });

  next.addEventListener("click", nextSlide);
  prev.addEventListener("click", prevSlide);

  showSlide(promoIndex); 
  setInterval(nextSlide, 3000); 
});
