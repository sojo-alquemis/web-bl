/* ============================================================
   i18n.js — Diccionario UI, t(), pickLang(), flag EN
   TODO: implementar en Fase 4
   ============================================================ */

const LANG_FLAG = { es: true, en: false }; // EN desactivado en público

export function pickLang() {
  return 'es'; // TODO: leer de localStorage / config
}

export function t(key) {
  return key; // TODO: implementar diccionario
}
