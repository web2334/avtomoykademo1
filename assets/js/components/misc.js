/** Небольшие компоненты: счётчики, статус «открыто», год в футере. */
(function () {
  'use strict';
  const { qsa, qs, ease } = AQ.utils;

  AQ.components.counters = {
    init() {
      const els = qsa('[data-counter]');
      if (!els.length || AQ.env.reducedMotion || !('IntersectionObserver' in window)) return;
      const fmt = (el, v) => {
        const dec = parseInt(el.dataset.decimals || '0', 10);
        el.textContent = dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toLocaleString('ru-RU');
      };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const el = entry.target;
          const to = parseFloat(el.dataset.counter);
          const t0 = performance.now(), dur = 1600;
          const tick = (ts) => {
            const t = Math.min(1, (ts - t0) / dur);
            fmt(el, to * ease.outQuart(t));
            if (t < 1) requestAnimationFrame(tick);
          };
          fmt(el, 0);
          requestAnimationFrame(tick);
        });
      }, { threshold: 0.6 });
      els.forEach((el) => io.observe(el));
    }
  };

  AQ.components.openStatus = {
    init() {
      const el = qs('[data-open-status]');
      if (!el) return;
      // Время в Москве (UTC+3)
      const now = new Date();
      const mskHour = (now.getUTCHours() + 3) % 24;
      const { open, close } = AQ.config.hours;
      const isOpen = mskHour >= open && mskHour < close;
      el.textContent = isOpen ? `Сейчас открыто · до ${close}:00` : `Сейчас закрыто · откроемся в 0${open}:00`;
      el.classList.toggle('is-open', isOpen);
    }
  };

  AQ.components.footer = {
    init() {
      qsa('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
    }
  };
})();

/**
 * Подсветка, которая следует за курсором: мягкое бирюзовое пятно на фоне
 * и подсвеченный край рамки. Только для устройств с мышью.
 */
(function () {
  'use strict';

  const HOSTS = [
    '.btn', '.filter', '.tab', '.icon-btn', '.social', '.datepicker__trigger',
    '.adv-card', '.contact-item', '.fact', '.review', '.stat',
    '.booking__card', '.cta-banner', '.catalog__cta', '.rating-summary', '.booking__call'
  ].join(',');

  AQ.components.glow = {
    init() {
      if (!AQ.env.hover || AQ.env.lite) return;
      const attach = (el) => {
        if (el.querySelector(':scope > .glow')) return;
        el.setAttribute('data-glow-host', '');
        el.insertAdjacentHTML('afterbegin', '<span class="glow" aria-hidden="true"></span>');
      };
      document.querySelectorAll(HOSTS).forEach(attach);
      AQ.glowAttach = (scope) => scope.querySelectorAll(HOSTS).forEach(attach);

      let raf = 0, last = null;
      document.addEventListener('pointermove', (e) => {
        last = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const host = last.target.closest && last.target.closest('[data-glow-host]');
          if (!host) return;
          const r = host.getBoundingClientRect();
          host.style.setProperty('--gx', `${last.clientX - r.left}px`);
          host.style.setProperty('--gy', `${last.clientY - r.top}px`);
        });
      }, { passive: true });
    }
  };
})();
