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

import { getCatalogoClient, USE_MOCK } from './db.js';

export const PRODUCT_IMAGE_PRESET = { w: 800, h: 800 };

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
