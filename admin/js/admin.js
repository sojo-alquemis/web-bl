/* ============================================================
   admin.js — Lógica principal del dashboard
   ES Module — importa capa de datos desde db.js
   ============================================================ */

import {
  getProductos, getFamilias, getIngredientes, upsertProducto, deleteProducto,
  getProductoRelacionados, setProductoRelacionados,
  upsertFamilia, deleteFamilia,
  getFamiliasIngrediente, upsertFamiliaIngrediente, deleteFamiliaIngrediente,
  upsertIngrediente, deleteIngrediente,
  getBanners, upsertBanner, deleteBanner,
  getCategorias, upsertCategoria,
  getConfig, upsertConfig,
  USE_MOCK, getSiteClient,
} from '../../assets/js/db.js';
import { parseProductosWorkbook, buildProductosWorkbook } from '../../assets/js/excel-catalogo.js';
import {
  processImageToWebp, processImageToWebpTransparent, processImageToWebpCover,
  uploadProductoImagen, productImageCaption, uploadAsset,
  listProductoImagenesStorage,
  FAMILIA_IMAGE_PRESET, INGREDIENTE_FONDO_PRESET,
  CARRUSEL_DESKTOP_PRESET, CARRUSEL_MOBILE_PRESET, CATEGORIA_IMAGE_PRESET,
  CONTENIDO_BLOQUE_PRESET,
} from '../../assets/js/image-upload.js';

