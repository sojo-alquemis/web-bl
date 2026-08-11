/* ============================================================
   carousel.js — Inicializa los Swipers del home
   Requiere Swiper cargado antes que este script
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ── Hero principal (full-screen, autoplay) ─────────────
  if (document.querySelector('.hero-swiper')) {
    new Swiper('.hero-swiper', {
      loop: true,
      autoplay: { delay: 4000, disableOnInteraction: false },
      scrollbar: { el: '.hero-swiper .swiper-scrollbar', draggable: true },
      speed: 600,
      autoHeight: true,
    });
  }

  // ── Carousel coverflow por categoría ──────────────────
  ['capilar', 'facial', 'corporal'].forEach(cat => {
    const el = document.querySelector(`.product-swiper-${cat}`);
    if (!el) return;
    new Swiper(el, {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: false,
      slidesPerView: 3,
      loop: true,
      coverflowEffect: { rotate: 0, stretch: 0, depth: 10, scale: 0.5, modifier: 0.5, slideShadows: false },
      autoplay: { delay: 3000, disableOnInteraction: false },
      speed: 300,
      spaceBetween: 0,
      navigation: {
        nextEl: el.querySelector('.swiper-button-next'),
        prevEl: el.querySelector('.swiper-button-prev'),
      },
    });
  });

  // ── Novedades (scroll horizontal) ─────────────────────
  if (document.querySelector('.novedades-swiper')) {
    new Swiper('.novedades-swiper', {
      slidesPerView: 'auto',
      spaceBetween: 20,
      grabCursor: true,
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false },
      speed: 500,
    });
  }
});
