/* ============================================================
   admin.js — Lógica principal del dashboard
   ES Module — importa capa de datos desde db.js
   ============================================================ */

import { getProductos, getFamilias, getIngredientes, upsertProducto, deleteProducto, USE_MOCK } from '../../assets/js/db.js';
import { parseProductosWorkbook, buildProductosWorkbook } from '../../assets/js/excel-catalogo.js';
import { processImageToWebp, uploadProductoImagen, productImageCaption } from '../../assets/js/image-upload.js';

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

// Nota: el toggle superior (data-lang) y el del modal (data-modal-lang) usan
// atributos distintos en dashboard.html — se manejan ambos con el mismo
// selector para que los dos respondan visualmente al click. Hoy el toggle
// es solo cosmético (marca cuál botón está activo); todavía no cambia el
// idioma de los datos mostrados/editados — eso es Fase 5 (ver 01_DECISIONS.md).
document.querySelectorAll('.lang-btn[data-lang], .lang-btn[data-modal-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    const parent = btn.closest('.admin-tabs__lang, .modal__lang');
    parent?.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
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
let _filterCat    = ''; // slug de categoría ('' = todas)
let _filterFam    = ''; // slug de familia ('' = todas)
let _filterEstado = ''; // '1' activos, '0' inactivos, '' = todos

// Cache de familias/ingredientes (para poblar selects del modal y de los
// filtros de la tabla, y para resolver slug → id al guardar un producto).
let _allFamilias    = [];
let _allIngredientes = [];

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
  const hayFiltros = !!(q || _filterCat || _filterFam || _filterEstado !== '');

  let filtered = _allProductos;
  if (q) {
    filtered = filtered.filter(p =>
      p.codigo.toLowerCase().includes(q)     ||
      p.nombre_es.toLowerCase().includes(q)  ||
      (p.tipo_es || '').toLowerCase().includes(q) ||
      (p.familia?.nombre_es || '').toLowerCase().includes(q)
    );
  }
  if (_filterCat)    filtered = filtered.filter(p => p.categoria?.slug === _filterCat);
  if (_filterFam)    filtered = filtered.filter(p => p.familia?.slug === _filterFam);
  if (_filterEstado !== '') {
    const activoBuscado = _filterEstado === '1';
    filtered = filtered.filter(p => !!p.activo === activoBuscado);
  }

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
    count.textContent = `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}${hayFiltros ? ` · filtrado de ${_allProductos.length}` : ''}`;
  }

  // Delegar clicks de editar/eliminar
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.edit));
  });
  wrap.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteProducto(btn.dataset.delete));
  });
}

/** Elimina un producto (confirmación → DB si no es mock → estado local → re-render). */
async function _deleteProducto(codigo) {
  const producto = _allProductos.find(p => p.codigo === codigo);
  const nombre = producto ? `${codigo} — ${producto.nombre_es}` : codigo;
  if (!window.confirm(`¿Eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`)) return;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await deleteProducto(codigo);
      if (!ok) { alert(`Error al eliminar: ${error?.message || 'desconocido'}`); return; }
    }
    _allProductos = _allProductos.filter(p => p.codigo !== codigo);
    _renderTable();
  } catch (err) {
    console.error('[admin] Error al eliminar producto:', err);
    alert(`Error al eliminar: ${err.message}`);
  }
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

/**
 * Carga familias e ingredientes una vez (para los filtros de la tabla y
 * los selects del modal de producto) y puebla el select de familia del
 * toolbar de Productos.
 */
async function _loadCatalogoAuxiliar() {
  try {
    [_allFamilias, _allIngredientes] = await Promise.all([getFamilias(), getIngredientes()]);
  } catch (err) {
    console.error('[admin] Error cargando familias/ingredientes:', err);
    _allFamilias = [];
    _allIngredientes = [];
  }
  const famFilterEl = document.getElementById('prod-filter-fam');
  if (famFilterEl) {
    famFilterEl.innerHTML = '<option value="">Familia: todas</option>' +
      _allFamilias.map(f => `<option value="${f.slug}">${f.nombre_es}</option>`).join('');
  }
  _populateModalFamiliaSelect();
  _populateModalIngredienteSelect();
}

