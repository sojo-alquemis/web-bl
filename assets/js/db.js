/* ============================================================
   db.js — Capa de datos universal
   ┌─────────────────────────────────────────────────────────┐
   │  USE_MOCK = true  → datos del mock local (desarrollo)   │
   │  USE_MOCK = false → Supabase real (producción)          │
   │  Para el switch: solo cambiar esta bandera + las creds  │
   └─────────────────────────────────────────────────────────┘
   Importar en cualquier página o script:
     import { getProductos, getBanners } from '/assets/js/db.js';
   ============================================================ */

import {
  MOCK_PRODUCTOS,
  MOCK_FAMILIAS,
  MOCK_FAMILIAS_INGREDIENTE,
  MOCK_INGREDIENTES,
  MOCK_BANNERS,
  MOCK_CATEGORIAS,
} from '../../data/productos.mock.js';  // ajustar ruta relativa al importador

// ── ① TOGGLE AQUÍ ─────────────────────────────────────────────
const USE_MOCK = true;

// ── ② Credenciales Supabase (solo aplican si USE_MOCK = false) ─
const SUPABASE_URL  = 'https://TU_PROJECT.supabase.co';  // TODO
const SUPABASE_KEY  = 'TU_ANON_KEY';                      // TODO

// ── ③ Cliente Supabase (lazy, solo se instancia si USE_MOCK=false)
let _sb = null;
async function _client() {
  if (_sb) return _sb;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
  _sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _sb;
}

// ══════════════════════════════════════════════════════════════
// HELPERS INTERNOS — normalizan mock → misma forma que Supabase
// ══════════════════════════════════════════════════════════════

/** Devuelve el ingrediente normalizado con color heredado de su familia */
function _normIngrediente(ing) {
  const fam = MOCK_FAMILIAS_INGREDIENTE.find(f => f.slug === ing.familia) || {};
  return {
    abreviatura:  ing.abreviatura,
    nombre_es:    ing.nombre_es,
    nombre_en:    ing.nombre_en || null,
    slug:         ing.slug || ing.nombre_es.toLowerCase().replace(/\s+/g, '-'),
    descripcion_es: ing.descripcion_es || null,
    familia: {
      slug:        fam.slug  || ing.familia,
      nombre_es:   fam.nombre_es || ing.familia,
      color:       fam.color || ing.color,
      color_texto: fam.color_texto || '#ffffff',
    },
    // Shorthand directo (más práctico para badges)
    color:       fam.color       || ing.color,
    color_texto: fam.color_texto || '#ffffff',
    orden:   ing.orden  || 0,
    activo:  !!ing.activo,
  };
}

/** Normaliza un producto del mock → misma forma que devolvería Supabase con joins */
function _normProducto(p) {
  const fam    = MOCK_FAMILIAS.find(f => f.slug === p.familia_slug) || {};
  const cat    = MOCK_CATEGORIAS.find(c => c.slug === p.categoria)  || {};
  const ingRaw = p.ingrediente_principal;
  // Coco tiene color propio (#FBB500) que difiere de su familia 'fruta' (#EF9F27).
  // Preservamos el color del mock hasta confirmar con el sitio real.
  const ingFam = ingRaw
    ? MOCK_FAMILIAS_INGREDIENTE.find(f => f.slug === ingRaw.familia)
    : null;

  return {
    codigo:          p.codigo,
    slug:            p.slug,
    ean_upc:         p.ean_upc         || null,
    nombre_es:       p.nombre_es,
    nombre_en:       p.nombre_en       || null,
    tipo_es:         p.tipo_es         || null,
    tipo_en:         p.tipo_en         || null,
    tamano_ml:       p.tamano_ml       || null,
    descripcion_es:  p.descripcion_es  || null,
    descripcion_en:  p.descripcion_en  || null,
    no_contiene_es:  p.no_contiene_es  || null,
    no_contiene_en:  p.no_contiene_en  || null,
    ingredientes_es: p.ingredientes_es || null,
    ingredientes_en: p.ingredientes_en || null,
    imagen_url:      p.imagen_url      || null,
    destacado:       !!p.destacado,
    activo:          !!p.activo,
    orden:           p.orden || 0,
    // Relaciones anidadas (misma forma que Supabase devuelve los joins)
    categoria: {
      slug:     cat.slug     || p.categoria,
      nombre_es: cat.nombre_es || p.categoria,
    },
    familia: {
      slug:      fam.slug    || p.familia_slug,
      nombre_es: fam.nombre_es || p.familia_nombre_es,
      imagen_url: fam.imagen_url || null,
    },
    ingrediente_principal: ingRaw ? {
      abreviatura:  ingRaw.abreviatura,
      nombre_es:    ingRaw.nombre_es,
      // Usa color del mock (puede diferir del canónico de la familia; ver NOTA en mock)
      color:        ingRaw.color,
      color_texto:  ingRaw.color_texto,
      familia: ingFam ? {
        slug:        ingFam.slug,
        nombre_es:   ingFam.nombre_es,
        color:       ingFam.color,
        color_texto: ingFam.color_texto,
      } : null,
    } : null,
  };
}

