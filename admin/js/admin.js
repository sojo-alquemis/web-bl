/* ============================================================
   admin.js — Lógica principal del dashboard
   ES Module — importa capa de datos desde db.js
   ============================================================ */

import { getProductos, getFamilias, getIngredientes, upsertProducto, USE_MOCK } from '../assets/js/db.js';
import { parseProductosWorkbook, buildProductosWorkbook } from '../assets/js/excel-catalogo.js';

// ── Auth guard ──────────────────────────────────────────────
const session = sessionStorage.getItem('bl_admin_session');
if (!session) {
  window.location.replace('index.html');
  throw new Error('no session');
}

// ── Correo del usuario en el topbar ─────────────────────────
const _topbarEmail = document.getElementById('topbar-user-email');
const _sessionEmail = sessionStorage.getItem('bl_admin_email');
if (_topbarEmail && _sessionEmail) {
  _topbarEmail.innerHTML = `<i class="ti ti-user-circle" style="font-size:18px;"></i> ${_sessionEmail}`;
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

// Campos simples del modal, mapeados 1:1 a las columnas de productos
// (coinciden con "Plantilla-Productos-ACS-BioLand.xlsx"). Los _en no se
// listan aquí porque el toggle ES/EN del modal aún no está wireado
// (Fase 5) — hoy el formulario siempre edita/guarda español.
const MP_FIELD_MAP = {
  'mp-codigo':         'codigo',
  'mp-marca':           'marca',
  'mp-ean':             'ean_upc',
  'mp-dun14':           'dun14',
  'mp-nombre-interno':  'nombre_interno',
  'mp-slug':            'slug',
  'mp-nombre':          'nombre_es',
  'mp-tipo':            'tipo_es',
  'mp-ml':              'tamano_ml',
  'mp-unidad':          'unidad',
  'mp-descripcion':     'descripcion_es',
  'mp-modo-empleo':     'modo_empleo_es',
  'mp-no-contiene':     'no_contiene_es',
  'mp-ingredientes-inci': 'ingredientes_es',
  'mp-alergenos':       'alergenos_es',
  'mp-notas':           'notas',
  'mp-orden':           'orden',
};
const MP_CHECK_MAP = { 'mp-destacado': 'destacado', 'mp-activo': 'activo' };

function _fillProductForm(producto) {
  const p = producto || {};
  for (const [id, field] of Object.entries(MP_FIELD_MAP)) {
    const el = document.getElementById(id);
    if (el) el.value = p[field] ?? '';
  }
  for (const [id, field] of Object.entries(MP_CHECK_MAP)) {
    const el = document.getElementById(id);
    if (el) el.checked = field === 'activo' ? (p[field] ?? true) : !!p[field];
  }
  const catEl = document.getElementById('mp-categoria');
  if (catEl) catEl.value = p.categoria?.slug || '';
  // familia / ingrediente principal: selects estáticos por ahora (Fase 5
  // los llena dinámicamente desde getFamilias()/getIngredientes()).
}

function openProductModal(codigo) {
  const producto = codigo ? _allProductos.find(p => p.codigo === codigo) : null;
  if (modalTitle) {
    modalTitle.textContent = producto ? `Editar producto — ${producto.codigo}` : 'Nuevo producto';
  }
  _fillProductForm(producto);
  modalOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
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
  const producto = {};
  for (const [id, field] of Object.entries(MP_FIELD_MAP)) {
    producto[field] = document.getElementById(id)?.value ?? null;
  }
  for (const [id, field] of Object.entries(MP_CHECK_MAP)) {
    producto[field] = document.getElementById(id)?.checked ?? false;
  }
  producto.categoria_slug = document.getElementById('mp-categoria')?.value || null;
  // TODO Fase 5: resolver familia_id/ingrediente_principal_id desde los
  // selects (hoy son estáticos) y llamar upsertProducto(producto).
  console.log('[admin] producto a guardar (Fase 5 hará el upsert real):', producto);
  alert('TODO Fase 5: falta conectar el guardado real con Supabase.');
});

// ══════════════════════════════════════════════════════════
// IMPORTAR / EXPORTAR EXCEL
// ══════════════════════════════════════════════════════════

