/**
 * Контент сайта из data/content.json (его редактирует админ-панель).
 * Если файл недоступен (например, сайт открыт с диска), остаются
 * значения по умолчанию из data/services.js и data/reviews.js.
 *
 * Разметка:
 *   data-c="phone|email|address|addressHint|hours|rating|ratingCount|heroSubtitle" — текст
 *   data-c="heroTitle" — заголовок с акцентным словом
 *   data-c="heroMeta"  — строка с короткими фактами
 *   data-c-href="tel|mail|telegram|whatsapp|vk|route|map|manager" — ссылка
 */
(function () {
  'use strict';

  const digits = (s) => String(s || '').replace(/\D/g, '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  AQ.loadContent = async function () {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch('data/content.json', { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let c = await res.json();
      // Демо-режим админки (хостинг без PHP): правки хранятся в этом браузере
      try {
        if (localStorage.getItem('aq-demo') === '1') {
          const demo = JSON.parse(localStorage.getItem('aq-demo-content') || 'null');
          if (demo && Array.isArray(demo.services)) c = demo;
        }
      } catch (_) { /* хранилище недоступно */ }
      AQ.content = c;
      if (Array.isArray(c.services) && c.services.length) AQ.services = c.services.filter((s) => !s.hidden);
      if (Array.isArray(c.reviews)) AQ.reviews = c.reviews.filter((r) => !r.hidden);
      if (c.categories) AQ.categories = c.categories;
      if (c.contacts) {
        AQ.config.phone = c.contacts.phone || AQ.config.phone;
        AQ.config.email = c.contacts.email || AQ.config.email;
        if (c.contacts.openHour != null) AQ.config.hours = { open: +c.contacts.openHour, close: +c.contacts.closeHour };
      }
      if (c.booking) {
        if (c.booking.telegramManager) AQ.config.booking.telegramManager = c.booking.telegramManager.replace(/^@/, '');
        if (c.booking.daysAhead) AQ.config.bookingDaysAhead = +c.booking.daysAhead;
        if (c.booking.slotFrom != null) AQ.config.timeSlots = { ...AQ.config.timeSlots, from: +c.booking.slotFrom, to: +c.booking.slotTo };
      }
      AQ.applyContent(c);
    } catch (err) {
      AQ.content = null; // работаем на значениях по умолчанию
    }
  };

  AQ.applyContent = function (c, root = document) {
    const ct = c.contacts || {};
    const text = {
      phone: ct.phone, email: ct.email, address: ct.address, addressHint: ct.addressHint, hours: ct.hours,
      rating: c.rating && c.rating.value, ratingCount: c.rating && c.rating.count,
      heroSubtitle: c.hero && c.hero.subtitle
    };
    root.querySelectorAll('[data-c]').forEach((el) => {
      const key = el.dataset.c;
      if (key === 'heroTitle' && c.hero) {
        el.innerHTML = `${esc(c.hero.title)} <span class="text-accent">${esc(c.hero.accent)}</span>`;
      } else if (key === 'heroMeta' && c.hero && Array.isArray(c.hero.meta)) {
        el.innerHTML = c.hero.meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join('');
      } else if (text[key]) {
        el.textContent = text[key];
      }
    });
    const href = {
      tel: ct.phone && 'tel:+' + digits(ct.phone).replace(/^8/, '7'),
      mail: ct.email && 'mailto:' + ct.email,
      telegram: ct.telegram, whatsapp: ct.whatsapp, vk: ct.vk, route: ct.route, map: ct.map,
      manager: c.booking && c.booking.telegramManager && 'https://t.me/' + c.booking.telegramManager.replace(/^@/, '')
    };
    root.querySelectorAll('[data-c-href]').forEach((el) => {
      const v = href[el.dataset.cHref];
      if (v) el.href = v;
    });
  };
})();