// ── Auth guard ──────────────────────────────────────────────
const session = sessionStorage.getItem('bl_admin_session');
if (!session) {
  window.location.replace('index.html');
  throw new Error('no session');
}
// La bandera de sessionStorage por sí sola no basta en modo real: puede
// quedar puesta desde un login viejo en USE_MOCK=true (que nunca llamó a
// Supabase Auth). Si no hay una sesión real, cualquier escritura a la DB
// (guardar, borrar, importar Excel) va a fallar en silencio por RLS —
// las políticas solo permiten escribir a usuarios "authenticated". Se
// verifica acá y, si falta, se manda de vuelta al login.
if (!USE_MOCK) {
  const sb = await getSiteClient();
  const { data: sessionCheck } = await sb.auth.getSession();
  if (!sessionCheck?.session) {
    sessionStorage.removeItem('bl_admin_session');
    window.location.replace('index.html');
    throw new Error('no hay sesión real de Supabase Auth — hay que volver a loguearse');
  }
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
// DIÁLOGOS PROPIOS — reemplazo de alert()/confirm() nativos.
// El navegador bloquea/desestima los diálogos nativos en algunos
// contextos (iframes, ciertos flujos de admin embebidos), lo que hacía
// que errores reales de guardado pasaran desapercibidos. Este modal
// propio siempre se ve y sigue el mismo estilo visual que el resto
// del admin.
// ══════════════════════════════════════════════════════════
let _dialogEl = null;

function _ensureDialogEl() {
  if (_dialogEl) return _dialogEl;
  const el = document.createElement('div');
  el.className = 'app-dialog-overlay';
  el.innerHTML = `
    <div class="app-dialog" role="alertdialog" aria-modal="true">
      <div class="app-dialog__icon"><i class="ti ti-alert-circle"></i></div>
      <p class="app-dialog__message"></p>
      <div class="app-dialog__actions">
        <button type="button" class="app-dialog__cancel">Cancelar</button>
        <button type="button" class="app-dialog__ok">Aceptar</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  _dialogEl = el;
  return el;
}

function _showDialog({ message, okText = 'Aceptar', cancelText = null, danger = false, icon = 'ti-alert-circle' }) {
  return new Promise((resolve) => {
    const el = _ensureDialogEl();
    const iconEl   = el.querySelector('.app-dialog__icon');
    const msgEl    = el.querySelector('.app-dialog__message');
    const okBtn    = el.querySelector('.app-dialog__ok');
    const cancelBtn = el.querySelector('.app-dialog__cancel');

    msgEl.textContent = message;
    iconEl.innerHTML = `<i class="ti ${icon}"></i>`;
    iconEl.classList.toggle('tone-danger', !!danger);
    okBtn.textContent = okText;
    okBtn.classList.toggle('tone-danger', !!danger);
    cancelBtn.style.display = cancelText ? '' : 'none';
    if (cancelText) cancelBtn.textContent = cancelText;

    const cleanup = (result) => {
      el.classList.remove('open');
      document.removeEventListener('keydown', onKey, true);
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      el.removeEventListener('mousedown', onOverlay);
      resolve(result);
    };
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = (e) => { if (e.target === el && cancelText) cleanup(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cleanup(false); }
      if (e.key === 'Enter')  { e.stopPropagation(); cleanup(true); }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    el.addEventListener('mousedown', onOverlay);
    document.addEventListener('keydown', onKey, true);

    el.classList.add('open');
    okBtn.focus();
  });
}

/** Reemplazo de window.alert(): muestra el mensaje y espera a que el usuario lo cierre. */
function showAlert(message, { icon = 'ti-alert-circle', danger = false } = {}) {
  return _showDialog({ message, okText: 'Aceptar', cancelText: null, icon, danger });
}

/** Reemplazo de window.confirm(): devuelve true/false según la elección del usuario. */
function showConfirm(message, { okText = 'Eliminar', cancelText = 'Cancelar', danger = true, icon = 'ti-help-circle' } = {}) {
  return _showDialog({ message, okText, cancelText, danger, icon });
}

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
    ? `<i class="ti ti-circle-check" style="font-size:18px;color:var(--color-text-success);" title="Activo"></i>`
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
  if (!(await showConfirm(`¿Eliminar el producto "${nombre}"? Esta acción no se puede deshacer.`))) return;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await deleteProducto(codigo);
      if (!ok) { await showAlert(`Error al eliminar: ${error?.message || 'desconocido'}`); return; }
    }
    _allProductos = _allProductos.filter(p => p.codigo !== codigo);
    _renderTable();
  } catch (err) {
    console.error('[admin] Error al eliminar producto:', err);
    await showAlert(`Error al eliminar: ${err.message}`);
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
        `<div style="padding:32px;text-align:center;color:var(--color-text-danger);">
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
let _currentRelacionados = []; // códigos de los productos relacionados elegidos en este modal

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

// ── Productos relacionados (curados a mano, tabla producto_relacionados) ──
// Checklist con buscador: los marcados quedan siempre arriba de la lista,
// y el propio checkbox agrega/quita — sin botón de "agregar" ni de "✕"
// separados (mismo patrón que "Presentaciones" en el editor de Seed).
let _relacionadosFiltro = '';

function _renderRelacionadosChecklist() {
  const box = document.getElementById('mp-relacionados-checklist');
  if (!box) return;

  const propio = document.getElementById('mp-codigo')?.value.trim() || '';
  const q = _relacionadosFiltro.trim().toLowerCase();

  let candidatos = _allProductos.filter(p => p.codigo !== propio);
  if (q) {
    candidatos = candidatos.filter(p =>
      (p.nombre_es || '').toLowerCase().includes(q) ||
      (p.codigo || '').toLowerCase().includes(q)
    );
  }
  // Marcados primero (arriba), después alfabético por nombre.
  candidatos.sort((a, b) => {
    const aChecked = _currentRelacionados.includes(a.codigo);
    const bChecked = _currentRelacionados.includes(b.codigo);
    if (aChecked !== bChecked) return aChecked ? -1 : 1;
    return (a.nombre_es || '').localeCompare(b.nombre_es || '');
  });

  if (!candidatos.length) {
    box.innerHTML = `<p class="checklist__empty">${q ? `Ningún producto coincide con "${q}".` : 'No hay otros productos disponibles.'}</p>`;
    return;
  }

  box.innerHTML = candidatos.map(p => {
    const checked = _currentRelacionados.includes(p.codigo) ? ' checked' : '';
    return `
      <label class="checklist__item">
        <input type="checkbox" value="${p.codigo}"${checked}>
        <span>${p.codigo} · ${p.nombre_es}</span>
      </label>`;
  }).join('');
}

document.getElementById('mp-relacionados-checklist')?.addEventListener('change', (e) => {
  if (!e.target.matches('input[type="checkbox"]')) return;
  const codigo = e.target.value;
  if (e.target.checked) {
    if (!_currentRelacionados.includes(codigo)) _currentRelacionados.push(codigo);
  } else {
    _currentRelacionados = _currentRelacionados.filter(c => c !== codigo);
  }
  _renderRelacionadosChecklist(); // re-pinta para que el marcado suba arriba
});

document.getElementById('mp-relacionados-search')?.addEventListener('input', (e) => {
  _relacionadosFiltro = e.target.value;
  _renderRelacionadosChecklist();
});

// Si se cambia el código (al crear un producto nuevo) hay que refrescar la
// lista para que no se pueda marcar el propio producto como relacionado.
document.getElementById('mp-codigo')?.addEventListener('input', () => _renderRelacionadosChecklist());

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

  // Relacionados: se limpian y se pintan de una (vacío) para que el modal no
  // se sienta "trabado" — si es una edición, se cargan de la DB por separado
  // y se re-pintan cuando lleguen (guardado contra reabrir el modal rápido
  // con otro producto mientras el fetch anterior todavía está en vuelo).
  _currentRelacionados = [];
  _relacionadosFiltro = '';
  const relSearchEl = document.getElementById('mp-relacionados-search');
  if (relSearchEl) relSearchEl.value = '';
  _renderRelacionadosChecklist();
  if (producto?.codigo && !USE_MOCK) {
    const codigoAlAbrir = producto.codigo;
    getProductoRelacionados(codigoAlAbrir).then(rows => {
      if (_currentEditCodigo !== codigoAlAbrir) return; // se cerró/cambió el modal mientras cargaba
      _currentRelacionados = rows.map(r => r.codigo);
      _renderRelacionadosChecklist();
    }).catch(err => {
      console.error('[admin] Error cargando productos relacionados:', err);
    });
  }
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
    await showAlert('Debes ingresar un código antes de guardar el producto.');
    document.getElementById('mp-codigo')?.focus();
    return;
  }
  // Regla: no se puede crear un código que ya existe (solo aplica al crear;
  // al editar, el campo código es readOnly y siempre es el mismo).
  const esNuevo = !_currentEditCodigo;
  if (esNuevo && _allProductos.some(p => p.codigo === codigo)) {
    await showAlert(`Ya existe un producto con el código "${codigo}".`);
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
      if (!ok) { await showAlert(`Error al guardar: ${error?.message || 'desconocido'}`); return; }

      const { ok: okRel, error: errRel } = await setProductoRelacionados(codigo, _currentRelacionados);
      if (!okRel) { await showAlert(`El producto se guardó, pero los relacionados no: ${errRel?.message || 'desconocido'}`); }
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
    await showAlert(`Error al guardar: ${err.message}`);
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
    await showAlert('Ingresa el código del producto antes de subir la imagen (el archivo se nombra con ese código).');
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

function _showImportResult(html, tone = 'info', { dismissible = false } = {}) {
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
  el.innerHTML = dismissible
    ? `<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
         <div style="flex:1;">${html}</div>
         <button id="import-result-close" title="Cerrar" style="background:none;border:none;cursor:pointer;color:inherit;font-size:16px;line-height:1;padding:0;flex-shrink:0;">✕</button>
       </div>`
    : html;
  if (dismissible) {
    document.getElementById('import-result-close')?.addEventListener('click', () => {
      el.style.display = 'none';
      el.innerHTML = '';
    });
  }
}

/** Progreso en vivo mientras se procesan las filas (importar puede tardar
 * con archivos grandes — sin esto, la pantalla se veía "congelada"). */
function _showImportProgress(done, total, extra = '') {
  _showImportResult(
    `<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Guardando… ${done} / ${total} filas procesadas.${extra}`,
    'info'
  );
}

// ── Exportar ────────────────────────────────────────────────
document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
  if (!window.XLSX) { await showAlert('No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.'); return; }
  if (!_allProductos.length) { await showAlert('No hay productos cargados para exportar.'); return; }
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
  if (!window.XLSX) { await showAlert('No se pudo cargar la librería de Excel. Revisa tu conexión e intenta de nuevo.'); return; }

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

    const { rows, errors, otrasMarcas } = parseProductosWorkbook(workbook, familiaMap, ingredienteMap);
    if (!rows.length) {
      _showImportResult(
        `No se encontraron filas de producto para importar.` +
        (otrasMarcas.length ? `<br>${otrasMarcas.length} fila(s) eran de otra marca (no BioLand) — se omitieron.` : '') +
        (errors.length ? '<br>' + errors.map(e => `Fila ${e.row ?? '—'}: ${e.message}`).join('<br>') : ''),
        'error', { dismissible: true }
      );
      return;
    }

    // El Excel de ACS no trae imágenes — pero si ya se subió la foto del
    // producto al bucket (ej. con others/tools/subir-imagenes-productos.html,
    // que sube directo a Storage sin tocar la DB) esta la asocia sola por
    // código, en vez de dejar el producto sin imagen hasta que alguien la
    // vuelva a subir manualmente desde el editor.
    let imagenesEncontradas = 0;
    try {
      const storageImages = await listProductoImagenesStorage();
      for (const row of rows) {
        if (storageImages.has(row.codigo)) {
          row.fields.imagen_url = storageImages.get(row.codigo);
          imagenesEncontradas++;
        }
      }
    } catch (err) {
      console.error('[admin] No se pudo listar productos/ en Storage (se sigue sin asociar imágenes):', err);
    }

    const existentes = new Set(_allProductos.map(p => p.codigo));
    let creados = 0, actualizados = 0, omitidos = 0;
    const fallos = []; // errores reales al guardar (o filas omitidas) — lo más importante de revisar

    _showImportProgress(0, rows.length);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const esNuevo = !existentes.has(row.codigo);
      if (esNuevo && (!row.fields.slug || !row.fields.nombre_es)) {
        omitidos++;
        fallos.push(`Fila ${row.rowNumber} (${row.codigo}): producto nuevo sin slug o nombre_es — se omite.`);
      } else {
        try {
          if (USE_MOCK) {
            // Modo desarrollo: vista previa, no se escribe en ninguna DB.
            esNuevo ? creados++ : actualizados++;
          } else {
            const { ok, error } = await upsertProducto({ codigo: row.codigo, ...row.fields });
            if (!ok) {
              fallos.push(`Fila ${row.rowNumber} (${row.codigo}): ${error?.message || 'error al guardar'}`);
            } else {
              esNuevo ? creados++ : actualizados++;
            }
          }
        } catch (err) {
          fallos.push(`Fila ${row.rowNumber} (${row.codigo}): ${err.message}`);
        }
      }
      // Actualiza el progreso cada 10 filas (o en la última) para no saturar el DOM.
      if (i % 10 === 0 || i === rows.length - 1) _showImportProgress(i + 1, rows.length);
    }

    // "avisos" (parse-time: familia/ingrediente/subcategoría no encontrada, etc.)
    // van SEPARADOS de "fallos" (errores reales al guardar o filas omitidas) —
    // antes se mezclaban en una sola lista y los errores reales quedaban
    // enterrados debajo de cientos de avisos de datos, sin poder verse.
    const avisos = errors.map(e => `Fila ${e.row}${e.codigo ? ` (${e.codigo})` : ''}: ${e.message}`);
    const modoNota = USE_MOCK
      ? '<br><br><em>Modo desarrollo (USE_MOCK): esto es una vista previa — nada se escribió en la base de datos todavía.</em>'
      : '';

    function listaTruncada(lista, max = 15) {
      return lista.slice(0, max).join('<br>') + (lista.length > max ? `<br>…y ${lista.length - max} más.` : '');
    }

    _showImportResult(
      `<strong>${creados}</strong> creados · <strong>${actualizados}</strong> actualizados` +
      (omitidos ? ` · <strong>${omitidos}</strong> omitidos` : '') +
      (otrasMarcas.length ? ` · <strong>${otrasMarcas.length}</strong> de otra marca (omitidas)` : '') +
      (imagenesEncontradas ? ` · <strong>${imagenesEncontradas}</strong> con imagen asociada desde Storage` : '') +
      (fallos.length ? `<br><br><strong style="color:var(--color-text-danger);">Errores al guardar (${fallos.length}):</strong><br>${listaTruncada(fallos)}` : '') +
      (avisos.length ? `<br><br><strong>Avisos de datos (${avisos.length})</strong> — campos ignorados por slug/valor no reconocido, no impiden que el resto de la fila se guarde:<br>${listaTruncada(avisos)}` : '') +
      modoNota,
      fallos.length ? 'error' : (avisos.length ? 'info' : 'success'),
      { dismissible: true }
    );

    if (!USE_MOCK) await _loadProductos();
  } catch (err) {
    console.error('[admin] Error al importar Excel:', err);
    _showImportResult(`Error al leer el archivo: ${err.message}`, 'error', { dismissible: true });
  }
});