function _showImportResult(html, tone = 'info') {
  const el = document.getElementById('import-result');
  if (!el) return;
  const colors = {
    info:    { bg: '#EFF3FF', text: 'var(--color-text-info)' },
    success: { bg: '#E8F5E1', text: '#1E7A34' },
    error:   { bg: '#FDECEC', text: 'var(--color-text-danger)' },
  }[tone];
  el.style.display = 'block';
  el.style.margin = '10px 0';
  el.style.padding = '12px 14px';
  el.style.borderRadius = 'var(--border-radius-md)';
  el.style.fontSize = '13px';
  el.style.background = colors.bg;
  el.style.color = colors.text;
  el.innerHTML = html;
}

// ── Exportar ────────────────────────────────────────────────
document.getElementById('btn-export-excel')?.addEventListener('click', () => {
  if (!window.XLSX) { alert('No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.'); return; }
  if (!_allProductos.length) { alert('No hay productos cargados para exportar.'); return; }
  const wb = buildProductosWorkbook(_allProductos);
  const fecha = new Date().toISOString().slice(0, 10);
  window.XLSX.writeFile(wb, `Productos-BioLand-${fecha}.xlsx`);
});

// ── Importar ────────────────────────────────────────────────
const importInput = document.getElementById('import-excel-input');
document.getElementById('btn-import-excel')?.addEventListener('click', () => importInput?.click());

importInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  importInput.value = ''; // permite volver a elegir el mismo archivo después
  if (!file) return;
  if (!window.XLSX) { alert('No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.'); return; }

  _showImportResult('<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Leyendo archivo…', 'info');

  try {
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: 'array' });

    // Mapas slug → id para resolver familia_slug / ingrediente_slug.
    // En modo mock no hay ids reales; se usa el propio slug como valor
    // (la escritura en mock es solo una vista previa, no persiste).
    const [familias, ingredientes] = await Promise.all([getFamilias(), getIngredientes()]);
    const familiaMap    = new Map(familias.map(f => [f.slug, f.id ?? f.slug]));
    const ingredienteMap = new Map(ingredientes.map(i => [i.slug, i.id ?? i.slug]));

    const { rows, errors } = parseProductosWorkbook(workbook, familiaMap, ingredienteMap);
    if (!rows.length) {
      _showImportResult(`No se encontraron filas de producto para importar.${errors.length ? '<br>' + errors.map(e => `Fila ${e.row ?? '—'}: ${e.message}`).join('<br>') : ''}`, 'error');
      return;
    }

    const existentes = new Set(_allProductos.map(p => p.codigo));
    let creados = 0, actualizados = 0, omitidos = 0;
    const fallos = [];

    for (const row of rows) {
      const esNuevo = !existentes.has(row.codigo);
      if (esNuevo && (!row.fields.slug || !row.fields.nombre_es)) {
        omitidos++;
        fallos.push(`Fila ${row.rowNumber} (${row.codigo}): producto nuevo sin slug o nombre_es — se omite.`);
        continue;
      }
      try {
        if (USE_MOCK) {
          // Modo desarrollo: vista previa, no se escribe en ninguna DB.
          esNuevo ? creados++ : actualizados++;
          continue;
        }
        const { ok, error } = await upsertProducto({ codigo: row.codigo, ...row.fields });
        if (!ok) { fallos.push(`Fila ${row.rowNumber} (${row.codigo}): ${error?.message || 'error al guardar'}`); continue; }
        esNuevo ? creados++ : actualizados++;
      } catch (err) {
        fallos.push(`Fila ${row.rowNumber} (${row.codigo}): ${err.message}`);
      }
    }

    const avisos = [...errors.map(e => `Fila ${e.row}${e.codigo ? ` (${e.codigo})` : ''}: ${e.message}`), ...fallos];
    const modoNota = USE_MOCK
      ? '<br><em>Modo desarrollo (USE_MOCK): esto es una vista previa — nada se escribió en la base de datos todavía.</em>'
      : '';
    _showImportResult(
      `<strong>${creados}</strong> creados · <strong>${actualizados}</strong> actualizados` +
      (omitidos ? ` · <strong>${omitidos}</strong> omitidos` : '') +
      (avisos.length ? `<br><br><strong>Avisos (${avisos.length}):</strong><br>${avisos.slice(0, 20).join('<br>')}${avisos.length > 20 ? `<br>…y ${avisos.length - 20} más.` : ''}` : '') +
      modoNota,
      avisos.length ? 'error' : 'success'
    );

    if (!USE_MOCK) await _loadProductos();
  } catch (err) {
    console.error('[admin] Error al importar Excel:', err);
    _showImportResult(`Error al leer el archivo: ${err.message}`, 'error');
  }
});
