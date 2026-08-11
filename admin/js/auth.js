/* ============================================================
   auth.js — Login y manejo de sesión de admin
   ┌───────────────────────────────────────────────────────────┐
   │  USE_MOCK = true  (en db.js) → valida contra credenciales │
   │  fijas localmente (sin red). Útil para desarrollar sin     │
   │  depender de que la DB ya exista.                          │
   │                                                             │
   │  USE_MOCK = false → autentica de verdad contra Supabase    │
   │  Auth (DB del sitio) con supabase.auth.signInWithPassword. │
   │  El usuario admin es "hardcodeado" en el sentido de que    │
   │  hoy solo existe UNA cuenta de administrador — pero esa    │
   │  cuenta vive en la tabla de Supabase Auth, no en el código.│
   │                                                             │
   │  Antes de poner USE_MOCK = false, crear el usuario en:     │
   │  Supabase Dashboard → Authentication → Users → Add user    │
   │    email:    erick.sojo@alquemis.com                       │
   │    password: Arte2026*                                     │
   └───────────────────────────────────────────────────────────┘
   ============================================================ */

import { USE_MOCK, getSiteClient } from '../../assets/js/db.js';

// Credenciales de desarrollo (solo se usan si USE_MOCK = true).
// En producción (USE_MOCK = false) la contraseña real vive únicamente
// en Supabase Auth, nunca en este archivo.
const MOCK_ADMIN_EMAIL    = 'erick.sojo@alquemis.com';
const MOCK_ADMIN_PASSWORD = 'Arte2026*';

// ── Stub: si ya hay sesión activa → redirigir al dashboard ─
const isLoggedIn = sessionStorage.getItem('bl_admin_session');
if (isLoggedIn && window.location.pathname.endsWith('index.html')) {
  window.location.replace('dashboard.html');
}

// ── Manejo del formulario de login ─────────────────────────
const form = document.getElementById('login-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    const email = form.email.value.trim();
    const password = form.password.value;

    function showError(msg) {
      if (errorEl) {
        errorEl.textContent = msg || 'Correo o contraseña incorrectos.';
        errorEl.style.display = 'block';
      }
      form.password.value = '';
      form.password.focus();
    }

    if (USE_MOCK) {
      if (email === MOCK_ADMIN_EMAIL && password === MOCK_ADMIN_PASSWORD) {
        sessionStorage.setItem('bl_admin_session', '1');
        sessionStorage.setItem('bl_admin_email', email);
        window.location.replace('dashboard.html');
      } else {
        showError();
      }
      return;
    }

    // Producción: autenticación real contra Supabase Auth (DB del sitio)
    try {
      const sb = await getSiteClient();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data?.session) {
        showError();
        return;
      }
      sessionStorage.setItem('bl_admin_session', '1');
      sessionStorage.setItem('bl_admin_email', email);
      window.location.replace('dashboard.html');
    } catch (err) {
      console.error('[auth] Error al autenticar:', err);
      showError('No se pudo conectar. Intenta de nuevo.');
    }
  });
}
