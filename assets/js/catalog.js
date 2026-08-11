/* ============================================================
   catalog.js — Lógica de pages/catalogo.html
   Conecta la página de catálogo (banner de categoría, grid de
   familias, grid de productos por familia, detalle inline de
   producto y carrusel de destacados) a la capa de datos db.js.
   Antes esta página tenía todo hardcodeado (CATALOG/FAMILY_PRODUCTS);
   ahora todo viene de getCategorias()/getFamilias()/getProductos().
   ============================================================ */

import { getCategorias, getFamilias, getProductos } from './db.js';

const params = new URLSearchParams(location.search);

function volumeLabel(p) {
  return p.tamano_ml ? `${p.tamano_ml}${p.unidad || 'ml'}` : '';
}

function productCardHTML(p) {
  return `
    <div class="product-card-link" role="button" tabindex="0" style="cursor:pointer;" data-slug="${p.slug}">
      <div class="product-card-img-wrap">
        ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre_es}" class="product-card-img" loading="lazy">` : ''}
      </div>
      <h4 class="product-card-name">${p.nombre_es}</h4>
      <p class="product-card-category">${p.tipo_es || ''}</p>
      <p class="product-card-volume">${volumeLabel(p)}</p>
    </div>`;
}

async function init() {
  const categorias = await getCategorias();
  if (!categorias.length) return;

  const catKey = categorias.some(c => c.slug === params.get('cat'))
    ? params.get('cat')
    : categorias[0].slug;
  const cat = categorias.find(c => c.slug === catKey);

  document.title = `${cat.nombre_es} — BioLand`;
  document.getElementById('cat-title').textContent = cat.nombre_es;

  // Banner collage: panel principal = categoría actual, paneles laterales
  // = las otras dos categorías (cada una enlaza a su propio catálogo).
  const others = categorias.filter(c => c.slug !== catKey);
  function panelHTML(c, cls) {
    if (!c) return '';
    return `<div class="${cls}">
      <a href="catalogo.html?cat=${c.slug}">
        ${c.imagen_url ? `<img src="${c.imagen_url}" alt="${c.nombre_es}">` : ''}
        <span class="cat-banner__label">${c.nombre_es}</span>
      </a>
    </div>`;
  }
  document.getElementById('cat-banner').innerHTML =
    panelHTML(cat, 'cat-banner__main') +
    panelHTML(others[0], 'cat-banner__side-top') +
    panelHTML(others[1], 'cat-banner__side-bottom');

  // Grid de familias de esta categoría
  const familias = await getFamilias({ categoria: catKey });
  document.getElementById('family-grid').innerHTML = familias.length
    ? familias.map(f => `
        <a class="family-card" href="catalogo.html?cat=${catKey}&familia=${f.slug}">
          <div class="family-card__img-wrap">
            ${f.imagen_url ? `<img src="${f.imagen_url}" alt="${f.nombre_es}" loading="lazy">` : ''}
          </div>
          <h4 class="family-card__name">${f.nombre_es}</h4>
        </a>`).join('')
    : '<p style="color:var(--text-secondary);">Aún no hay familias cargadas en esta categoría.</p>';

  const familiaSlug = params.get('familia');
  if (familiaSlug) {
    await renderFamilia(catKey, familiaSlug, familias);
  } else {
    await renderDestacados(catKey);
  }
}

async function renderFamilia(catKey, familiaSlug, familias) {
  document.getElementById('cat-banner').style.display = 'none';
  document.getElementById('families-section').style.display = 'none';
  document.getElementById('destacados-section').style.display = 'none';
  document.getElementById('familia-section').style.display = '';

  const famEntry = familias.find(f => f.slug === familiaSlug);
  const famName = famEntry ? famEntry.nombre_es : familiaSlug;
  document.getElementById('familia-title').textContent = famName;
  document.getElementById('familia-ver-todos').href = `catalogo.html?cat=${catKey}`;
  document.title = `${famName} — BioLand`;

  const productos = await getProductos({ categoria: catKey, familia_slug: familiaSlug });
  renderFamiliaGrid(productos);
}

function renderFamiliaGrid(productos) {
  const grid = document.getElementById('familia-product-grid');
  if (!productos.length) {
    grid.innerHTML = '<p style="color:var(--text-secondary);padding:24px 0;">Productos próximamente.</p>';
    return;
  }
  grid.innerHTML = productos.map(productCardHTML).join('');
  grid.querySelectorAll('[data-slug]').forEach(el => {
    el.addEventListener('click', () => openProduct(el.dataset.slug, productos));
  });
}

function openProduct(slug, productos) {
  const p = productos.find(x => x.slug === slug);
  if (!p) return;
  const ing = p.ingrediente_principal;

  const imgEl = document.getElementById('pd-img');
  imgEl.src = p.imagen_url || '';
  imgEl.alt = p.nombre_es || '';
  document.getElementById('pd-element').style.background = ing?.color || '#888';
  document.getElementById('pd-el-symbol').textContent = ing?.abreviatura || '';
  document.getElementById('pd-el-name').textContent   = ing?.nombre_es  || '';
  document.getElementById('pd-name').textContent = p.nombre_es || '';
  document.getElementById('pd-type').textContent = [p.tipo_es, volumeLabel(p)].filter(Boolean).join(' · ');
  document.getElementById('pd-desc').textContent = p.descripcion_es || '';

  const noContiene = (p.no_contiene_es || '').split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('pd-no-contiene').innerHTML = noContiene.length
    ? noContiene.map(i => `<li>${i}</li>`).join('')
    : '<li>—</li>';
  document.getElementById('pd-ingredientes').textContent = p.ingredientes_es || '—';

  const related = productos.filter(x => x.slug !== slug);
  const relWrap = document.getElementById('pd-related');
  relWrap.innerHTML = related.length
    ? related.map(productCardHTML).join('')
    : '<p style="color:var(--text-secondary)">No hay productos relacionados.</p>';
  relWrap.querySelectorAll('[data-slug]').forEach(el => {
    el.addEventListener('click', () => openProduct(el.dataset.slug, productos));
  });

  document.querySelectorAll('.product-detail__tab').forEach(t => t.classList.remove('is-active'));
  document.querySelectorAll('.product-detail__panel').forEach(pnl => pnl.classList.remove('is-active'));
  document.querySelector('.product-detail__tab[data-tab="no-contiene"]')?.classList.add('is-active');
  document.getElementById('pd-panel-no-contiene')?.classList.add('is-active');

  document.getElementById('familia-section').style.display = 'none';
  document.getElementById('product-detail').classList.add('is-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('product-detail-back')?.addEventListener('click', () => {
  document.getElementById('product-detail').classList.remove('is-open');
  document.getElementById('familia-section').style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelectorAll('.product-detail__tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.product-detail__tab').forEach(t => t.classList.remove('is-active'));
    document.querySelectorAll('.product-detail__panel').forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    document.getElementById('pd-panel-' + btn.dataset.tab)?.classList.add('is-active');
  });
});

async function renderDestacados(catKey) {
  const section = document.getElementById('destacados-section');
  const productos = await getProductos({ categoria: catKey, destacado: true });
  if (!productos.length) { section.style.display = 'none'; return; }

  section.style.display = '';
  document.getElementById('destacados-grid').innerHTML = productos.map(p => `
    <div class="swiper-slide" style="max-width:240px;padding-bottom:48px;">
      <a class="product-card-link" href="producto.html?slug=${p.slug}">
        <div class="product-card-img-wrap">
          ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre_es}" class="product-card-img" loading="lazy">` : ''}
        </div>
        <h4 class="product-card-name">${p.nombre_es}</h4>
        <p class="product-card-category">${p.tipo_es || ''}</p>
        <p class="product-card-volume">${volumeLabel(p)}</p>
      </a>
    </div>`).join('');

  if (window.Swiper) {
    new Swiper('.destacados-swiper', {
      slidesPerView: 'auto',
      spaceBetween: 24,
      navigation: { nextEl: '.destacados-swiper .swiper-button-next', prevEl: '.destacados-swiper .swiper-button-prev' },
    });
  }
}

init().catch(err => console.error('[catalog] Error inicializando el catálogo:', err));