// ══════════════════════════════════════════════════════════════
// API PÚBLICA
// ══════════════════════════════════════════════════════════════

// ── Categorías ───────────────────────────────────────────────

export async function getCategorias() {
  if (USE_MOCK) {
    return MOCK_CATEGORIAS.filter(c => c.activo).sort((a, b) => a.orden - b.orden);
  }
  const { data, error } = await (await _client())
    .from('categorias').select('*').eq('activo', true).order('orden');
  if (error) throw error;
  return data;
}

// ── Familias de producto ─────────────────────────────────────

export async function getFamilias({ categoria } = {}) {
  if (USE_MOCK) {
    let r = MOCK_FAMILIAS.filter(f => f.activo);
    if (categoria) r = r.filter(f => f.categoria === categoria);
    return r.sort((a, b) => a.orden - b.orden);
  }
  const sb = await _client();
  let q = sb.from('familias')
    .select('*, categoria:categorias(slug, nombre_es)')
    .eq('activo', true).order('orden');
  const { data, error } = await q;
  if (error) throw error;
  // Filtro post-fetch por slug de categoría (join ya trae el objeto)
  return categoria
    ? data.filter(f => f.categoria?.slug === categoria)
    : data;
}

export async function upsertFamilia(familia) {
  if (USE_MOCK) { console.warn('[db] upsertFamilia en mock — no persiste'); return { ok: true }; }
  const { error } = await (await _client()).from('familias').upsert(familia);
  return { ok: !error, error };
}

// ── Familias de ingrediente (tabla periódica) ─────────────────

export async function getFamiliasIngrediente() {
  if (USE_MOCK) {
    return MOCK_FAMILIAS_INGREDIENTE.filter(f => f.activo).sort((a, b) => a.orden - b.orden);
  }
  const { data, error } = await (await _client())
    .from('familias_ingrediente').select('*').eq('activo', true).order('orden');
  if (error) throw error;
  return data;
}

// ── Ingredientes ──────────────────────────────────────────────

export async function getIngredientes({ familia } = {}) {
  if (USE_MOCK) {
    let r = MOCK_INGREDIENTES.filter(i => i.activo);
    if (familia) r = r.filter(i => i.familia === familia);
    return r.sort((a, b) => a.orden - b.orden).map(_normIngrediente);
  }
  let q = (await _client())
    .from('ingredientes')
    .select('*, familia:familias_ingrediente(slug, nombre_es, color, color_texto)')
    .eq('activo', true).order('orden');
  if (familia) q = q.eq('familias_ingrediente.slug', familia);
  const { data, error } = await q;
  if (error) throw error;
  // Flatten color desde join anidado
  return (data || []).map(i => ({
    ...i,
    color:       i.familia?.color       || null,
    color_texto: i.familia?.color_texto || '#ffffff',
  }));
}

export async function upsertIngrediente(ingrediente) {
  if (USE_MOCK) { console.warn('[db] upsertIngrediente en mock — no persiste'); return { ok: true }; }
  const { error } = await (await _client()).from('ingredientes').upsert(ingrediente);
  return { ok: !error, error };
}

// ── Productos ─────────────────────────────────────────────────

/**
 * @param {object} [opts]
 * @param {string}  [opts.categoria]   slug de categoría ('capilar'|'facial'|'corporal')
 * @param {string}  [opts.familia_slug] slug de familia
 * @param {boolean} [opts.activo]      default true
 * @param {boolean} [opts.destacado]   si se pasa, filtra por destacado
 */
