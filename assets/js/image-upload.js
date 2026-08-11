/* ============================================================
   image-upload.js — Procesamiento y subida de imágenes de producto
   ┌───────────────────────────────────────────────────────────┐
   │  Un producto = una sola imagen. Se renombra siempre a      │
   │  "{codigo}.webp" y se sube a productos/ dentro del bucket  │
   │  "media" (mismo bucket, subcarpetas por sección — ver      │
   │  supabase_schema.sql § STORAGE: productos/ | banners/ |    │
   │  ingredientes/ | secciones/ | branding/).                   │
   │                                                             │
   │  Antes de subir, la imagen se ajusta al preset (por ahora   │
   │  fijo en 800×800 — el mismo valor que "producto" en         │
   │  config.presets_imagen del schema) dejando el LADO MÁS      │
   │  LARGO ajustado al tamaño objetivo (fit "contain", nunca    │
   │  recorta contenido) y rellenando el resto con fondo         │
   │  blanco. Luego se convierte a WebP para bajar el peso.      │
   │  Al subir a la misma ruta ({codigo}.webp) con upsert:true,  │
   │  la imagen anterior del producto queda reemplazada — nunca  │
   │  hay más de una imagen por producto.                        │
   └───────────────────────────────────────────────────────────┘
   ============================================================ */

import { getCatalogoClient, getSiteClient, USE_MOCK } from './db.js';

export const PRODUCT_IMAGE_PRESET  = { w: 800,  h: 800 };
// Valores tomados 1:1 de config.presets_imagen en supabase_schema.sql
// (sección "8. Config singleton con presets de imagen reales"). Los que
// ahí son fit:"cover" (recortan para llenar el recuadro) usan
// processImageToWebpCover(); FAMILIA_IMAGE_PRESET no tiene una key propia
// en el schema — se reusa el tamaño de "categoria" pero en modo "contain"
// (fondo blanco, sin recortar) porque una familia es una foto de producto,
// no un banner de fondo.
export const FAMILIA_IMAGE_PRESET      = { w: 600,  h: 600 };  // contain
export const INGREDIENTE_FONDO_PRESET  = { w: 1920, h: 700 };  // contain
export const BANNER_IMAGE_PRESET       = { w: 1200, h: 600 };  // preset "banner" del schema (sin uso de UI propio todavía)
export const CARRUSEL_DESKTOP_PRESET   = { w: 1920, h: 760 };  // cover — home, imagen_desktop_url
export const CARRUSEL_MOBILE_PRESET    = { w: 768,  h: 900 };  // cover — home, imagen_mobile_url
export const CATEGORIA_IMAGE_PRESET    = { w: 600,  h: 600 };  // cover — categorias.imagen_url ("banner de categoría mayor")
// Sin key propia en el schema (páginas/bloques de contenido son nuevos,
// Fase de admin manual) — se define acá con un tamaño razonable de foto
// de contenido en modo "cover".
export const CONTENIDO_BLOQUE_PRESET   = { w: 960,  h: 720 };  // cover — bloques_contenido.imagen_url

export function productImageCaption(preset = PRODUCT_IMAGE_PRESET) {
  return `Tamaño requerido: ${preset.w}×${preset.h}px · fondo blanco · se convierte a WebP automáticamente.`;
}

function _loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

/**
 * Ajusta una imagen (File/Blob) al preset dado: el lado más largo llega
 * exacto al tamaño objetivo (fit "contain", sin recortar contenido) y el
 * resto del lienzo se rellena con fondo blanco. Devuelve un Blob WebP.
 */
export async function processImageToWebp(file, preset = PRODUCT_IMAGE_PRESET, quality = 0.85) {
  const img = await _loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = preset.w;
  canvas.height = preset.h;
  const ctx = canvas.getContext('2d');

  // Fondo blanco — el "relleno" que pide el requerimiento.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, preset.w, preset.h);

  // Escala "contain": min() asegura que el lado más largo llegue exacto
  // al tamaño objetivo sin que el otro lado se salga del lienzo.
  const scale = Math.min(preset.w / img.width, preset.h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (preset.w - drawW) / 2;
  const dy = (preset.h - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el WebP.'))),
      'image/webp',
      quality
    );
  });
}

