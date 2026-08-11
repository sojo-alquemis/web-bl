/* ============================================================
   auth.js — Login y manejo de sesión de admin
   TODO Fase 5: conectar con Supabase Auth
   ============================================================ */

(function () {
  'use strict';

  // ── Stub: si ya hay sesión activa → redirigir al dashboard ─
  // TODO: reemplazar con supabase.auth.getSession()
  const isLoggedIn = sessionStorage.getItem('bl_admin_session');
  if (isLoggedIn && window.location.pathname.endsWith('index.html')) {
    window.location.replace('dashboard.html');
  }

  // ── Manejo del formulario de login ─────────────────────────
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    const email = form.email.value.trim();
    const password = form.password.value;

    // TODO Fase 5: autenticar con Supabase
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Stub: credenciales hardcodeadas para desarrollo
    if (email === 'admin@bio-land.com' && password === 'bioland2024') {
      sessionStorage.setItem('bl_admin_session', '1');
      window.location.replace('dashboard.html');
    } else {
      if (errorEl) { errorEl.style.display = 'block'; }
      form.password.value = '';
      form.password.focus();
    }
  });
})();
