/* ============================================================
   product.js — Lógica de pages/producto.html
   Lee ?slug= de la URL, trae el producto real desde db.js
   (getProducto) y rellena la ficha completa: imagen, nombre,
   tipo, badge de ingrediente, descripción, tabs de "no contiene"
   / "ingredientes" y productos relacionados (otros productos de
   la misma familia). Antes toda esta página era HTML estático
   de un solo producto fijo, sin leer el ?slug= en absoluto.
   ============================================================ */

import { getProducto, getProductos } from './db.js';

const params = new URLSearchParams(location.search);
const slug = params.get('slug');

function volumeLabel(p) {
  return p.tamano_ml ? `${p.tamano_ml}${p.unidad || 'ml'}` : '';
}

function relatedCardHTML(p) {
  return `
    <div class="swiper-slide" style="max-width:265px;padding-bottom:48px;margin-right:20px;">
      <a class="product-card-link" href="producto.html?slug=${p.slug}">
        <div class="product-card-img-wrap">
          ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.nombre_es}" class="product-card-img">` : ''}
        </div>
        <h4 class="product-card-name">${p.nombre_es}</h4>
        <p class="product-card-type">${p.tipo_es || ''}</p>
        <p class="product-card-type" style="color:var(--text-secondary);font-size:13px;">${volumeLabel(p)}</p>
      </a>
    </div>`;
}

function renderNotFound() {
  document.title = 'Producto no encontrado — BioLand';
  const info = document.querySelector('.product-info');
  if (info) {
    info.innerHTML = `
      <h1 style="color:var(--brand);font-size:32px;">Producto no encontrado</h1>
      <p style="color:var(--text-secondary);margin-top:16px;">El producto que buscas no existe o ya no está disponible.</p>`;
  }
  const imgWrap = document.querySelector('.product-img-swiper');
  if (imgWrap) imgWrap.style.display = 'none';
  const rel = document.getElementById('related-section');
  if (rel) rel.style.display = 'none';
}

function setupTabs() {
  document.querySelectorAll('.product-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.product-tab-btn').forEach(b => {
        const panel = document.getElementById('panel-' + b.dataset.tab);
        if (b.dataset.tab === tab) {
          b.classList.remove('product-tab-btn--inactive');
          b.style.textAlign = 'left';
          if (panel) panel.style.display = 'block';
        } else {
          b.classList.add('product-tab-btn--inactive');
          b.style.textAlign = 'right';
          if (panel) panel.style.display = 'none';
        }
      });
    });
  });
}

async function renderRelacionados(p) {
  const relSection = document.getElementById('related-section');
  const relWrap = document.getElementById('related-wrapper');
  if (!p.familia?.slug) { relSection.style.display = 'none'; return; }

  let relacionados = [];
  try {
    const mismaFamilia = await getProductos({ categoria: p.categoria?.slug, familia_slug: p.familia.slug });
    relacionados = mismaFamilia.filter(x => x.slug !== p.slug);
  } catch (err) {
    console.error('[product] Error cargando relacionados:', err);
  }

  if (!relacionados.length) { relSection.style.display = 'none'; return; }

  relWrap.innerHTML = relacionados.map(relatedCardHTML).join('');
  relSection.style.display = '';
  if (window.Swiper) {
    new Swiper('.related-swiper', { slidesPerView: 'auto', spaceBetween: 20, grabCursor: true });
  }
}

async function init() {
  setupTabs();

  if (!slug) { renderNotFound(); return; }

  let p = null;
  try {
    p = await getProducto(slug);
  } catch (err) {
    console.error('[product] Error cargando producto:', err);
  }
  if (!p) { renderNotFound(); return; }

  document.title = `${p.nombre_es} — BioLand`;

  document.getElementById('pp-img-wrapper').innerHTML = p.imagen_url
    ? `<div class="swiper-slide"><img src="${p.imagen_url}" alt="${p.nombre_es}"></div>`
    : `<div class="swiper-slide"></div>`;

  document.getElementById('pp-nombre').textContent = p.nombre_es || '';
  document.getElementById('pp-tipo').textContent = [p.tipo_es, volumeLabel(p)].filter(Boolean).join(' · ');
  document.getElementById('pp-desc').textContent = p.descripcion_es || '';

  const ing  = p.ingrediente_principal;
  const pill = document.getElementById('pp-ing-pill');
  if (ing) {
    pill.style.backgroundColor = ing.color       || '#888';
    pill.style.color           = ing.color_texto || '#fff';
    document.getElementById('pp-ing-abbr').textContent = ing.abreviatura || '';
    document.getElementById('pp-ing-name').textContent = ing.nombre_es  || '';
    pill.style.display = '';
  } else {
    pill.style.display = 'none';
  }

  const noContiene = (p.no_contiene_es || '').split('\n').map(s => s.trim()).filter(Boolean);
  document.getElementById('pp-no-contiene').innerHTML = noContiene.length
    ? noContiene.map(i => `<li>${i}</li>`).join('')
    : '<li>—</li>';
  document.getElementById('pp-ingredientes').textContent = p.ingredientes_es || '—';

  await renderRelacionados(p);
}

init().catch(err => console.error('[product] Error inicializando la ficha de producto:', err));
