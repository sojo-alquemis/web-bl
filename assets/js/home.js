/* ============================================================
   home.js — Lógica del home (index.html)
   Reemplaza los carruseles hardcodeados (hero, las 3 secciones de
   categoría, Novedades) por datos reales desde db.js: getBanners()
   para el hero, getProductos({categoria}) para cada carrusel de
   categoría, y getProductos({destacado:true}) para Novedades.
   Absorbe también la inicialización de Swiper que antes vivía en
   carousel.js, porque los slides ya no existen en el HTML al cargar
   la página — hay que inyectarlos primero y solo después iniciar
   cada Swiper (si se inicializa antes, no detecta los slides).
   ============================================================ */

import { getBanners, getProductos } from './db.js';

function volumeLabel(p) {
  return p.tamano_ml ? `${p.tamano_ml}${p.unidad || 'ml'}` : '';
}

// ── Hero (banners) ──────────────────────────────────────────
async function renderHero() {
  const wrap = document.querySelector('.hero-swiper .swiper-wrapper');
  if (!wrap) return;

  let banners = [];
  try { banners = await getBanners(); } catch (err) { console.error('[home] Error cargando banners:', err); }

  if (!banners.length) {
    document.querySelector('.hero-wrapper')?.style.setProperty('display', 'none');
    return;
  }

  wrap.innerHTML = banners.map(b => `
    <div class="swiper-slide" style="background: url('${b.imagen_desktop_url}') center/cover no-repeat;">
      <a class="hero-slide-link" href="${b.enlace_url || '#'}">
        <img alt="${b.titulo_es || 'Banner Bio Land'}" class="hero-slide-img hero-slide-img--desktop" src="${b.imagen_desktop_url}">
        <img alt="${b.titulo_es || 'Banner Bio Land'}" class="hero-slide-img hero-slide-img--mobile"  src="${b.imagen_mobile_url || b.imagen_desktop_url}">
      </a>
    </div>`).join('');

  new Swiper('.hero-swiper', {
    loop: true,
    autoplay: { delay: 4000, disableOnInteraction: false },
    scrollbar: { el: '.hero-swiper .swiper-scrollbar', draggable: true },
    speed: 600,
    autoHeight: true,
  });
}

// ── Carruseles de categoría (coverflow decorativo) ──────────
async function renderCategorySwiper(cat) {
  const el = document.querySelector(`.product-swiper-${cat}`);
  if (!el) return;
  const wrap = el.querySelector('.swiper-wrapper');

  let productos = [];
  try { productos = await getProductos({ categoria: cat }); } catch (err) { console.error(`[home] Error cargando productos de ${cat}:`, err); }

  const conImagen = productos.filter(p => p.imagen_url);
  if (!conImagen.length) {
    // Sin productos (o sin imagen) todavía en esta categoría: se oculta el
    // carrusel pero se deja el botón "Ver Más" (la categoría sí existe).
    el.closest('.category-section__banner')?.querySelector('.category-section__swiper-wrap')?.style.setProperty('display', 'none');
    return;
  }

  wrap.innerHTML = conImagen.map(p => `
    <div class="swiper-slide product-swiper-slide"><img alt="${p.nombre_es}" class="product-swiper-img" src="${p.imagen_url}"></div>
  `).join('');

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
}

// ── Novedades (destacados de todo el catálogo) ──────────────
async function renderNovedades() {
  const section = document.querySelector('.novedades-wrap')?.closest('section');
  const wrap = document.querySelector('.novedades-swiper .swiper-wrapper');
  if (!wrap) return;

  let productos = [];
  try { productos = await getProductos({ destacado: true }); } catch (err) { console.error('[home] Error cargando novedades:', err); }

  if (!productos.length) {
    if (section) section.style.display = 'none';
    return;
  }

  wrap.innerHTML = productos.map(p => `
    <div class="swiper-slide">
      <a class="product-card-link" href="pages/producto.html?slug=${p.slug}">
        <div class="product-card-img-wrap">${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre_es}" class="product-card-img">` : ''}</div>
        <h4 class="product-card-name">${p.nombre_es}</h4>
        <p class="product-card-category">${p.tipo_es || ''}</p>
        <p class="product-card-volume">${volumeLabel(p)}</p>
      </a>
    </div>`).join('');

  new Swiper('.novedades-swiper', {
    slidesPerView: 'auto',
    spaceBetween: 20,
    grabCursor: true,
    loop: true,
    autoplay: { delay: 3000, disableOnInteraction: false },
    speed: 500,
  });
}

async function init() {
  await Promise.all([
    renderHero(),
    renderCategorySwiper('capilar'),
    renderCategorySwiper('facial'),
    renderCategorySwiper('corporal'),
    renderNovedades(),
  ]);
}

init().catch(err => console.error('[home] Error inicializando el home:', err));
