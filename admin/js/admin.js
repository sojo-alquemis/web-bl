/* ============================================================
   admin.js — Lógica principal del dashboard
   ES Module — importa capa de datos desde db.js
   ============================================================ */

import { getProductos, getFamilias } from '../assets/js/db.js';

// ── Auth guard ──────────────────────────────────────────────
const session = sessionStorage.getItem('bl_admin_session');
if (!session) {
  window.location.replace('index.html');
  throw new Error('no session');
}

// ── Logout ──────────────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', (e) => {
  e.preventDefault();
  sessionStorage.removeItem('bl_admin_session');
  window.location.replace('index.html');
});

// ══════════════════════════════════════════════════════════
// TABS PRINCIPALES
// ══════════════════════════════════════════════════════════

const tabButtons = document.querySelectorAll('.admin-tab[data-tab]');
const tabPanels  = document.querySelectorAll('.tab-panel[id^="tab-"]');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${target}`)?.classList.add('active');
    history.replaceState(null, '', `#${target}`);
  });
});

// Restaurar tab desde URL hash
const hash = window.location.hash.replace('#', '');
if (hash) {
  const btn = document.querySelector(`.admin-tab[data-tab="${hash}"]`);
  if (btn) btn.click();
}

// ══════════════════════════════════════════════════════════
// TOGGLE DE IDIOMA
// ══════════════════════════════════════════════════════════

document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.admin-tabs__lang, .modal__lang');
    parent?.querySelectorAll('.lang-btn[data-lang]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ══════════════════════════════════════════════════════════
// SUB-TABS (ingredientes)
// ══════════════════════════════════════════════════════════

document.querySelectorAll('.admin-subtab[data-subtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target    = btn.dataset.subtab;
    const container = btn.closest('.tab-panel');
    container?.querySelectorAll('.admin-subtab').forEach(b => b.classList.remove('active'));
    container?.querySelectorAll('.subtab-panel').forEach(p => { p.style.display = 'none'; });
    btn.classList.add('active');
    const panel = document.getElementById(target);
    if (panel) panel.style.display = '';
  });
});

// ══════════════════════════════════════════════════════════
// TABLA DE PRODUCTOS — renderizado dinámico
// ══════════════════════════════════════════════════════════

// Estado local
let _allProductos = [];
let _searchQuery  = '';

/**
 * Construye una fila de la tabla para un producto normalizado.
 */
function _buildRow(p) {
  const ing   = p.ingrediente_principal;
  const color = ing?.color       || '#888';
  const texto = ing?.color_texto || '#fff';
  const abr   = ing?.abreviatura || '—';
  const fam   = p.familia?.nombre_es || '—';
  const nombre = [p.nombre_es, p.tipo_es].filter(Boolean).join(' · ');

  const activeIcon = p.activo
    ? `<i class="ti ti-circle-check" style="font-size:18px;color:var(--color-success);" title="Activo"></i>`
    : `<i class="ti ti-circle" style="font-size:18px;color:var(--color-text-tertiary);" title="Inactivo"></i>`;

  return `
    <div class="admin-table-row" data-codigo="${p.codigo}">
      <div class="admin-table-thumb">
        ${p.imagen_url
          ? `<img src="${p.imagen_url}" alt="${p.nombre_es}" style="width:100%;height:100%;object-fit:contain;">`
          : `<i class="ti ti-photo" style="font-size:15px;"></i>`
        }
      </div>
      <span class="admin-table-code">${p.codigo}</span>
      <span>${nombre}</span>
      <span class="admin-table-family">${fam}</span>
      <span class="badge-pill" style="background:${color};color:${texto};">${abr}</span>
      ${activeIcon}
      <div class="admin-table-actions">
        <button title="Editar" data-edit="${p.codigo}"><i class="ti ti-edit"></i></button>
        <button class="del" title="Eliminar" data-delete="${p.codigo}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

/**
 * Filtra y pinta la tabla según _searchQuery.
 */
function _renderTable() {
  const wrap  = document.getElementById('prod-table-body');
  const count = document.getElementById('prod-count');
  if (!wrap) return;

  const q = _searchQuery.toLowerCase().trim();
  const filtered = q
    ? _allProductos.filter(p =>
        p.codigo.toLowerCase().includes(q)     ||
        p.nombre_es.toLowerCase().includes(q)  ||
        (p.tipo_es || '').toLowerCase().includes(q) ||
        (p.familia?.nombre_es || '').toLowerCase().includes(q)
      )
    : _allProductos;

  // Mantener el thead y agregar filas después
  const head = wrap.querySelector('.admin-table-head');
  wrap.innerHTML = '';
  if (head) wrap.appendChild(head);

  if (filtered.length === 0) {
    wrap.insertAdjacentHTML('beforeend',
      `<div class="admin-table-empty" style="padding:32px;text-align:center;color:var(--color-text-tertiary);">
         Sin resultados${q ? ` para "<strong>${q}</strong>"` : ''}
       </div>`
    );
  } else {
    filtered.forEach(p => wrap.insertAdjacentHTML('beforeend', _buildRow(p)));
  }

  if (count) {
    count.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}${q ? ` · filtrado de ${_allProductos.length}` : ''}`;
  }

  // Delegar clicks de editar/eliminar
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.edit));
  });
}

/** Carga inicial desde db.js */
async function _loadProductos() {
  try {
    _allProductos = await getProductos({ activo: undefined }); // todos (activos e inactivos)
    _renderTable();
  } catch (err) {
    console.error('[admin] Error cargando productos:', err);
    const wrap = document.getElementById('prod-table-body');
    if (wrap) {
      const head = wrap.querySelector('.admin-table-head');
      wrap.innerHTML = '';
      if (head) wrap.appendChild(head);
      wrap.insertAdjacentHTML('beforeend',
        `<div style="padding:32px;text-align:center;color:var(--color-danger);">
           Error al cargar productos: ${err.message}
         </div>`
      );
    }
  }
}

// Arrancar carga
_loadProductos();

// Búsqueda en tiempo real
document.getElementById('prod-search')?.addEventListener('input', (e) => {
  _searchQuery = e.target.value;
  _renderTable();
});

// ══════════════════════════════════════════════════════════
// MODAL DE PRODUCTO
// ══════════════════════════════════════════════════════════

const modalOverlay = document.getElementById('modal-product');
const modalTitle   = document.getElementById('modal-product-title');

function openProductModal(codigo) {
  const producto = codigo ? _allProductos.find(p => p.codigo === codigo) : null;
  if (modalTitle) {
    modalTitle.textContent = producto ? `Editar producto — ${producto.codigo}` : 'Nuevo producto';
  }
  modalOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
  // TODO Fase 5: poblar campos del formulario con `producto`
}

function closeProductModal() {
  modalOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

// Exponer globalmente por compatibilidad con cualquier onclick inline residual
window.openProductModal = openProductModal;

document.getElementById('btn-new-product')?.addEventListener('click', () => openProductModal(null));
document.getElementById('modal-product-close')?.addEventListener('click', closeProductModal);
document.getElementById('modal-product-cancel')?.addEventListener('click', closeProductModal);

modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeProductModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeProductModal();
});

document.getElementById('modal-product-save')?.addEventListener('click', () => {
  // TODO Fase 5: leer campos y hacer upsert en Supabase
  alert('TODO Fase 5: guardar en Supabase');
});