/**
 * Ajusta una imagen al preset dado con fit "cover": escala hasta llenar
 * todo el recuadro (nunca deja franjas vacías) y recorta el excedente
 * centrado — a diferencia de processImageToWebp(), que nunca recorta y
 * rellena con blanco. Pensada para banners/hero images, donde sí es
 * preferible perder un poco de los bordes a que se vea con marco blanco.
 */
export async function processImageToWebpCover(file, preset = BANNER_IMAGE_PRESET, quality = 0.85) {
  const img = await _loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = preset.w;
  canvas.height = preset.h;
  const ctx = canvas.getContext('2d');

  // Escala "cover": max() asegura que el lienzo quede completamente
  // cubierto (el lado que sobra se recorta al centrar el dibujo).
  const scale = Math.max(preset.w / img.width, preset.h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (preset.w - drawW) / 2;
  const dy = (preset.h - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el WebP.'))),
      'image/webp',
      quality
    );
  });
}

/**
 * Convierte a WebP preservando transparencia y el tamaño natural de la
 * imagen (SIN fondo blanco ni recorte a un preset fijo). Pensada para
 * gráficos superpuestos como la "imagen decorativa" de un ingrediente,
 * que se dibuja encima de otro contenido y perdería sentido si se le
 * rellenara el fondo — a diferencia de processImageToWebp(), que sí
 * asume un fondo blanco porque sus imágenes van solas en un recuadro.
 */
export async function processImageToWebpTransparent(file, quality = 0.9) {
  const img = await _loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar el WebP.'))),
      'image/webp',
      quality
    );
  });
}

/**
 * Sube el WebP ya procesado como "{codigo}.webp" a productos/ dentro del
 * bucket "media", sobrescribiendo si ya existía (upsert). Devuelve la URL
 * pública a guardar en productos.imagen_url.
 *
 * En modo mock no hay Storage real: devuelve un object URL de solo
 * vista previa en esta sesión del navegador (no persiste al recargar).
 */
export async function uploadProductoImagen(codigo, blob) {
  if (!codigo) throw new Error('Falta el código del producto — no se puede nombrar el archivo.');
  const path = `productos/${codigo}.webp`;

  if (USE_MOCK) {
    console.warn('[image-upload] modo mock — no se sube a Storage, solo vista previa local');
    return { ok: true, url: URL.createObjectURL(blob), path };
  }

  const sb = await getCatalogoClient();
  const { error } = await sb.storage.from('media').upload(path, blob, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (error) return { ok: false, error };

  const { data } = sb.storage.from('media').getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}

/**
 * Versión genérica de la subida de arriba, para cualquier asset del sitio
 * que no sea imagen de producto (familias, ingredientes, banners...).
 * `target` elige el cliente Supabase: 'catalogo' (familias/ingredientes —
 * viajan junto con productos si el catálogo migra a ACS) o 'site' (banners,
 * contenido — se quedan siempre en la DB del sitio).
 */
export async function uploadAsset(folder, filename, blob, { contentType = 'image/webp', target = 'catalogo' } = {}) {
  const path = `${folder}/${filename}`;

  if (USE_MOCK) {
    console.warn('[image-upload] modo mock — no se sube a Storage, solo vista previa local');
    return { ok: true, url: URL.createObjectURL(blob), path };
  }

  const sb = target === 'site' ? await getSiteClient() : await getCatalogoClient();
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType, upsert: true });
  if (error) return { ok: false, error };

  const { data } = sb.storage.from('media').getPublicUrl(path);
  return { ok: true, url: data.publicUrl, path };
}