// ══════════════════════════════════════════════════════════
// TAB: FAMILIAS — CRUD manual (no viene del Excel de ACS)
// ══════════════════════════════════════════════════════════

let _allFamiliasTab       = [];
let _currentEditFamiliaId = null;
let _pendingFamiliaImagenUrl = null; // URL resultante de la última imagen subida en este form

const modalFamiliaOverlay = document.getElementById('modal-familia');

function _buildFamiliaRow(f) {
  const catLabel = f.categoria?.nombre_es || f.categoria_slug || '—';
  const activeIcon = f.activo
    ? `<i class="ti ti-circle-check" style="font-size:17px;color:var(--color-text-success);" title="Activa"></i>`
    : `<i class="ti ti-circle" style="font-size:17px;color:var(--color-text-tertiary);" title="Inactiva"></i>`;
  return `
    <div style="display:grid;grid-template-columns:1fr 130px 80px 60px 64px;gap:8px;align-items:center;padding:10px 12px;border-top:0.5px solid var(--color-border-tertiary);font-size:13px;" data-fam-id="${f.id}">
      <span>${f.nombre_es}</span>
      <span style="font-size:12px;color:var(--color-text-secondary);">${catLabel}</span>
      <div class="img-thumb" style="width:36px;height:36px;">
        ${f.imagen_url
          ? `<img src="${f.imagen_url}" alt="" style="width:100%;height:100%;object-fit:contain;">`
          : `<i class="ti ti-photo" style="font-size:15px;"></i>`
        }
      </div>
      ${activeIcon}
      <div class="admin-table-actions">
        <button title="Editar" data-fam-edit="${f.id}"><i class="ti ti-edit"></i></button>
        <button class="del" title="Eliminar" data-fam-delete="${f.id}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function _renderFamiliasTable() {
  const wrap  = document.getElementById('fam-table-body');
  const count = document.getElementById('fam-count');
  if (!wrap) return;

  wrap.innerHTML = _allFamiliasTab.length
    ? _allFamiliasTab.map(_buildFamiliaRow).join('')
    : `<div style="padding:32px;text-align:center;color:var(--color-text-tertiary);">Sin familias todavía.</div>`;

  if (count) count.textContent = `(${_allFamiliasTab.length})`;

  wrap.querySelectorAll('[data-fam-edit]').forEach(btn => {
    btn.addEventListener('click', () => openFamiliaModal(btn.dataset.famEdit));
  });
  wrap.querySelectorAll('[data-fam-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteFamiliaTab(btn.dataset.famDelete));
  });
}

/** Carga (o recarga) la lista de familias de este tab — incluye inactivas. */
async function _loadFamiliasTab() {
  try {
    _allFamiliasTab = await getFamilias({ activo: undefined });
    _renderFamiliasTable();
  } catch (err) {
    console.error('[admin] Error cargando familias:', err);
    const wrap = document.getElementById('fam-table-body');
    if (wrap) wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--color-text-danger);">Error al cargar familias: ${err.message}</div>`;
  }
}

/** Deja el formulario del modal en blanco, listo para crear una familia nueva. */
function _clearFamiliaForm() {
  _currentEditFamiliaId = null;
  _pendingFamiliaImagenUrl = null;
  const titleEl = document.getElementById('fam-form-title');
  if (titleEl) titleEl.textContent = 'Familia de producto · nueva';
  document.getElementById('fam-categoria').value    = 'capilar';
  document.getElementById('fam-nombre').value       = '';
  document.getElementById('fam-slug').value         = '';
  document.getElementById('fam-orden').value        = '0';
  document.getElementById('fam-descripcion').value  = '';
  document.getElementById('fam-activo').checked     = true;
  document.getElementById('fam-imagen-thumb').innerHTML = `<i class="ti ti-photo" style="font-size:22px;"></i>`;
  const statusEl = document.getElementById('fam-imagen-status');
  if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
}

/** Abre el modal de Familia — vacío si id es null (nueva), o con los datos existentes si se pasa un id (editar). */
function openFamiliaModal(id) {
  if (id) {
    const f = _allFamiliasTab.find(x => x.id === id);
    if (!f) return;
    _currentEditFamiliaId = f.id;
    _pendingFamiliaImagenUrl = null;

    const titleEl = document.getElementById('fam-form-title');
    if (titleEl) titleEl.textContent = `Familia de producto · editando "${f.nombre_es}"`;
    document.getElementById('fam-categoria').value   = f.categoria?.slug || f.categoria_slug || 'capilar';
    document.getElementById('fam-nombre').value      = f.nombre_es || '';
    document.getElementById('fam-slug').value        = f.slug || '';
    document.getElementById('fam-orden').value       = f.orden ?? 0;
    document.getElementById('fam-descripcion').value = f.descripcion_es || '';
    document.getElementById('fam-activo').checked    = f.activo ?? true;
    document.getElementById('fam-imagen-thumb').innerHTML = f.imagen_url
      ? `<img src="${f.imagen_url}" alt="" style="width:100%;height:100%;object-fit:contain;">`
      : `<i class="ti ti-photo" style="font-size:22px;"></i>`;
    const statusEl = document.getElementById('fam-imagen-status');
    if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
  } else {
    _clearFamiliaForm();
  }
  modalFamiliaOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeFamiliaModal() {
  modalFamiliaOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btn-new-familia')?.addEventListener('click', () => openFamiliaModal(null));
document.getElementById('modal-familia-close')?.addEventListener('click', closeFamiliaModal);
document.getElementById('fam-cancel')?.addEventListener('click', closeFamiliaModal);
modalFamiliaOverlay?.addEventListener('click', (e) => {
  if (e.target === modalFamiliaOverlay) closeFamiliaModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalFamiliaOverlay?.classList.contains('open')) closeFamiliaModal();
});

async function _deleteFamiliaTab(id) {
  const f = _allFamiliasTab.find(x => x.id === id);
  const nombre = f?.nombre_es || id;
  if (!(await showConfirm(`¿Eliminar la familia "${nombre}"? Los productos que la usan quedarán sin familia asignada.`))) return;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await deleteFamilia(id);
      if (!ok) { await showAlert(`Error al eliminar: ${error?.message || 'desconocido'}`); return; }
    }
    _allFamiliasTab = _allFamiliasTab.filter(x => x.id !== id);
    _renderFamiliasTable();
    if (_currentEditFamiliaId === id) closeFamiliaModal();
    await _loadCatalogoAuxiliar(); // refresca selects de familia (modal producto + filtro toolbar)
  } catch (err) {
    console.error('[admin] Error al eliminar familia:', err);
    await showAlert(`Error al eliminar: ${err.message}`);
  }
}

document.getElementById('fam-imagen-btn')?.addEventListener('click', () => {
  document.getElementById('fam-imagen-input')?.click();
});

document.getElementById('fam-imagen-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  const slug = document.getElementById('fam-slug')?.value.trim() || '';
  if (!slug) {
    await showAlert('Ingresa el slug de la familia antes de subir la imagen (el archivo se nombra con ese slug).');
    return;
  }

  const statusEl = document.getElementById('fam-imagen-status');
  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.textContent = text;
    statusEl.style.color = tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-info)';
  }

  try {
    setStatus('Procesando imagen…');
    const blob = await processImageToWebp(file, FAMILIA_IMAGE_PRESET);
    setStatus('Subiendo…');
    // target: 'catalogo' — las familias viajan junto con productos si el
    // catálogo migra a un proyecto Supabase separado (ver 01_DECISIONS.md).
    const { ok, url, error } = await uploadAsset('familias', `${slug}.webp`, blob, { target: 'catalogo' });
    if (!ok) { setStatus(`Error al subir: ${error?.message || 'desconocido'}`, 'error'); return; }

    _pendingFamiliaImagenUrl = url;
    document.getElementById('fam-imagen-thumb').innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
    setStatus(USE_MOCK ? 'Vista previa lista (modo mock).' : `Imagen lista · se guardó como familias/${slug}.webp`);
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen de familia:', err);
    setStatus(`Error: ${err.message}`, 'error');
  }
});

