/* ============================================================
   main.js — Pegamento global (init, header/footer, helpers)
   TODO Fase 4: conectar con Supabase, i18n, region modal
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Marcar link activo en el nav
  const path = window.location.pathname;
  document.querySelectorAll('.site-header__nav a').forEach(a => {
    const href = a.getAttribute('href')?.split('?')[0] ?? '';
    if (href && path.includes(href.split('/').pop())) {
      a.style.fontWeight = '700';
    }
  });
});
