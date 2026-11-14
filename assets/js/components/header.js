/** Шапка: фон при прокрутке, мобильное меню, активный пункт навигации. */
(function () {
  'use strict';
  const { qs, qsa } = AQ.utils;

  AQ.components.header = {
    init() {
      const header = qs('[data-header]');
      const nav = qs('[data-nav]');
      const burger = qs('[data-burger]');
      if (!header) return;

      // Фон шапки
      const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      // Мобильное меню
      const setOpen = (open) => {
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
        nav.classList.toggle('is-open', open);
        document.documentElement.classList.toggle('menu-open', open);
        if (open) qs('a', nav)?.focus({ preventScroll: true });
      };
      burger?.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
      nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); burger.focus(); }
      });
      window.matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });

    }
  };
})();