document.getElementById('fam-save')?.addEventListener('click', async () => {
  const nombre = document.getElementById('fam-nombre')?.value.trim() || '';
  const slug   = document.getElementById('fam-slug')?.value.trim() || '';
  if (!nombre || !slug) {
    await showAlert('Nombre y slug son obligatorios.');
    return;
  }

  const esNuevo = !_currentEditFamiliaId;
  if (esNuevo && _allFamiliasTab.some(f => f.slug === slug)) {
    await showAlert(`Ya existe una familia con el slug "${slug}".`);
    return;
  }

  const existente = !esNuevo ? _allFamiliasTab.find(f => f.id === _currentEditFamiliaId) : null;
  const categoriaSlug = document.getElementById('fam-categoria')?.value || 'capilar';

  const familia = {
    categoria_slug: categoriaSlug,
    nombre_es:      nombre,
    slug,
    orden:           Number(document.getElementById('fam-orden')?.value) || 0,
    descripcion_es: document.getElementById('fam-descripcion')?.value.trim() || null,
    activo:         document.getElementById('fam-activo')?.checked ?? true,
    imagen_url:     _pendingFamiliaImagenUrl || existente?.imagen_url || null,
  };
  if (_currentEditFamiliaId) familia.id = _currentEditFamiliaId;

  try {
    let savedId = _currentEditFamiliaId;
    if (!USE_MOCK) {
      const { ok, error, data } = await upsertFamilia(familia);
      if (!ok) { await showAlert(`Error al guardar: ${error?.message || 'desconocido'}`); return; }
      savedId = data?.id || savedId;
    } else {
      savedId = savedId || `mock-${Date.now()}`;
    }

    const catOptionText = document.querySelector('#fam-categoria option:checked')?.textContent || categoriaSlug;
    const displayFamilia = {
      ...(existente || {}),
      ...familia,
      id: savedId,
      categoria: { slug: categoriaSlug, nombre_es: catOptionText },
    };
    const idx = _allFamiliasTab.findIndex(f => f.id === savedId);
    if (idx >= 0) _allFamiliasTab[idx] = displayFamilia; else _allFamiliasTab.push(displayFamilia);

    _renderFamiliasTable();
    closeFamiliaModal();
    await _loadCatalogoAuxiliar(); // refresca selects de familia (modal producto + filtro toolbar)
  } catch (err) {
    console.error('[admin] Error al guardar familia:', err);
    await showAlert(`Error al guardar: ${err.message}`);
  }
});

// Arrancar carga de este tab (se hace de una vez, sin esperar al click del
// tab, igual que el resto del dashboard — así el conteo/lista ya están
// listos si el usuario llega directo por el hash de la URL).
_loadFamiliasTab();

// ══════════════════════════════════════════════════════════
// TAB: INGREDIENTES — CRUD manual (no viene del Excel de ACS)
// Incluye el sub-tab "Familias de ingrediente" (tabla periódica: hoja,
// fruta, alga, semilla, mineral, flor, grano — el color de cada una se
// hereda por todos sus ingredientes).
// ══════════════════════════════════════════════════════════

let _allFamiliasIngrediente  = [];
let _allIngredientesTab      = [];
let _currentEditIngredienteId = null;
let _pendingIngFondoUrl       = null;
let _pendingIngDecorativaUrl  = null;

const modalIngredienteOverlay = document.getElementById('modal-ingrediente');

/** Blanco o negro según el brillo del color de fondo (para texto legible). */
function _autoTextColor(hex) {
  const h = (hex || '#888888').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
}

// ── Ingredientes: form + lista ───────────────────────────────

function _renderIngFamiliaSelect(selectedId = '') {
  const el = document.getElementById('ing-familia');
  if (!el) return;
  el.innerHTML = _allFamiliasIngrediente
    .map(f => `<option value="${f.id}">${f.nombre_es}</option>`).join('');
  if (selectedId && _allFamiliasIngrediente.some(f => f.id === selectedId)) el.value = selectedId;
  _updateIngColorPreview(el.value);
}

/** Refleja el color heredado de la familia elegida en el swatch y el tile de vista previa. */
function _updateIngColorPreview(familiaId) {
  const fam = _allFamiliasIngrediente.find(f => f.id === familiaId);
  const color = fam?.color || '#888888';
  const colorTexto = fam?.color_texto || _autoTextColor(color);

  const swatch = document.getElementById('ing-color-swatch');
  const input  = document.getElementById('ing-color-input');
  if (swatch) swatch.style.background = color;
  if (input)  input.value = color;

  const tile = document.getElementById('ing-tile-preview');
  if (tile) {
    tile.style.background = color;
    tile.style.color = colorTexto;
    const abrEl  = tile.querySelector('.ing-tile-preview__abbr');
    const nameEl = tile.querySelector('.ing-tile-preview__name');
    const abrev  = document.getElementById('ing-abreviatura')?.value.trim();
    const nombre = document.getElementById('ing-nombre')?.value.trim();
    if (abrEl)  abrEl.textContent  = abrev || '—';
    if (nameEl) nameEl.textContent = nombre || (fam ? fam.nombre_es : 'Sin familia');
  }
}

document.getElementById('ing-familia')?.addEventListener('change', (e) => _updateIngColorPreview(e.target.value));
document.getElementById('ing-abreviatura')?.addEventListener('input', () => _updateIngColorPreview(document.getElementById('ing-familia')?.value));
document.getElementById('ing-nombre')?.addEventListener('input', () => _updateIngColorPreview(document.getElementById('ing-familia')?.value));

function _buildIngredienteRow(i) {
  const famNombre = i.familia?.nombre_es || _allFamiliasIngrediente.find(f => f.id === i.familia_ingrediente_id)?.nombre_es || '—';
  const activeIcon = i.activo
    ? `<i class="ti ti-circle-check" style="font-size:17px;color:var(--color-text-success);" title="Activo"></i>`
    : `<i class="ti ti-circle" style="font-size:17px;color:var(--color-text-tertiary);" title="Inactivo"></i>`;
  return `
    <div style="display:grid;grid-template-columns:1fr 110px 70px 60px 64px;gap:8px;align-items:center;padding:10px 12px;border-top:0.5px solid var(--color-border-tertiary);font-size:13px;" data-ing-id="${i.id}">
      <span>${i.nombre_es}</span>
      <span style="font-size:12px;color:var(--color-text-secondary);">${famNombre}</span>
      <span class="badge-pill" style="background:${i.familia?.color || '#888'};color:${i.familia?.color_texto || '#fff'};">${i.abreviatura}</span>
      ${activeIcon}
      <div class="admin-table-actions">
        <button title="Editar" data-ing-edit="${i.id}"><i class="ti ti-edit"></i></button>
        <button class="del" title="Eliminar" data-ing-delete="${i.id}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`;
}

function _renderIngredientesTable() {
  const wrap  = document.getElementById('ing-table-body');
  const count = document.getElementById('ing-count');
  if (!wrap) return;

  wrap.innerHTML = _allIngredientesTab.length
    ? _allIngredientesTab.map(_buildIngredienteRow).join('')
    : `<div style="padding:32px;text-align:center;color:var(--color-text-tertiary);">Sin ingredientes todavía.</div>`;

  if (count) count.textContent = `(${_allIngredientesTab.length})`;

  wrap.querySelectorAll('[data-ing-edit]').forEach(btn => {
    btn.addEventListener('click', () => openIngredienteModal(btn.dataset.ingEdit));
  });
  wrap.querySelectorAll('[data-ing-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteIngredienteTab(btn.dataset.ingDelete));
  });
}

async function _loadIngredientesTab() {
  try {
    [_allFamiliasIngrediente, _allIngredientesTab] = await Promise.all([
      getFamiliasIngrediente({ activo: undefined }),
      getIngredientes({ activo: undefined }),
    ]);
    _renderIngFamiliaSelect();
    _renderIngredientesTable();
    _renderFiTable();
  } catch (err) {
    console.error('[admin] Error cargando ingredientes/familias de ingrediente:', err);
    const wrap = document.getElementById('ing-table-body');
    if (wrap) wrap.innerHTML = `<div style="padding:32px;text-align:center;color:var(--color-text-danger);">Error al cargar ingredientes: ${err.message}</div>`;
  }
}

/** Deja el formulario del modal en blanco, listo para crear un ingrediente nuevo. */
function _clearIngredienteForm() {
  _currentEditIngredienteId = null;
  _pendingIngFondoUrl = null;
  _pendingIngDecorativaUrl = null;
  const titleEl = document.getElementById('ing-form-title');
  if (titleEl) titleEl.textContent = 'Ingrediente · nuevo';
  document.getElementById('ing-abreviatura').value = '';
  document.getElementById('ing-nombre').value      = '';
  document.getElementById('ing-slug').value        = '';
  document.getElementById('ing-orden').value        = '0';
  document.getElementById('ing-descripcion').value = '';
  document.getElementById('ing-activo').checked    = true;
  document.getElementById('ing-fondo-thumb').innerHTML       = `<i class="ti ti-photo" style="font-size:13px;"></i>`;
  document.getElementById('ing-decorativa-thumb').innerHTML  = `<i class="ti ti-photo" style="font-size:13px;"></i>`;
  const statusEl = document.getElementById('ing-imagen-status');
  if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
  _renderIngFamiliaSelect();
}

