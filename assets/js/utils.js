/**
 * Общие утилиты и определение возможностей устройства.
 */
(function () {
  'use strict';

  const AQ = (window.AQ = window.AQ || {});
  AQ.components = AQ.components || {};

  const mq = (q) => window.matchMedia(q);
  const reducedMotion = mq('(prefers-reduced-motion: reduce)').matches;
  const conn = navigator.connection || {};
  const weakDevice =
    conn.saveData === true ||
    /(^|-)2g$/.test(conn.effectiveType || '') ||
    (navigator.hardwareConcurrency || 8) <= 2 ||
    (navigator.deviceMemory || 8) <= 2;

  AQ.env = {
    reducedMotion,
    lite: reducedMotion || weakDevice,
    coarse: mq('(pointer: coarse)').matches,
    hover: mq('(hover: hover)').matches
  };

  const root = document.documentElement;
  if (reducedMotion) root.classList.add('motion-off');
  if (AQ.env.lite) root.classList.add('lite');

  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

  AQ.utils = {
    qs: (sel, ctx = document) => ctx.querySelector(sel),
    qsa: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),
    clamp,
    /** Нормализует v из диапазона [a, b] в [0, 1]. */
    range: (v, a, b) => clamp((v - a) / (b - a)),
    lerp: (a, b, t) => a + (b - a) * t,
    ease: {
      inCubic: (t) => t * t * t,
      inQuad: (t) => t * t,
      outCubic: (t) => 1 - Math.pow(1 - t, 3),
      outQuart: (t) => 1 - Math.pow(1 - t, 4),
      inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2
    },

    formatPrice(price, from = true) {
      if (price == null) return 'Цена по запросу';
      return (from ? 'от ' : '') + price.toLocaleString('ru-RU') + ' ₽';
    },

    escape(str) {
      return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    debounce(fn, ms = 150) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    },

    scrollToEl(el) {
      if (!el) return;
      el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    },

    /** Склонение: plural(5, ['услуга', 'услуги', 'услуг']) */
    plural(n, forms) {
      const a = Math.abs(n) % 100;
      const b = a % 10;
      if (a > 10 && a < 20) return forms[2];
      if (b > 1 && b < 5) return forms[1];
      if (b === 1) return forms[0];
      return forms[2];
    },

    toISODate(d) {
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },

    formatDateRu(iso) {
      if (!iso) return '';
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    },

    icon(id, cls = 'icon') {
      return `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
    }
  };

  /** Простой toast-уведомитель. */
  AQ.toast = function (message, type = 'success', timeout = 5000) {
    const box = document.querySelector('[data-toasts]');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `${AQ.utils.icon(type === 'error' ? 'i-close' : 'i-check')}<span>${AQ.utils.escape(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 600);
    }, timeout);
  };

  /** Шина событий между компонентами. */
  const bus = new EventTarget();
  AQ.on = (name, fn) => bus.addEventListener(name, (e) => fn(e.detail));
  AQ.emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
})();