export async function getProductos({ categoria, familia_slug, activo = true, destacado } = {}) {
  if (USE_MOCK) {
    let r = [...MOCK_PRODUCTOS];
    if (activo    !== undefined) r = r.filter(p => p.activo    === activo);
    if (destacado !== undefined) r = r.filter(p => p.destacado === destacado);
    if (categoria)   r = r.filter(p => p.categoria   === categoria);
    if (familia_slug) r = r.filter(p => p.familia_slug === familia_slug);
    return r.sort((a, b) => a.orden - b.orden).map(_normProducto);
  }
  const sb = await _client();
  let q = sb.from('productos').select(`
    *,
    categoria:categorias(slug, nombre_es),
    familia:familias(slug, nombre_es, imagen_url),
    ingrediente_principal:ingredientes(
      abreviatura, nombre_es,
      familia_ingrediente:familias_ingrediente(color, color_texto)
    )
  `).order('orden');
  if (activo    !== undefined) q = q.eq('activo', activo);
  if (destacado !== undefined) q = q.eq('destacado', destacado);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    ingrediente_principal: p.ingrediente_principal ? {
      ...p.ingrediente_principal,
      color:       p.ingrediente_principal.familia_ingrediente?.color       || null,
      color_texto: p.ingrediente_principal.familia_ingrediente?.color_texto || '#ffffff',
    } : null,
  }));
}

/**
 * Trae un producto por slug, incluyendo sus relacionados.
 */
export async function getProducto(slug) {
  if (USE_MOCK) {
    const p = MOCK_PRODUCTOS.find(p => p.slug === slug);
    if (!p) return null;
    const norm = _normProducto(p);
    // Relacionados: por ahora vacío en mock (agregar manualmente si es necesario)
    norm.relacionados = [];
    return norm;
  }
  const { data, error } = await (await _client()).from('productos').select(`
    *,
    categoria:categorias(slug, nombre_es),
    familia:familias(slug, nombre_es, imagen_url),
    ingrediente_principal:ingredientes(
      abreviatura, nombre_es,
      familia_ingrediente:familias_ingrediente(color, color_texto)
    ),
    relacionados:producto_relacionados(
      orden,
      producto:productos(
        codigo, slug, nombre_es, tipo_es, tamano_ml, imagen_url,
        ingrediente_principal:ingredientes(
          abreviatura, nombre_es,
          familia_ingrediente:familias_ingrediente(color, color_texto)
        )
      )
    )
  `).eq('slug', slug).single();
  if (error) throw error;
  return {
    ...data,
    ingrediente_principal: data.ingrediente_principal ? {
      ...data.ingrediente_principal,
      color:       data.ingrediente_principal.familia_ingrediente?.color,
      color_texto: data.ingrediente_principal.familia_ingrediente?.color_texto,
    } : null,
  };
}

export async function upsertProducto(producto) {
  if (USE_MOCK) { console.warn('[db] upsertProducto en mock — no persiste'); return { ok: true }; }
  const { error } = await (await _client()).from('productos').upsert(producto);
  return { ok: !error, error };
}

export async function deleteProducto(codigo) {
  if (USE_MOCK) { console.warn('[db] deleteProducto en mock — no persiste'); return { ok: true }; }
  const { error } = await (await _client()).from('productos').delete().eq('codigo', codigo);
  return { ok: !error, error };
}

// ── Banners ───────────────────────────────────────────────────

export async function getBanners() {
  if (USE_MOCK) {
    return MOCK_BANNERS.filter(b => b.activo).sort((a, b) => a.orden - b.orden);
  }
  const { data, error } = await (await _client())
    .from('banners').select('*').eq('activo', true).order('orden');
  if (error) throw error;
  return data;
}

export async function upsertBanner(banner) {
  if (USE_MOCK) { console.warn('[db] upsertBanner en mock — no persiste'); return { ok: true }; }
  const { error } = await (await _client()).from('banners').upsert(banner);
  return { ok: !error, error };
}

export async function deleteBanner(id) {
  if (USE_MOCK) { console.warn('[db] deleteBanner en mock — no persiste'); return { ok: true }; }
  const { error } = await (await _client()).from('banners').delete().eq('id', id);
  return { ok: !error, error };
}
