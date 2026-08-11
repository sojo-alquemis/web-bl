/* ============================================================
   footer.js — Inyecta el footer en todas las páginas públicas
   ============================================================ */

(function () {
  const root = document.currentScript?.dataset?.root ?? '..';

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="site-footer__inner">
      <div class="site-footer__logo-side">
        <img src="${root}/assets/img/bioland-logo.svg" alt="Bioland Logo" width="320" height="65"
             style="filter:brightness(0) invert(1); max-width:230px; width:100%;">
      </div>
      <div class="site-footer__links-side">
        <a href="https://www.facebook.com/biolandoficial" target="_blank" rel="noreferrer"
           aria-label="Facebook" class="site-footer__social-link">
          <span class="site-footer__social-icon">
            <svg width="23" height="24" viewBox="0 0 23 24" fill="none">
              <path d="M22.08 0.28H0.92C0.411 0.28 0 0.692 0 1.201V22.361C0 22.87 0.411 23.281 0.92 23.281H22.08C22.589 23.281 23 22.87 23 22.361V1.201C23 0.692 22.589 0.28 22.08 0.28ZM19.424 6.994H17.586C16.146 6.994 15.867 7.679 15.867 8.685V10.901H19.306L18.857 14.372H15.867V23.281H12.282V14.374H9.283V10.901H12.282V8.343C12.282 5.373 14.096 3.754 16.747 3.754C18.018 3.754 19.107 3.849 19.427 3.892V6.994H19.424Z" fill="white"/>
            </svg>
          </span>
          <span class="site-footer__social-label">biolandoficial</span>
        </a>
        <a href="https://www.instagram.com/bioland/" target="_blank" rel="noreferrer"
           aria-label="Instagram" class="site-footer__social-link">
          <span class="site-footer__social-icon">
            <svg width="23" height="24" viewBox="0 0 23 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M4.929 0.281C3.622 0.281 2.369 0.8 1.444 1.724C0.52 2.648 0 3.901 0 5.208V18.352C0 19.659 0.519 20.913 1.444 21.838C2.368 22.762 3.622 23.281 4.929 23.281H18.073C19.38 23.281 20.633 22.762 21.558 21.838C22.482 20.913 23 19.659 23 18.352V5.208C23 3.901 22.482 2.648 21.558 1.724C20.633 0.8 19.38 0.281 18.073 0.281H4.929ZM11.5 6.781C9.842 6.781 8.252 7.439 7.08 8.611C5.908 9.783 5.25 11.373 5.25 13.031C5.25 14.689 5.908 16.279 7.08 17.451C8.252 18.623 9.842 19.281 11.5 19.281C13.158 19.281 14.748 18.623 15.92 17.451C17.092 16.279 17.75 14.689 17.75 13.031C17.75 11.373 17.092 9.783 15.92 8.611C14.748 7.439 13.158 6.781 11.5 6.781ZM11.5 8.781C12.627 8.781 13.708 9.229 14.505 10.026C15.302 10.823 15.75 11.904 15.75 13.031C15.75 14.158 15.302 15.239 14.505 16.036C13.708 16.833 12.627 17.281 11.5 17.281C10.373 17.281 9.292 16.833 8.495 16.036C7.698 15.239 7.25 14.158 7.25 13.031C7.25 11.904 7.698 10.823 8.495 10.026C9.292 9.229 10.373 8.781 11.5 8.781ZM18.25 5.281C17.836 5.281 17.438 5.446 17.144 5.74C16.849 6.034 16.684 6.432 16.684 6.847C16.684 7.261 16.849 7.659 17.144 7.953C17.438 8.248 17.836 8.413 18.25 8.413C18.664 8.413 19.062 8.248 19.356 7.953C19.651 7.659 19.816 7.261 19.816 6.847C19.816 6.432 19.651 6.034 19.356 5.74C19.062 5.446 18.664 5.281 18.25 5.281Z" fill="white"/>
            </svg>
          </span>
          <span class="site-footer__social-label">bioland</span>
        </a>
        <a href="mailto:contacto@bio-land.com" class="site-footer__email">
          <span class="site-footer__email-icon">
            <svg width="23" height="19" viewBox="0 0 23 19" fill="none">
              <path d="M23 5.58V14.944C23 15.898 22.635 16.817 21.979 17.511C21.324 18.205 20.427 18.622 19.474 18.681L19.263 18.681H3.738C2.783 18.681 1.864 18.316 1.17 17.66C0.477 17.005 0.06 16.109 0.006 15.155L0 14.944V5.58L11.1 11.395C11.223 11.46 11.361 11.493 11.5 11.493C11.639 11.493 11.777 11.46 11.9 11.395L23 5.58ZM3.738 0.281H19.263C20.189 0.281 21.082 0.625 21.77 1.246C22.457 1.868 22.889 2.722 22.982 3.644L11.5 9.658L0.018 3.644C0.108 2.759 0.51 1.934 1.152 1.319C1.795 0.704 2.636 0.338 3.524 0.287L3.738 0.281Z" fill="white"/>
            </svg>
          </span>
          contacto@bio-land.com
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
})();