/** Abre el modal de Ingrediente — vacío si id es null (nuevo), o con los datos existentes si se pasa un id (editar). */
function openIngredienteModal(id) {
  if (id) {
    const i = _allIngredientesTab.find(x => x.id === id);
    if (!i) return;
    _currentEditIngredienteId = i.id;
    _pendingIngFondoUrl = null;
    _pendingIngDecorativaUrl = null;

    const titleEl = document.getElementById('ing-form-title');
    if (titleEl) titleEl.textContent = `Ingrediente · editando "${i.nombre_es}"`;
    document.getElementById('ing-abreviatura').value = i.abreviatura || '';
    document.getElementById('ing-nombre').value      = i.nombre_es || '';
    document.getElementById('ing-slug').value        = i.slug || '';
    document.getElementById('ing-orden').value        = i.orden ?? 0;
    document.getElementById('ing-descripcion').value = i.descripcion_es || '';
    document.getElementById('ing-activo').checked    = i.activo ?? true;
    document.getElementById('ing-fondo-thumb').innerHTML = i.imagen_fondo_url
      ? `<img src="${i.imagen_fondo_url}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<i class="ti ti-photo" style="font-size:13px;"></i>`;
    document.getElementById('ing-decorativa-thumb').innerHTML = i.imagen_decorativa_url
      ? `<img src="${i.imagen_decorativa_url}" alt="" style="width:100%;height:100%;object-fit:contain;">`
      : `<i class="ti ti-photo" style="font-size:13px;"></i>`;
    const statusEl = document.getElementById('ing-imagen-status');
    if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
    _renderIngFamiliaSelect(i.familia_ingrediente_id || i.familia?.id || '');
  } else {
    _clearIngredienteForm();
  }
  modalIngredienteOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeIngredienteModal() {
  modalIngredienteOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btn-new-ingrediente')?.addEventListener('click', () => openIngredienteModal(null));
document.getElementById('modal-ingrediente-close')?.addEventListener('click', closeIngredienteModal);
document.getElementById('ing-cancel')?.addEventListener('click', closeIngredienteModal);
modalIngredienteOverlay?.addEventListener('click', (e) => {
  if (e.target === modalIngredienteOverlay) closeIngredienteModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalIngredienteOverlay?.classList.contains('open')) closeIngredienteModal();
});

async function _deleteIngredienteTab(id) {
  const i = _allIngredientesTab.find(x => x.id === id);
  const nombre = i?.nombre_es || id;
  if (!(await showConfirm(`¿Eliminar el ingrediente "${nombre}"? Los productos que lo usan como ingrediente principal quedarán sin ese dato.`))) return;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await deleteIngrediente(id);
      if (!ok) { await showAlert(`Error al eliminar: ${error?.message || 'desconocido'}`); return; }
    }
    _allIngredientesTab = _allIngredientesTab.filter(x => x.id !== id);
    _renderIngredientesTable();
    if (_currentEditIngredienteId === id) closeIngredienteModal();
    await _loadCatalogoAuxiliar(); // refresca select de ingrediente principal en el modal de producto
  } catch (err) {
    console.error('[admin] Error al eliminar ingrediente:', err);
    await showAlert(`Error al eliminar: ${err.message}`);
  }
}

document.getElementById('ing-fondo-btn')?.addEventListener('click', () => document.getElementById('ing-fondo-input')?.click());
document.getElementById('ing-decorativa-btn')?.addEventListener('click', () => document.getElementById('ing-decorativa-input')?.click());

function _setIngImagenStatus(text, tone) {
  const statusEl = document.getElementById('ing-imagen-status');
  if (!statusEl) return;
  statusEl.style.display = 'block';
  statusEl.textContent = text;
  statusEl.style.color = tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-info)';
}

document.getElementById('ing-fondo-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const slug = document.getElementById('ing-slug')?.value.trim() || '';
  if (!slug) { await showAlert('Ingresa el slug del ingrediente antes de subir la imagen de fondo.'); return; }
  try {
    _setIngImagenStatus('Procesando imagen de fondo…');
    const blob = await processImageToWebp(file, INGREDIENTE_FONDO_PRESET);
    _setIngImagenStatus('Subiendo…');
    const { ok, url, error } = await uploadAsset('ingredientes', `${slug}-fondo.webp`, blob, { target: 'catalogo' });
    if (!ok) { _setIngImagenStatus(`Error al subir: ${error?.message || 'desconocido'}`, 'error'); return; }
    _pendingIngFondoUrl = url;
    document.getElementById('ing-fondo-thumb').innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    _setIngImagenStatus(USE_MOCK ? 'Vista previa lista (modo mock).' : 'Imagen de fondo lista.');
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen de fondo:', err);
    _setIngImagenStatus(`Error: ${err.message}`, 'error');
  }
});

document.getElementById('ing-decorativa-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const slug = document.getElementById('ing-slug')?.value.trim() || '';
  if (!slug) { await showAlert('Ingresa el slug del ingrediente antes de subir la imagen decorativa.'); return; }
  try {
    _setIngImagenStatus('Procesando imagen decorativa…');
    // Sin fondo blanco ni recorte a preset fijo — es un gráfico superpuesto,
    // no una imagen "en un recuadro" (ver processImageToWebpTransparent()).
    const blob = await processImageToWebpTransparent(file);
    _setIngImagenStatus('Subiendo…');
    const { ok, url, error } = await uploadAsset('ingredientes', `${slug}-decorativa.webp`, blob, { target: 'catalogo' });
    if (!ok) { _setIngImagenStatus(`Error al subir: ${error?.message || 'desconocido'}`, 'error'); return; }
    _pendingIngDecorativaUrl = url;
    document.getElementById('ing-decorativa-thumb').innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
    _setIngImagenStatus(USE_MOCK ? 'Vista previa lista (modo mock).' : 'Imagen decorativa lista.');
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen decorativa:', err);
    _setIngImagenStatus(`Error: ${err.message}`, 'error');
  }
});

document.getElementById('ing-save')?.addEventListener('click', async () => {
  const nombre = document.getElementById('ing-nombre')?.value.trim() || '';
  const slug   = document.getElementById('ing-slug')?.value.trim() || '';
  const abreviatura = document.getElementById('ing-abreviatura')?.value.trim() || '';
  const familiaId = document.getElementById('ing-familia')?.value || '';
  if (!nombre || !slug || !abreviatura) {
    await showAlert('Nombre, slug y abreviatura son obligatorios.');
    return;
  }
  if (!familiaId) {
    await showAlert('Elige una familia de ingrediente — el color se hereda de ahí.');
    return;
  }

  const esNuevo = !_currentEditIngredienteId;
  if (esNuevo && _allIngredientesTab.some(i => i.slug === slug)) {
    await showAlert(`Ya existe un ingrediente con el slug "${slug}".`);
    return;
  }

  const existente = !esNuevo ? _allIngredientesTab.find(i => i.id === _currentEditIngredienteId) : null;
  const ingrediente = {
    familia_ingrediente_id: familiaId,
    slug,
    abreviatura,
    nombre_es:        nombre,
    orden:             Number(document.getElementById('ing-orden')?.value) || 0,
    descripcion_es:   document.getElementById('ing-descripcion')?.value.trim() || null,
    activo:           document.getElementById('ing-activo')?.checked ?? true,
    imagen_fondo_url:      _pendingIngFondoUrl      || existente?.imagen_fondo_url      || null,
    imagen_decorativa_url: _pendingIngDecorativaUrl || existente?.imagen_decorativa_url || null,
  };
  if (_currentEditIngredienteId) ingrediente.id = _currentEditIngredienteId;

  try {
    let savedId = _currentEditIngredienteId;
    if (!USE_MOCK) {
      const { ok, error, data } = await upsertIngrediente(ingrediente);
      if (!ok) { await showAlert(`Error al guardar: ${error?.message || 'desconocido'}`); return; }
      savedId = data?.id || savedId;
    } else {
      savedId = savedId || `mock-${Date.now()}`;
    }

    const famObj = _allFamiliasIngrediente.find(f => f.id === familiaId);
    const displayIngrediente = {
      ...(existente || {}),
      ...ingrediente,
      id: savedId,
      familia: famObj
        ? { id: famObj.id, slug: famObj.slug, nombre_es: famObj.nombre_es, color: famObj.color, color_texto: famObj.color_texto }
        : null,
    };
    const idx = _allIngredientesTab.findIndex(i => i.id === savedId);
    if (idx >= 0) _allIngredientesTab[idx] = displayIngrediente; else _allIngredientesTab.push(displayIngrediente);

    _renderIngredientesTable();
    closeIngredienteModal();
    await _loadCatalogoAuxiliar(); // refresca select de ingrediente principal en el modal de producto
  } catch (err) {
    console.error('[admin] Error al guardar ingrediente:', err);
    await showAlert(`Error al guardar: ${err.message}`);
  }
});