// Arrancar carga
_loadProductos();
_loadCatalogoAuxiliar();

// Búsqueda en tiempo real
document.getElementById('prod-search')?.addEventListener('input', (e) => {
  _searchQuery = e.target.value;
  _renderTable();
});

// Filtros de categoría / familia / estado
document.getElementById('prod-filter-cat')?.addEventListener('change', (e) => {
  _filterCat = e.target.value;
  _renderTable();
});
document.getElementById('prod-filter-fam')?.addEventListener('change', (e) => {
  _filterFam = e.target.value;
  _renderTable();
});
document.getElementById('prod-filter-estado')?.addEventListener('change', (e) => {
  _filterEstado = e.target.value;
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

// Estado del producto que se está editando (null = creando uno nuevo).
// Con esto: el código solo es editable al crear, nunca al editar (evita
// cambiar la PK por accidente), y el chequeo de "código duplicado" sabe
// contra qué código NO comparar (el propio, si se está editando).
let _currentEditCodigo = null;
let _pendingImagenUrl  = null; // URL resultante de la última imagen subida en este modal

/**
 * Puebla el select de familia del modal. Si se pasa una categoría, filtra
 * la lista a solo las familias de esa categoría ("cascada con categoría").
 * `selected` es el slug de familia a dejar marcado (si existe en la lista).
 */
function _populateModalFamiliaSelect(categoriaSlug = '', selected = '') {
  const el = document.getElementById('mp-familia');
  if (!el) return;
  // Nota de forma de dato: en mock, f.categoria es el slug (string) crudo;
  // en real, _attachCategoria() lo convierte en {slug, nombre_es}. Se
  // soportan ambas formas para que el filtro funcione en los dos modos.
  const _famCatSlug = (f) => (typeof f.categoria === 'string' ? f.categoria : f.categoria?.slug) || f.categoria_slug || '';
  const lista = categoriaSlug
    ? _allFamilias.filter(f => _famCatSlug(f) === categoriaSlug)
    : _allFamilias;
  el.innerHTML = '<option value="">— Sin familia —</option>' +
    lista.map(f => `<option value="${f.slug}">${f.nombre_es}</option>`).join('');
  el.value = lista.some(f => f.slug === selected) ? selected : '';
}

/** Puebla el select de ingrediente principal del modal. */
function _populateModalIngredienteSelect(selected = '') {
  const el = document.getElementById('mp-ingrediente');
  if (!el) return;
  el.innerHTML = '<option value="">— Sin ingrediente principal —</option>' +
    _allIngredientes.map(i => `<option value="${i.slug}">${i.nombre_es} (${i.abreviatura})</option>`).join('');
  el.value = selected;
  _updateBadgePreview(selected);
}

/** Refleja el color/abreviatura/nombre del ingrediente elegido en el badge de vista previa. */
function _updateBadgePreview(slug) {
  const badge = document.getElementById('mp-badge-preview');
  if (!badge) return;
  const ing = _allIngredientes.find(i => i.slug === slug);
  const abrEl    = badge.querySelector('.badge-preview__abbr');
  const nameEl   = badge.querySelector('.badge-preview__name');
  if (!ing) {
    badge.style.background = '#888';
    badge.style.color = '#fff';
    if (abrEl)  abrEl.textContent  = '—';
    if (nameEl) nameEl.textContent = 'Sin ingrediente';
    return;
  }
  badge.style.background = ing.color       || '#888';
  badge.style.color      = ing.color_texto || '#fff';
  if (abrEl)  abrEl.textContent  = ing.abreviatura;
  if (nameEl) nameEl.textContent = ing.nombre_es;
}

document.getElementById('mp-ingrediente')?.addEventListener('change', (e) => {
  _updateBadgePreview(e.target.value);
});

document.getElementById('mp-categoria')?.addEventListener('change', (e) => {
  // Al cambiar de categoría en el modal, refiltra las familias disponibles
  // (la familia elegida previamente puede ya no aplicar).
  _populateModalFamiliaSelect(e.target.value, '');
});

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
  const categoriaSlug = p.categoria?.slug || '';
  if (catEl) catEl.value = categoriaSlug;
  // familia / ingrediente principal: selects poblados dinámicamente desde
  // getFamilias()/getIngredientes() (cacheados en _allFamilias/_allIngredientes).
  _populateModalFamiliaSelect(categoriaSlug, p.familia?.slug || '');
  _populateModalIngredienteSelect(p.ingrediente_principal?.slug || '');

  // Código: editable solo al crear (producto === null). Al editar, la PK
  // no se puede tocar desde este formulario.
  const codigoEl = document.getElementById('mp-codigo');
  if (codigoEl) codigoEl.readOnly = !!producto;

  // Imagen: refleja la que ya tiene el producto (si la tiene) y resetea
  // el estado de "pendiente por subir" — cada apertura del modal empieza limpia.
  _pendingImagenUrl = null;
  const thumb  = document.getElementById('mp-imagen-thumb');
  const status = document.getElementById('mp-imagen-status');
  if (thumb) {
    thumb.innerHTML = p.imagen_url
      ? `<img src="${p.imagen_url}" alt="" style="width:100%;height:100%;object-fit:contain;">`
      : `<i class="ti ti-photo" style="font-size:24px;"></i>`;
  }
  if (status) { status.style.display = 'none'; status.textContent = ''; }
}

function openProductModal(codigo) {
  const producto = codigo ? _allProductos.find(p => p.codigo === codigo) : null;
  _currentEditCodigo = producto ? producto.codigo : null;
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

const MP_NUMBER_FIELDS = new Set(['tamano_ml', 'orden']);

document.getElementById('modal-product-save')?.addEventListener('click', async () => {
  const codigo = document.getElementById('mp-codigo')?.value.trim() || '';

  // Regla: no se puede crear (ni guardar) un producto sin código.
  if (!codigo) {
    alert('Debes ingresar un código antes de guardar el producto.');
    document.getElementById('mp-codigo')?.focus();
    return;
  }
  // Regla: no se puede crear un código que ya existe (solo aplica al crear;
  // al editar, el campo código es readOnly y siempre es el mismo).
  const esNuevo = !_currentEditCodigo;
  if (esNuevo && _allProductos.some(p => p.codigo === codigo)) {
    alert(`Ya existe un producto con el código "${codigo}".`);
    document.getElementById('mp-codigo')?.focus();
    return;
  }

  const existente = !esNuevo ? _allProductos.find(p => p.codigo === _currentEditCodigo) : null;

  const producto = {};
  for (const [id, field] of Object.entries(MP_FIELD_MAP)) {
    const raw = document.getElementById(id)?.value ?? '';
    if (MP_NUMBER_FIELDS.has(field)) {
      producto[field] = raw === '' ? null : Number(raw);
    } else {
      producto[field] = raw === '' ? null : raw;
    }
  }
  for (const [id, field] of Object.entries(MP_CHECK_MAP)) {
    producto[field] = document.getElementById(id)?.checked ?? false;
  }
  const categoriaSlug = document.getElementById('mp-categoria')?.value || null;
  const familiaSlug     = document.getElementById('mp-familia')?.value || '';
  const ingredienteSlug = document.getElementById('mp-ingrediente')?.value || '';
  producto.categoria_slug = categoriaSlug;

  // Resolver slug → id para las FKs reales (en mock, id no existe y se usa
  // el propio slug como valor — igual que hace el importador de Excel).
  const familiaMap     = new Map(_allFamilias.map(f => [f.slug, f.id ?? f.slug]));
  const ingredienteMap = new Map(_allIngredientes.map(i => [i.slug, i.id ?? i.slug]));
  producto.familia_id             = familiaSlug     ? (familiaMap.get(familiaSlug)     ?? null) : null;
  producto.ingrediente_principal_id = ingredienteSlug ? (ingredienteMap.get(ingredienteSlug) ?? null) : null;

  // La imagen: si se subió una nueva en este modal, se usa esa URL; si no,
  // se conserva la que ya tenía el producto (no se debe borrar por accidente).
  producto.imagen_url = _pendingImagenUrl || existente?.imagen_url || null;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await upsertProducto({ codigo, ...producto });
      if (!ok) { alert(`Error al guardar: ${error?.message || 'desconocido'}`); return; }
    }

    // Reconstruir la forma "con joins" para reflejarlo de inmediato en la
    // tabla local, sin esperar un recargo completo desde la DB.
    const familiaObj     = _allFamilias.find(f => f.slug === familiaSlug);
    const ingredienteObj = _allIngredientes.find(i => i.slug === ingredienteSlug);
    const catOptionText  = document.querySelector('#mp-categoria option:checked')?.textContent || categoriaSlug;

    const displayProducto = {
      ...(existente || {}),
      ...producto,
      codigo,
      familia: familiaObj
        ? { slug: familiaObj.slug, nombre_es: familiaObj.nombre_es, imagen_url: familiaObj.imagen_url || null }
        : null,
      ingrediente_principal: ingredienteObj
        ? { slug: ingredienteObj.slug, abreviatura: ingredienteObj.abreviatura, nombre_es: ingredienteObj.nombre_es, color: ingredienteObj.color, color_texto: ingredienteObj.color_texto }
        : null,
      categoria: categoriaSlug ? { slug: categoriaSlug, nombre_es: catOptionText } : null,
    };

    const idx = _allProductos.findIndex(p => p.codigo === codigo);
    if (idx >= 0) _allProductos[idx] = displayProducto; else _allProductos.push(displayProducto);

    _renderTable();
    closeProductModal();
  } catch (err) {
    console.error('[admin] Error al guardar producto:', err);
    alert(`Error al guardar: ${err.message}`);
  }
});

