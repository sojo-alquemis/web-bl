/* ============================================================
   ingredientes.js — Lógica de pages/ingredientes.html
   Reemplaza los objetos hardcodeados DESCS/CATEGORIES por datos
   reales desde db.js: getFamiliasIngrediente() para las columnas
   de la tabla de categorías, getIngredientes() para el swiper de
   pills y sus descripciones, y getProductos() para "Relacionados"
   (productos cuyo ingrediente principal es el elegido).
   ============================================================ */

import { getFamiliasIngrediente, getIngredientes, getProductos } from './db.js';

const DEFAULT_DESC = 'Ingrediente natural seleccionado cuidadosamente para aportar propiedades únicas a cada producto BioLand, en armonía con nuestra filosofía de cuidado natural y sostenible.';

let ALL_PRODUCTOS = [];
let ingSwiper = null;

function volumeLabel(p) {
  return p.tamano_ml ? `${p.tamano_ml}${p.unidad || 'ml'}` : '';
}

function selectIngredient(ing) {
  document.getElementById('feat-name').textContent = (ing.nombre_es || '').toUpperCase();
  document.getElementById('feat-desc').textContent = ing.descripcion_es || DEFAULT_DESC;
  renderRelacionados(ing);
}

function renderRelacionados(ing) {
  const wrap    = document.querySelector('.related-swiper .swiper-wrapper');
  const section = document.querySelector('.related-section');
  if (!wrap) return;

  const relacionados = ALL_PRODUCTOS.filter(p => p.ingrediente_principal?.slug === ing.slug);
  if (!relacionados.length) {
    wrap.innerHTML = '';
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';
  wrap.innerHTML = relacionados.map(p => `
    <div class="swiper-slide" style="max-width:265px;padding-bottom:48px;margin-right:20px;">
      <a class="product-card-link" href="producto.html?slug=${p.slug}">
        <div class="product-card-img-wrap">
          ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre_es}" class="product-card-img">` : ''}
        </div>
        <h4 class="product-card-name">${p.nombre_es}</h4>
        <p class="product-card-type">${p.tipo_es || ''}</p>
        <p class="product-card-volume">${volumeLabel(p)}</p>
      </a>
    </div>`).join('');

  if (window.Swiper) {
    new Swiper('.related-swiper', { slidesPerView: 'auto', spaceBetween: 20, grabCursor: true });
  }
}

async function init() {
  const [familias, ingredientes, productos] = await Promise.all([
    getFamiliasIngrediente(),
    getIngredientes(),
    getProductos(),
  ]);
  ALL_PRODUCTOS = productos;

  if (!ingredientes.length) {
    document.querySelector('.ing-header')?.style.setProperty('display', 'none');
    document.querySelector('.ing-swiper-section')?.style.setProperty('display', 'none');
    document.querySelector('.ing-table-section')?.style.setProperty('display', 'none');
    document.querySelector('.related-section')?.style.setProperty('display', 'none');
    return;
  }

  // ── Swiper de pills (lista plana de ingredientes) ──────────
  const swiperWrapper = document.getElementById('ing-swiper-wrapper');
  swiperWrapper.innerHTML = '';
  ingredientes.forEach(ing => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';
    const btn = document.createElement('button');
    btn.className = 'ing-pill-btn';
    btn.style.background = ing.color || '#888';
    btn.innerHTML = `<span class="ing-pill-btn__abbr" style="color:${ing.color_texto || '#fff'}">${ing.abreviatura}</span>` +
                     `<span class="ing-pill-btn__name" style="color:${ing.color_texto || '#fff'}">${ing.nombre_es}</span>`;
    btn.addEventListener('click', () => selectIngredient(ing));
    slide.appendChild(btn);
    swiperWrapper.appendChild(slide);
  });

  ingSwiper = new Swiper('#ing-swiper', {
    slidesPerView: 'auto',
    centeredSlides: true,
    initialSlide: 0,
    spaceBetween: 112,
    grabCursor: true,
    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
    on: {
      slideChange(sw) { selectIngredient(ingredientes[sw.activeIndex]); }
    }
  });

  // ── Tabla de categorías (familias_ingrediente → sus pills) ──
  const ingTable = document.getElementById('ing-table');
  ingTable.innerHTML = '';
  familias.forEach(fam => {
    const pills = ingredientes.filter(i => i.familia?.slug === fam.slug);
    if (!pills.length) return; // no listar familias sin ingredientes cargados

    const col = document.createElement('div');
    col.className = 'ing-col';

    const hdr = document.createElement('button');
    hdr.className = 'ing-col-pill ing-col-pill--header';
    hdr.style.borderColor = fam.color;
    hdr.style.color = fam.color;
    hdr.innerHTML = `<span class="ing-col-pill__abbr" style="color:${fam.color}">${fam.abreviatura}</span>` +
                     `<span class="ing-col-pill__name" style="color:${fam.color}">${fam.nombre_es}</span>`;
    col.appendChild(hdr);

    pills.forEach(ing => {
      const btn = document.createElement('button');
      btn.className = 'ing-col-pill';
      btn.style.background = ing.color || fam.color;
      btn.style.border = 'none';
      btn.innerHTML = `<span class="ing-col-pill__abbr" style="color:${ing.color_texto || '#fff'}">${ing.abreviatura}</span>` +
                       `<span class="ing-col-pill__name" style="color:${ing.color_texto || '#fff'}">${ing.nombre_es}</span>`;
      btn.addEventListener('click', () => {
        selectIngredient(ing);
        const idx = ingredientes.findIndex(i => i.slug === ing.slug);
        if (idx >= 0 && ingSwiper) ingSwiper.slideTo(idx);
      });
      col.appendChild(btn);
    });

    ingTable.appendChild(col);
  });

  // Selección inicial: el primer ingrediente de la lista.
  selectIngredient(ingredientes[0]);
}

init().catch(err => console.error('[ingredientes] Error inicializando la página:', err));