// ── Familias de ingrediente ("tabla periódica") ──────────────
// Filas fijas conceptualmente (hoja/fruta/alga/semilla/mineral/flor/grano)
// pero editables como cualquier registro — "Añadir familia" permite sumar
// categorías nuevas si algún día se necesitan.

let _fiDraftRows = []; // filas nuevas sin guardar todavía (aparecen al final)

function _buildFiRow(f, idx) {
  const color = f.color || '#888888';
  return `
    <div class="fam-ing-grid" data-fi-idx="${idx}" data-fi-id="${f.id || ''}">
      <label class="fam-color-swatch" style="background:${color};position:relative;overflow:hidden;display:inline-block;">
        <input type="color" value="${color}" data-fi-color style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;">
      </label>
      <input value="${f.nombre_es || ''}" data-fi-nombre placeholder="Nombre">
      <input value="${f.abreviatura || ''}" data-fi-abrev maxlength="3" placeholder="Ab">
      <input type="number" value="${f.orden ?? idx + 1}" data-fi-orden>
      <button class="btn" data-fi-save type="button" style="font-size:12px;padding:6px 8px;">Guardar</button>
      <button class="btn btn-danger" data-fi-delete type="button" title="Eliminar" style="font-size:12px;padding:6px 8px;"><i class="ti ti-trash"></i></button>
    </div>`;
}

function _renderFiTable() {
  const wrap = document.getElementById('fi-table-body');
  if (!wrap) return;
  const rows = [..._allFamiliasIngrediente, ..._fiDraftRows];
  wrap.innerHTML = rows.map((f, idx) => _buildFiRow(f, idx)).join('');

  wrap.querySelectorAll('[data-fi-save]').forEach(btn => {
    btn.addEventListener('click', () => _saveFiRow(btn.closest('[data-fi-idx]')));
  });
  wrap.querySelectorAll('[data-fi-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteFiRow(btn.closest('[data-fi-idx]')));
  });
  wrap.querySelectorAll('[data-fi-color]').forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.closest('.fam-color-swatch').style.background = e.target.value;
    });
  });
}

async function _saveFiRow(rowEl) {
  if (!rowEl) return;
  const id     = rowEl.dataset.fiId || null;
  const nombre = rowEl.querySelector('[data-fi-nombre]')?.value.trim() || '';
  const abrev  = rowEl.querySelector('[data-fi-abrev]')?.value.trim() || '';
  const orden  = Number(rowEl.querySelector('[data-fi-orden]')?.value) || 0;
  const color  = rowEl.querySelector('[data-fi-color]')?.value || '#888888';

  if (!nombre || !abrev) { await showAlert('Nombre y abreviatura son obligatorios.'); return; }

  // Idx dentro de la lista combinada [existentes...drafts] con la que se
  // pintó esta fila — si cae después de las existentes, es un draft nuevo.
  const rowIdx = Number(rowEl.dataset.fiIdx);
  const isDraft = !id;
  const draftPos = isDraft ? rowIdx - _allFamiliasIngrediente.length : -1;

  const slug = id
    ? (_allFamiliasIngrediente.find(f => f.id === id)?.slug || nombre.toLowerCase().replace(/\s+/g, '-'))
    : nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');

  const familiaIngrediente = {
    slug,
    nombre_es:    nombre,
    abreviatura:  abrev,
    color,
    color_texto: _autoTextColor(color),
    orden,
    activo: true,
  };
  if (id) familiaIngrediente.id = id;

  try {
    let savedId = id;
    if (!USE_MOCK) {
      const { ok, error, data } = await upsertFamiliaIngrediente(familiaIngrediente);
      if (!ok) { await showAlert(`Error al guardar: ${error?.message || 'desconocido'}`); return; }
      savedId = data?.id || savedId;
    } else {
      savedId = savedId || `mock-${Date.now()}`;
    }
    const saved = { ...familiaIngrediente, id: savedId };
    const idx = _allFamiliasIngrediente.findIndex(f => f.id === savedId);
    if (idx >= 0) _allFamiliasIngrediente[idx] = saved; else _allFamiliasIngrediente.push(saved);
    if (isDraft && draftPos >= 0 && draftPos < _fiDraftRows.length) _fiDraftRows.splice(draftPos, 1);

    _allFamiliasIngrediente.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    _renderFiTable();
    _renderIngFamiliaSelect(document.getElementById('ing-familia')?.value);
  } catch (err) {
    console.error('[admin] Error al guardar familia de ingrediente:', err);
    await showAlert(`Error al guardar: ${err.message}`);
  }
}

/** Elimina una familia de ingrediente (tabla periódica) — o simplemente
 * descarta la fila si todavía no se había guardado (draft sin id). */
async function _deleteFiRow(rowEl) {
  if (!rowEl) return;
  const id = rowEl.dataset.fiId || null;

  // Draft sin guardar: se descarta localmente, sin tocar la DB.
  if (!id) {
    const rowIdx = Number(rowEl.dataset.fiIdx);
    const draftPos = rowIdx - _allFamiliasIngrediente.length;
    if (draftPos >= 0 && draftPos < _fiDraftRows.length) _fiDraftRows.splice(draftPos, 1);
    _renderFiTable();
    return;
  }

  const nombre = rowEl.querySelector('[data-fi-nombre]')?.value.trim()
    || _allFamiliasIngrediente.find(f => f.id === id)?.nombre_es
    || id;
  if (!(await showConfirm(`¿Eliminar la familia de ingrediente "${nombre}"? Los ingredientes que la usan quedarán sin familia asignada.`))) return;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await deleteFamiliaIngrediente(id);
      if (!ok) { await showAlert(`Error al eliminar: ${error?.message || 'desconocido'}`); return; }
    }
    _allFamiliasIngrediente = _allFamiliasIngrediente.filter(f => f.id !== id);
    _renderFiTable();
    _renderIngFamiliaSelect(document.getElementById('ing-familia')?.value);
  } catch (err) {
    console.error('[admin] Error al eliminar familia de ingrediente:', err);
    await showAlert(`Error al eliminar: ${err.message}`);
  }
}

document.getElementById('fi-add-btn')?.addEventListener('click', () => {
  const draft = { id: null, nombre_es: '', abreviatura: '', color: '#888888', orden: _allFamiliasIngrediente.length + _fiDraftRows.length + 1 };
  _fiDraftRows.push(draft);
  _renderFiTable();
});

// Arrancar carga de este tab.
_loadIngredientesTab();

// ══════════════════════════════════════════════════════════
// TAB: BANNERS — carrusel del home (tabla banners) +
// banner de categoría mayor (categorias.imagen_url)
// ══════════════════════════════════════════════════════════

let _allBanners             = [];
let _categoriasCache        = [];
let _currentEditBannerId    = null;
let _pendingBannerDesktopUrl = null;
let _pendingBannerMobileUrl  = null;

const modalBannerOverlay = document.getElementById('modal-banner');

// ── Carrusel del home ─────────────────────────────────────