// ── Imagen del producto (un producto = una sola imagen) ─────
const mpImagenBtn    = document.getElementById('mp-imagen-btn');
const mpImagenInput  = document.getElementById('mp-imagen-input');
const mpImagenHint   = document.getElementById('mp-imagen-hint');
const mpImagenStatus = document.getElementById('mp-imagen-status');
const mpImagenThumb  = document.getElementById('mp-imagen-thumb');

if (mpImagenHint) {
  mpImagenHint.textContent = `${productImageCaption()} Ingresa el código del producto antes de subir la imagen.`;
}

mpImagenBtn?.addEventListener('click', () => mpImagenInput?.click());

mpImagenInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  mpImagenInput.value = '';
  if (!file) return;

  const codigo = document.getElementById('mp-codigo')?.value.trim() || '';
  if (!codigo) {
    alert('Ingresa el código del producto antes de subir la imagen (el archivo se nombra con ese código).');
    return;
  }

  function setStatus(text, tone) {
    if (!mpImagenStatus) return;
    mpImagenStatus.style.display = 'block';
    mpImagenStatus.textContent = text;
    mpImagenStatus.style.color = tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-info)';
  }

  try {
    setStatus('Procesando imagen (recorte + WebP)…');
    const blob = await processImageToWebp(file);
    setStatus('Subiendo…');
    const { ok, url, error } = await uploadProductoImagen(codigo, blob);
    if (!ok) { setStatus(`Error al subir: ${error?.message || 'desconocido'}`, 'error'); return; }

    _pendingImagenUrl = url;
    if (mpImagenThumb) {
      mpImagenThumb.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
    }
    setStatus(
      USE_MOCK
        ? `Vista previa lista (modo mock, no se subió a ningún Storage real) · se guardará como ${codigo}.webp`
        : `Imagen lista · se guardó como productos/${codigo}.webp`
    );
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen:', err);
    setStatus(`Error: ${err.message}`, 'error');
  }
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
