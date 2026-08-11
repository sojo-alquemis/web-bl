/* ============================================================
   header.js — Inyecta el nav en todas las páginas públicas
   Uso: <script src="../components/header.js"></script>
        (ajustar profundidad del path con data-root)
   ============================================================ */

(function () {
  const root = document.currentScript?.dataset?.root ?? '..';

  /* ── CSS ─────────────────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* Mobile menu — full-width top dropdown (igual al original) */
    .mobile-menu {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 40;
      padding-top: 64px; /* clearance below header */
      background: linear-gradient(to right,
        rgba(255,255,255,0.5),
        rgba(255,255,255,0.5) 60%,
        rgba(165,243,248,0.5));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      /* Slide from top */
      transform: translateY(-100%);
      visibility: hidden;
      transition: transform 0.35s cubic-bezier(0.4,0,0.2,1),
                  visibility 0s linear 0.35s;
    }
    .mobile-menu.is-open {
      transform: translateY(0);
      visibility: visible;
      transition: transform 0.35s cubic-bezier(0.4,0,0.2,1),
                  visibility 0s linear 0s;
    }
    .mobile-menu__nav {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      padding: 16px 32px 24px;
    }
    .mobile-menu__nav a {
      font-size: 15px;
      font-weight: 500;
      color: #001689;
      text-decoration: none;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 8px 0;
      transition: opacity 0.15s;
    }
    .mobile-menu__nav a:hover { opacity: 0.65; }
    .mobile-menu__lang {
      border: 1px solid #001689;
      color: #001689;
      background: transparent;
      padding: 4px 8px;
      font-family: inherit;
      font-size: 13px;
      margin-top: 8px;
    }
    /* Swap hamburger ↔ × in header */
    .site-header__hamburger-btn .icon-hamburger { display: block; }
    .site-header__hamburger-btn .icon-close     { display: none; }
    .site-header__hamburger-btn.is-open .icon-hamburger { display: none; }
    .site-header__hamburger-btn.is-open .icon-close     { display: block; }
    @media (min-width: 1280px) {
      .mobile-menu { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  /* ── Header HTML ─────────────────────────────────────────── */
  const nav = document.createElement('nav');
  nav.className = 'site-header';
  nav.innerHTML = `
    <div class="site-header__inner">
      <a aria-label="Home" class="site-header__logo" href="${root}/index.html">
        <img src="${root}/assets/img/bioland-logo-nav.svg" alt="Bioland Logo" width="120" height="24">
      </a>

      <nav class="site-header__nav">
        <a href="${root}/pages/nosotros.html">Quienes Somos</a>
        <span class="nav-dot" aria-hidden="true"></span>
        <a href="${root}/pages/catalogo.html?cat=capilar">Capilar</a>
        <span class="nav-dot" aria-hidden="true"></span>
        <a href="${root}/pages/catalogo.html?cat=facial">Facial</a>
        <span class="nav-dot" aria-hidden="true"></span>
        <a href="${root}/pages/catalogo.html?cat=corporal">Corporal</a>
        <span class="nav-dot" aria-hidden="true"></span>
        <a href="${root}/pages/ingredientes.html">Ingredientes</a>
        <span class="nav-dot" aria-hidden="true"></span>
        <a href="${root}/pages/contacto.html">Contacto</a>
      </nav>

      <div class="site-header__actions-desktop">
        <button class="site-header__search-btn" aria-label="Buscar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19.6 21L13.3 14.7C12.8 15.1 12.225 15.417 11.575 15.65C10.925 15.883 10.233 16 9.5 16C7.683 16 6.146 15.371 4.888 14.113C3.629 12.854 3 11.317 3 9.5C3 7.683 3.629 6.146 4.888 4.888C6.146 3.629 7.683 3 9.5 3C11.317 3 12.854 3.629 14.113 4.888C15.371 6.146 16 7.683 16 9.5C16 10.233 15.883 10.925 15.65 11.575C15.417 12.225 15.1 12.8 14.7 13.3L21 19.6L19.6 21ZM9.5 14C10.75 14 11.813 13.563 12.688 12.688C13.563 11.813 14 10.75 14 9.5C14 8.25 13.563 7.188 12.688 6.313C11.813 5.438 10.75 5 9.5 5C8.25 5 7.188 5.438 6.313 6.313C5.438 7.188 5 8.25 5 9.5C5 10.75 5.438 11.813 6.313 12.688C7.188 13.563 8.25 14 9.5 14Z" fill="#001689"/>
          </svg>
        </button>
        <div class="site-header__lang-divider"></div>
        <select class="site-header__lang">
          <option value="es" selected>Español</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="site-header__actions-mobile">
        <button class="site-header__icon-btn" aria-label="Buscar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19.6 21L13.3 14.7C12.8 15.1 12.225 15.417 11.575 15.65C10.925 15.883 10.233 16 9.5 16C7.683 16 6.146 15.371 4.888 14.113C3.629 12.854 3 11.317 3 9.5C3 7.683 3.629 6.146 4.888 4.888C6.146 3.629 7.683 3 9.5 3C11.317 3 12.854 3.629 14.113 4.888C15.371 6.146 16 7.683 16 9.5C16 10.233 15.883 10.925 15.65 11.575C15.417 12.225 15.1 12.8 14.7 13.3L21 19.6L19.6 21ZM9.5 14C10.75 14 11.813 13.563 12.688 12.688C13.563 11.813 14 10.75 14 9.5C14 8.25 13.563 7.188 12.688 6.313C11.813 5.438 10.75 5 9.5 5C8.25 5 7.188 5.438 6.313 6.313C5.438 7.188 5 8.25 5 9.5C5 10.75 5.438 11.813 6.313 12.688C7.188 13.563 8.25 14 9.5 14Z" fill="#001689"/>
          </svg>
        </button>
        <div class="site-header__cyan-divider"></div>
        <button class="site-header__icon-btn site-header__hamburger-btn" aria-label="Menú" aria-expanded="false" aria-controls="mobile-menu">
          <span class="icon-hamburger">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M21 7H3V5H21V7ZM21 13H3V11H21V13ZM3 19H21V17H3V19Z" fill="#001689"/>
            </svg>
          </span>
          <span class="icon-close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#001689" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
        </button>
      </div>
    </div>
  `;

  /* ── Mobile menu dropdown ────────────────────────────────── */
  const drawer = document.createElement('div');
  drawer.className = 'mobile-menu';
  drawer.id = 'mobile-menu';
  drawer.setAttribute('aria-label', 'Menú de navegación');
  drawer.innerHTML = `
    <nav class="mobile-menu__nav">
      <a href="${root}/pages/nosotros.html">Quienes Somos</a>
      <a href="${root}/pages/catalogo.html?cat=capilar">Capilar</a>
      <a href="${root}/pages/catalogo.html?cat=facial">Facial</a>
      <a href="${root}/pages/catalogo.html?cat=corporal">Corporal</a>
      <a href="${root}/pages/ingredientes.html">Ingredientes</a>
      <a href="${root}/pages/contacto.html">Contacto</a>
      <select class="mobile-menu__lang">
        <option value="es" selected>Español</option>
        <option value="en">English</option>
      </select>
    </nav>
  `;

  document.body.insertBefore(nav, document.body.firstChild);
  document.body.insertBefore(drawer, document.body.firstChild);

  /* ── Toggle ─────────────────────────────────────────────── */
  const hamburgerBtn = nav.querySelector('.site-header__hamburger-btn');

  function openMenu() {
    drawer.classList.add('is-open');
    hamburgerBtn.classList.add('is-open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    drawer.classList.remove('is-open');
    hamburgerBtn.classList.remove('is-open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleMenu() {
    drawer.classList.contains('is-open') ? closeMenu() : openMenu();
  }

  hamburgerBtn.addEventListener('click', toggleMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ── Mark active link ───────────────────────────────────── */
  const current = window.location.pathname;
  [...nav.querySelectorAll('a'), ...drawer.querySelectorAll('a')].forEach(a => {
    const href = a.getAttribute('href')?.split('?')[0] ?? '';
    if (href && current.includes(href.split('/').pop())) {
      a.style.fontWeight = '700';
    }
  });
})();