function _buildBannerRow(b) {
  const activeIcon = b.activo
    ? `<i class="ti ti-circle-check" style="font-size:17px; color:var(--color-text-success);"></i>`
    : `<i class="ti ti-circle" style="font-size:17px; color:var(--color-text-tertiary);"></i>`;
  return `
    <div class="banner-row" data-ban-id="${b.id}">
      <i class="ti ti-grip-vertical drag-handle" style="font-size:16px;"></i>
      <div class="banner-thumb">
        ${b.imagen_desktop_url
          ? `<img src="${b.imagen_desktop_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
          : `<i class="ti ti-photo" style="font-size:14px;"></i>`
        }
      </div>
      <div class="banner-info">
        <strong>${b.titulo_es || '(sin título)'}</strong><br>
        <span>${b.enlace_url ? `→ ${b.enlace_url} · ` : ''}${b.imagen_desktop_url ? 'desktop' : 'sin desktop'} + ${b.imagen_mobile_url ? 'móvil' : 'sin móvil'}</span>
      </div>
      ${activeIcon}
      <button class="btn btn-ghost" title="Editar" data-ban-edit="${b.id}"><i class="ti ti-edit" style="font-size:16px;"></i></button>
      <button class="btn btn-danger" title="Eliminar" data-ban-delete="${b.id}"><i class="ti ti-trash" style="font-size:16px;"></i></button>
    </div>`;
}

function _renderBannersTable() {
  const wrap  = document.getElementById('ban-table-body');
  const count = document.getElementById('ban-count');
  if (!wrap) return;

  wrap.innerHTML = _allBanners.length
    ? _allBanners.map(_buildBannerRow).join('')
    : `<div style="padding:24px;text-align:center;color:var(--color-text-tertiary);">Sin slides todavía.</div>`;

  if (count) count.textContent = `(${_allBanners.length})`;

  wrap.querySelectorAll('[data-ban-edit]').forEach(btn => {
    btn.addEventListener('click', () => openBannerModal(btn.dataset.banEdit));
  });
  wrap.querySelectorAll('[data-ban-delete]').forEach(btn => {
    btn.addEventListener('click', () => _deleteBannerTab(btn.dataset.banDelete));
  });
}

/** Deja el formulario del modal en blanco, listo para crear un slide nuevo. */
function _clearBannerForm() {
  _currentEditBannerId = null;
  _pendingBannerDesktopUrl = null;
  _pendingBannerMobileUrl  = null;
  const titleEl = document.getElementById('ban-form-title');
  if (titleEl) titleEl.textContent = 'Carrusel del home · nuevo slide';
  document.getElementById('ban-titulo-es').value = '';
  document.getElementById('ban-titulo-en').value = '';
  document.getElementById('ban-enlace').value    = '';
  document.getElementById('ban-orden').value      = '0';
  document.getElementById('ban-activo').checked  = true;
  document.getElementById('ban-desktop-thumb').innerHTML = `<i class="ti ti-photo" style="font-size:18px;"></i>`;
  document.getElementById('ban-mobile-thumb').innerHTML  = `<i class="ti ti-photo" style="font-size:18px;"></i>`;
  const statusEl = document.getElementById('ban-imagen-status');
  if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
}

/** Abre el modal de slide — vacío si id es null (nuevo), o con los datos existentes si se pasa un id (editar). */
function openBannerModal(id) {
  if (id) {
    const b = _allBanners.find(x => x.id === id);
    if (!b) return;
    _currentEditBannerId = b.id;
    _pendingBannerDesktopUrl = null;
    _pendingBannerMobileUrl  = null;

    const titleEl = document.getElementById('ban-form-title');
    if (titleEl) titleEl.textContent = `Carrusel del home · editando "${b.titulo_es || b.id}"`;
    document.getElementById('ban-titulo-es').value = b.titulo_es || '';
    document.getElementById('ban-titulo-en').value = b.titulo_en || '';
    document.getElementById('ban-enlace').value    = b.enlace_url || '';
    document.getElementById('ban-orden').value      = b.orden ?? 0;
    document.getElementById('ban-activo').checked  = b.activo ?? true;
    document.getElementById('ban-desktop-thumb').innerHTML = b.imagen_desktop_url
      ? `<img src="${b.imagen_desktop_url}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<i class="ti ti-photo" style="font-size:18px;"></i>`;
    document.getElementById('ban-mobile-thumb').innerHTML = b.imagen_mobile_url
      ? `<img src="${b.imagen_mobile_url}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<i class="ti ti-photo" style="font-size:18px;"></i>`;
    const statusEl = document.getElementById('ban-imagen-status');
    if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
  } else {
    _clearBannerForm();
  }
  modalBannerOverlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBannerModal() {
  modalBannerOverlay?.classList.remove('open');
  document.body.style.overflow = '';
}

async function _deleteBannerTab(id) {
  const b = _allBanners.find(x => x.id === id);
  const nombre = b?.titulo_es || id;
  if (!(await showConfirm(`¿Eliminar el slide "${nombre}" del carrusel del home?`))) return;

  try {
    if (!USE_MOCK) {
      const { ok, error } = await deleteBanner(id);
      if (!ok) { await showAlert(`Error al eliminar: ${error?.message || 'desconocido'}`); return; }
    }
    _allBanners = _allBanners.filter(x => x.id !== id);
    _renderBannersTable();
    if (_currentEditBannerId === id) closeBannerModal();
  } catch (err) {
    console.error('[admin] Error al eliminar banner:', err);
    await showAlert(`Error al eliminar: ${err.message}`);
  }
}

async function _loadBannersTab() {
  try {
    [_allBanners, _categoriasCache] = await Promise.all([
      getBanners({ activo: undefined }),
      getCategorias(),
    ]);
    _renderBannersTable();
    _renderCategoriaCards();
  } catch (err) {
    console.error('[admin] Error cargando banners/categorías:', err);
    const wrap = document.getElementById('ban-table-body');
    if (wrap) wrap.innerHTML = `<div style="padding:24px;text-align:center;color:var(--color-text-danger);">Error al cargar: ${err.message}</div>`;
  }
}

document.getElementById('btn-new-banner')?.addEventListener('click', () => openBannerModal(null));
document.getElementById('modal-banner-close')?.addEventListener('click', closeBannerModal);
document.getElementById('ban-cancel')?.addEventListener('click', closeBannerModal);
modalBannerOverlay?.addEventListener('click', (e) => {
  if (e.target === modalBannerOverlay) closeBannerModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalBannerOverlay?.classList.contains('open')) closeBannerModal();
});

document.getElementById('ban-desktop-btn')?.addEventListener('click', () => document.getElementById('ban-desktop-input')?.click());
document.getElementById('ban-mobile-btn')?.addEventListener('click', () => document.getElementById('ban-mobile-input')?.click());

function _setBanImagenStatus(text, tone) {
  const statusEl = document.getElementById('ban-imagen-status');
  if (!statusEl) return;
  statusEl.style.display = 'block';
  statusEl.textContent = text;
  statusEl.style.color = tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-info)';
}

// Nombre de archivo estable: usa el id del slide si ya existe; si es nuevo
// (todavía sin guardar) usa un sufijo temporal — los banners no tienen slug.
function _bannerFileBase() {
  return _currentEditBannerId || `nuevo-${Date.now()}`;
}

document.getElementById('ban-desktop-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    _setBanImagenStatus('Procesando imagen desktop…');
    const blob = await processImageToWebpCover(file, CARRUSEL_DESKTOP_PRESET);
    _setBanImagenStatus('Subiendo…');
    const { ok, url, error } = await uploadAsset('banners', `${_bannerFileBase()}-desktop.webp`, blob, { target: 'site' });
    if (!ok) { _setBanImagenStatus(`Error al subir: ${error?.message || 'desconocido'}`, 'error'); return; }
    _pendingBannerDesktopUrl = url;
    document.getElementById('ban-desktop-thumb').innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    _setBanImagenStatus(USE_MOCK ? 'Vista previa lista (modo mock).' : 'Imagen desktop lista.');
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen desktop del banner:', err);
    _setBanImagenStatus(`Error: ${err.message}`, 'error');
  }
});

document.getElementById('ban-mobile-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    _setBanImagenStatus('Procesando imagen móvil…');
    const blob = await processImageToWebpCover(file, CARRUSEL_MOBILE_PRESET);
    _setBanImagenStatus('Subiendo…');
    const { ok, url, error } = await uploadAsset('banners', `${_bannerFileBase()}-mobile.webp`, blob, { target: 'site' });
    if (!ok) { _setBanImagenStatus(`Error al subir: ${error?.message || 'desconocido'}`, 'error'); return; }
    _pendingBannerMobileUrl = url;
    document.getElementById('ban-mobile-thumb').innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    _setBanImagenStatus(USE_MOCK ? 'Vista previa lista (modo mock).' : 'Imagen móvil lista.');
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen móvil del banner:', err);
    _setBanImagenStatus(`Error: ${err.message}`, 'error');
  }
});

document.getElementById('ban-save')?.addEventListener('click', async () => {
  const tituloEs = document.getElementById('ban-titulo-es')?.value.trim() || '';
  if (!tituloEs) { await showAlert('El título (ES) es obligatorio — identifica el slide en esta lista.'); return; }

  const existente = _currentEditBannerId ? _allBanners.find(b => b.id === _currentEditBannerId) : null;
  const banner = {
    titulo_es:  tituloEs,
    titulo_en:  document.getElementById('ban-titulo-en')?.value.trim() || null,
    enlace_url: document.getElementById('ban-enlace')?.value.trim() || null,
    orden:      Number(document.getElementById('ban-orden')?.value) || 0,
    activo:     document.getElementById('ban-activo')?.checked ?? true,
    imagen_desktop_url: _pendingBannerDesktopUrl || existente?.imagen_desktop_url || null,
    imagen_mobile_url:  _pendingBannerMobileUrl  || existente?.imagen_mobile_url  || null,
  };
  if (_currentEditBannerId) banner.id = _currentEditBannerId;

  try {
    let savedId = _currentEditBannerId;
    if (!USE_MOCK) {
      const { ok, error, data } = await upsertBanner(banner);
      if (!ok) { await showAlert(`Error al guardar: ${error?.message || 'desconocido'}`); return; }
      savedId = data?.id || savedId;
    } else {
      savedId = savedId || `mock-${Date.now()}`;
    }
    const displayBanner = { ...(existente || {}), ...banner, id: savedId };
    const idx = _allBanners.findIndex(b => b.id === savedId);
    if (idx >= 0) _allBanners[idx] = displayBanner; else _allBanners.push(displayBanner);

    _renderBannersTable();
    closeBannerModal();
  } catch (err) {
    console.error('[admin] Error al guardar banner:', err);
    await showAlert(`Error al guardar: ${err.message}`);
  }
});

// ── Banner de categoría mayor (categorias.imagen_url) ────────

const CATEGORIA_NOMBRES = { capilar: 'Cuidado Capilar', facial: 'Cuidado Facial', corporal: 'Cuidado Corporal' };
let _catEditandoSlug = null; // qué categoría está esperando el archivo elegido en #ban-cat-input

function _buildCategoriaCard(c) {
  return `
    <div class="banner-cat-card" data-cat-slug="${c.slug}">
      <div class="banner-cat-thumb">
        ${c.imagen_url
          ? `<img src="${c.imagen_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`
          : `<i class="ti ti-photo" style="font-size:18px;"></i>`
        }
      </div>
      <span class="banner-cat-name">${c.nombre_es || CATEGORIA_NOMBRES[c.slug] || c.slug}</span>
      <button class="btn" data-cat-edit="${c.slug}" style="font-size:12px;padding:5px 10px;width:100%;">Editar</button>
    </div>`;
}

function _renderCategoriaCards() {
  const grid = document.getElementById('ban-cat-grid');
  if (!grid) return;
  grid.innerHTML = _categoriasCache.map(_buildCategoriaCard).join('');
  grid.querySelectorAll('[data-cat-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      _catEditandoSlug = btn.dataset.catEdit;
      document.getElementById('ban-cat-input')?.click();
    });
  });
}

document.getElementById('ban-cat-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  const slug = _catEditandoSlug;
  _catEditandoSlug = null;
  if (!file || !slug) return;

  try {
    const blob = await processImageToWebpCover(file, CATEGORIA_IMAGE_PRESET);
    const { ok, url, error } = await uploadAsset('categorias', `${slug}.webp`, blob, { target: 'site' });
    if (!ok) { await showAlert(`Error al subir: ${error?.message || 'desconocido'}`); return; }

    if (!USE_MOCK) {
      const cat = _categoriasCache.find(c => c.slug === slug);
      const { ok: okSave, error: errSave } = await upsertCategoria({ id: cat?.id, slug, imagen_url: url });
      if (!okSave) { await showAlert(`Error al guardar: ${errSave?.message || 'desconocido'}`); return; }
    }

    const idx = _categoriasCache.findIndex(c => c.slug === slug);
    if (idx >= 0) _categoriasCache[idx] = { ..._categoriasCache[idx], imagen_url: url };
    _renderCategoriaCards();
  } catch (err) {
    console.error('[admin] Error procesando/subiendo imagen de categoría:', err);
    await showAlert(`Error: ${err.message}`);
  }
});

// Arrancar carga de este tab.
_loadBannersTab();

// ══════════════════════════════════════════════════════════
// TAB: AJUSTES — config singleton (id = 1)
// ══════════════════════════════════════════════════════════

let _configCache = null;

document.getElementById('aj-en-activo')?.addEventListener('change', (e) => {
  const label = document.getElementById('aj-en-label');
  if (label) label.textContent = e.target.checked ? 'EN activado' : 'EN desactivado';
});

async function _loadAjustes() {
  try {
    _configCache = await getConfig();
    const idiomas = _configCache?.idiomas_activos || { es: true, en: false };
    const redes   = _configCache?.redes || {};
    const presets = _configCache?.presets_imagen || {};

    document.getElementById('aj-en-activo').checked = !!idiomas.en;
    document.getElementById('aj-en-label').textContent = idiomas.en ? 'EN activado' : 'EN desactivado';
    document.getElementById('aj-email').value     = _configCache?.email_contacto || '';
    document.getElementById('aj-facebook').value  = redes.facebook || '';
    document.getElementById('aj-instagram').value = redes.instagram || '';
    document.getElementById('aj-url-usa').value   = _configCache?.url_sitio_usa || '';

    const cd = presets.carrusel_desktop  || { w: 1920, h: 760 };
    const pr = presets.producto          || { w: 800,  h: 800 };
    const ig = presets.ingrediente_fondo || { w: 1920, h: 700 };
    const ct = presets.categoria         || { w: 600,  h: 600 };
    document.getElementById('aj-preset-carrusel-w').value  = cd.w;
    document.getElementById('aj-preset-carrusel-h').value  = cd.h;
    document.getElementById('aj-preset-producto-w').value  = pr.w;
    document.getElementById('aj-preset-producto-h').value  = pr.h;
    document.getElementById('aj-preset-ingfondo-w').value  = ig.w;
    document.getElementById('aj-preset-ingfondo-h').value  = ig.h;
    document.getElementById('aj-preset-categoria-w').value = ct.w;
    document.getElementById('aj-preset-categoria-h').value = ct.h;
  } catch (err) {
    console.error('[admin] Error cargando ajustes:', err);
  }
}

document.getElementById('aj-save')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('aj-status');
  function setStatus(text, tone) {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    statusEl.textContent = text;
    statusEl.style.color = tone === 'error' ? 'var(--color-text-danger)' : 'var(--color-text-info)';
  }

  // Se parte de los presets ya existentes y solo se pisan las 4 keys que
  // este formulario expone — así no se pierden "carrusel_mobile"/"banner",
  // que hoy no tienen UI propia en Ajustes.
  const presetsBase = _configCache?.presets_imagen || {};
  const config = {
    idiomas_activos: { es: true, en: document.getElementById('aj-en-activo')?.checked ?? false },
    email_contacto:  document.getElementById('aj-email')?.value.trim() || null,
    redes: {
      ...(_configCache?.redes || {}),
      facebook:  document.getElementById('aj-facebook')?.value.trim() || null,
      instagram: document.getElementById('aj-instagram')?.value.trim() || null,
    },
    url_sitio_usa: document.getElementById('aj-url-usa')?.value.trim() || null,
    presets_imagen: {
      ...presetsBase,
      carrusel_desktop:  { w: Number(document.getElementById('aj-preset-carrusel-w')?.value) || 1920, h: Number(document.getElementById('aj-preset-carrusel-h')?.value) || 760, fit: 'cover' },
      producto:          { w: Number(document.getElementById('aj-preset-producto-w')?.value) || 800,  h: Number(document.getElementById('aj-preset-producto-h')?.value) || 800,  fit: 'contain' },
      ingrediente_fondo: { w: Number(document.getElementById('aj-preset-ingfondo-w')?.value) || 1920, h: Number(document.getElementById('aj-preset-ingfondo-h')?.value) || 700,  fit: 'cover' },
      categoria:         { w: Number(document.getElementById('aj-preset-categoria-w')?.value) || 600, h: Number(document.getElementById('aj-preset-categoria-h')?.value) || 600, fit: 'cover' },
    },
  };

  try {
    setStatus('Guardando…');
    if (!USE_MOCK) {
      const { ok, error, data } = await upsertConfig(config);
      if (!ok) { setStatus(`Error al guardar: ${error?.message || 'desconocido'}`, 'error'); return; }
      _configCache = data || { ..._configCache, ...config };
    } else {
      _configCache = { ..._configCache, ...config };
    }
    setStatus(USE_MOCK ? 'Guardado (modo mock, no persiste).' : 'Ajustes guardados.');
  } catch (err) {
    console.error('[admin] Error al guardar ajustes:', err);
    setStatus(`Error: ${err.message}`, 'error');
  }
});

// Arrancar carga de este tab.
_loadAjustes();
