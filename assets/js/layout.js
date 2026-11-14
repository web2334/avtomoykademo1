/**
 * Общий layout всех страниц: SVG-иконки, шапка, футер, модальное окно,
 * уведомления и плавные переходы между страницами.
 * Подключается обычным (не defer) скриптом в конце <body>,
 * чтобы шапка появлялась сразу, без «мигания».
 */
(function () {
  'use strict';

  const AQ = (window.AQ = window.AQ || {});
  const page = document.body.dataset.page || '';

  const NAV = [
    { href: 'index.html', label: 'Главная', page: 'home' },
    { href: 'catalog.html', label: 'Услуги', page: 'catalog' },
    { href: 'reviews.html', label: 'Отзывы', page: 'reviews' },
    { href: 'contacts.html', label: 'Контакты', page: 'contacts' }
  ];

  const PHONE = '+7 (495) 120-45-67';
  const PHONE_HREF = 'tel:+74951204567';
  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;

  const SPRITE = `<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
    <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17.5h2"/></symbol>
    <symbol id="i-cal-check" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15.2l2 2 4-4"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.6 3.5h2.6l1.6 4.3-2.1 1.4a11.6 11.6 0 0 0 6.1 6.1l1.4-2.1 4.3 1.6v2.6a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1z"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></symbol>
    <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.8 7l8.2 6 8.2-6"/></symbol>
    <symbol id="i-route" viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18h6.3a3.3 3.3 0 0 0 0-6.6h-5a3.3 3.3 0 0 1 0-6.6h5.7"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></symbol>
    <symbol id="i-chev-left" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
    <symbol id="i-chev-right" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></symbol>
    <symbol id="i-telegram" viewBox="0 0 24 24"><path d="M21 4L3 11.2l6 2.2M21 4l-3.2 15.8-6.6-5.2M21 4L9 13.4m0 0V19l2.2-4.6"/></symbol>
    <symbol id="i-whatsapp" viewBox="0 0 24 24"><path d="M4 20l1.2-4.1A8.5 8.5 0 1 1 8.4 19z"/><path d="M9 8.6c0 3.6 2.9 6.5 6.5 6.5l1.2-1.6-2-1-1 .9a4.6 4.6 0 0 1-2.5-2.5l.9-1-1-2z"/></symbol>
    <symbol id="i-vk" viewBox="0 0 24 24"><path d="M3.5 7.5h3c.6 3.5 2.2 5.4 3.5 5.9V7.5h2.8v3.3c1.3-.2 2.7-1.7 3.2-3.3h2.8c-.4 2-2 3.8-3.2 4.6 1.2.6 3 2.2 3.6 4.4h-3.1c-.6-1.5-2-2.8-3.3-2.9v2.9h-.4C7.3 16.5 3.9 13 3.5 7.5z"/></symbol>
    <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></symbol>
    <symbol id="i-flask" viewBox="0 0 24 24"><path d="M9 3h6M10 3v5.5L4.8 17.6A2.3 2.3 0 0 0 6.8 21h10.4a2.3 2.3 0 0 0 2-3.4L14 8.5V3"/><path d="M7.3 14h9.4"/></symbol>
    <symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/></symbol>
    <symbol id="i-master" viewBox="0 0 24 24"><circle cx="10" cy="8" r="3.8"/><path d="M3.5 20c.6-3.6 3.2-5.8 6.5-5.8 1.3 0 2.5.3 3.5 1"/><path d="M18 13.5l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z"/></symbol>
    <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.8v2.7M12 18.5v2.7M21.2 12h-2.7M5.5 12H2.8M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9M18.5 18.5l-1.9-1.9M7.4 7.4L5.5 5.5"/></symbol>
    <symbol id="i-award" viewBox="0 0 24 24"><circle cx="12" cy="9" r="5.5"/><path d="M9 13.8L7.5 21l4.5-2.4 4.5 2.4-1.5-7.2"/><path d="M10 9l1.4 1.4L14 7.8"/></symbol>
    <symbol id="i-car" viewBox="0 0 24 24"><path d="M3 16.5v-3.2c0-.8.5-1.5 1.3-1.8l1.7-.6 2.2-3.2c.5-.7 1.3-1.2 2.2-1.2h4.2c.8 0 1.6.4 2.1 1l2.6 3.3 1.5.5c.7.3 1.2 1 1.2 1.8v3.4"/><circle cx="7.5" cy="16.8" r="1.9"/><circle cx="16.5" cy="16.8" r="1.9"/><path d="M9.4 16.8h5.2M3 16.8h2.6M18.4 16.8H21"/></symbol>
    <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 5.5h16v11H9.5L5 20v-3.5H4z"/><path d="M8 10h8M8 13h5"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></symbol>

    <symbol id="s-wash" viewBox="0 0 48 48"><path d="M5 36v-5.6c0-1.6 1-2.9 2.5-3.3l3.6-1 4.5-5.7c.8-1 2-1.6 3.3-1.6h10.6c1.2 0 2.4.5 3.2 1.4l5.1 5.8 3.5.9c1.6.4 2.7 1.8 2.7 3.4V36"/><circle cx="14" cy="36" r="3.8"/><circle cx="34" cy="36" r="3.8"/><path d="M17.8 36h12.4M5 36h5.2M37.8 36H43M11 27h26"/><path d="M15 5.5c-1.6 2.2-2.4 3.6-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.2-.8-2.6-2.4-4.8zM24 3c-1.6 2.2-2.4 3.6-2.4 4.8a2.4 2.4 0 0 0 4.8 0C26.4 6.6 25.6 5.2 24 3zM33 5.5c-1.6 2.2-2.4 3.6-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.2-.8-2.6-2.4-4.8z"/></symbol>
    <symbol id="s-complex" viewBox="0 0 48 48"><path d="M5 38v-5.6c0-1.6 1-2.9 2.5-3.3l3.6-1 4.5-5.7c.8-1 2-1.6 3.3-1.6h10.6c1.2 0 2.4.5 3.2 1.4l5.1 5.8 3.5.9c1.6.4 2.7 1.8 2.7 3.4V38"/><circle cx="14" cy="38" r="3.8"/><circle cx="34" cy="38" r="3.8"/><path d="M17.8 38h12.4M5 38h5.2M37.8 38H43"/><path d="M36 3.5l1.3 3.4 3.4 1.3-3.4 1.3L36 12.9l-1.3-3.4-3.4-1.3 3.4-1.3zM12 6.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM24 7v5M21.5 9.5h5"/></symbol>
    <symbol id="s-interior" viewBox="0 0 48 48"><path d="M17.5 5h8.2a3 3 0 0 1 3 3.3L27.4 26H16.3L14.5 8.4A3 3 0 0 1 17.5 5z"/><path d="M12.5 26h20a3 3 0 0 1 3 3v4.5H12.5a3 3 0 0 1-3-3V29a3 3 0 0 1 3-3z"/><path d="M15 33.5V43M31 33.5V43M12 43h22"/><circle cx="39" cy="10" r="3"/><circle cx="41.5" cy="18" r="1.8"/><circle cx="36" cy="17" r="1.2"/></symbol>
    <symbol id="s-blacken" viewBox="0 0 48 48"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="9.5"/><circle cx="24" cy="24" r="3"/><path d="M24 7v3M24 38v3M7 24h3M38 24h3M12 12l2.1 2.1M33.9 33.9L36 36M36 12l-2.1 2.1M14.1 33.9L12 36"/><path d="M15.5 17.5a10 10 0 0 1 5-4.5"/></symbol>
    <symbol id="s-wax" viewBox="0 0 48 48"><path d="M24 4.5c-6.5 8.5-11.5 14.6-11.5 21a11.5 11.5 0 0 0 23 0c0-6.4-5-12.5-11.5-21z"/><path d="M18.5 27a6 6 0 0 0 5.5 5.5"/><path d="M39 7l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z"/><path d="M6 43c4 1.6 8 1.6 12 0s8-1.6 12 0 8 1.6 12 0"/></symbol>
    <symbol id="s-polish" viewBox="0 0 48 48"><ellipse cx="22" cy="35" rx="14" ry="4.5"/><path d="M8 35v2.5c0 2.5 6.3 4.5 14 4.5s14-2 14-4.5V35"/><path d="M16 31v-7a6 6 0 0 1 12 0v7"/><path d="M28 21h10a3 3 0 0 1 0 6h-4"/><path d="M41 34a18 18 0 0 0 2-6M4 28a18 18 0 0 1 3-6M20 11l1-3.5M24 10V5.5M28 11l-1-3.5"/></symbol>
    <symbol id="s-rim" viewBox="0 0 48 48"><circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="14.5"/><circle cx="24" cy="24" r="4"/><path d="M24 20V9.5M27.8 22.8l10-3.3M26.4 27.2l6.1 8.5M21.6 27.2l-6.1 8.5M20.2 22.8l-10-3.3"/></symbol>
    <symbol id="s-tire" viewBox="0 0 48 48"><circle cx="20" cy="27" r="15"/><circle cx="20" cy="27" r="8"/><path d="M20 12v3M20 39v3M5 27h3M32 27h3M9.4 16.4l2.1 2.1M28.5 35.5l2.1 2.1M30.6 16.4l-2.1 2.1M11.5 35.5l-2.1 2.1"/><circle cx="39" cy="9" r="3.5"/><circle cx="43.5" cy="17" r="2"/><circle cx="36" cy="16.5" r="1.4"/></symbol>
    <symbol id="s-bug" viewBox="0 0 48 48"><ellipse cx="24" cy="28" rx="7.5" ry="10"/><circle cx="24" cy="14.5" r="3.6"/><path d="M24 18.5v19.5M16.8 24l-6-3M16.5 30h-7M17.5 35l-5.5 4M31.2 24l6-3M31.5 30h7M30.5 35l5.5 4M22 11.5l-3-5M26 11.5l3-5"/></symbol>
    <symbol id="s-diamond" viewBox="0 0 48 48"><path d="M14 8h20l9 11-19 22L5 19z"/><path d="M5 19h38M19 8l-5 11 10 22 10-22-5-11"/></symbol>
    <symbol id="s-shield" viewBox="0 0 48 48"><path d="M24 4.5l16 6v12c0 9.8-6.8 17.6-16 21-9.2-3.4-16-11.2-16-21v-12z"/><path d="M17 24l5 5 9.5-10"/></symbol>
    <symbol id="s-ozone" viewBox="0 0 48 48"><circle cx="24" cy="13" r="6"/><circle cx="12.5" cy="32" r="6"/><circle cx="35.5" cy="32" r="6"/><path d="M21 18.2l-5.5 8.6M27 18.2l5.5 8.6M18.5 32h11M6 43c3 1.4 6 1.4 9 0M33 43c3 1.4 6 1.4 9 0"/></symbol>

    <symbol id="logo-mark" viewBox="0 0 56 28"><path d="M2 21c4-.6 7-6.6 13-8.8 5-1.8 13-2.2 18-.4 4 1.5 7 4 11 6.4 4 .6 7.2 1.4 10 2.8"/><path d="M14 23.5a4 4 0 0 1 8 0M36 23.5a4 4 0 0 1 8 0M24 13.4l3 5.6h13"/></symbol>
</svg>`;

  const navLinks = NAV.map((n) => {
    const active = n.page === page;
    return `<li><a class="nav__link${active ? ' is-active' : ''}" href="${n.href}"${active ? ' aria-current="page"' : ''}>${n.label}</a></li>`;
  }).join('');

  const logo = `
    <a class="logo" href="index.html" aria-label="AQUACAR — на главную">
      <svg class="logo__mark" aria-hidden="true"><use href="#logo-mark"/></svg>
      <span class="logo__text">AQUACAR<small>детейлинг-студия</small></span>
    </a>`;

  const HEADER = `
  <header class="header" data-header>
    <div class="container header__inner">
      ${logo}
      <nav class="nav" id="site-nav" aria-label="Основная навигация" data-nav>
        <ul class="nav__list">${navLinks}</ul>
        <div class="nav__mobile-extra">
          <a class="btn btn--primary btn--block" href="booking.html">${icon('i-calendar')}Записаться на мойку</a>
          <a class="nav__phone" href="${PHONE_HREF}" data-c-href="tel" data-c="phone">${PHONE}</a>
          <p class="nav__hours" data-c="hours">Ежедневно 08:00–22:00</p>
        </div>
      </nav>
      <div class="header__actions">
        <a class="header__phone" href="${PHONE_HREF}" data-c-href="tel">${icon('i-phone')}<span data-c="phone">${PHONE}</span></a>
        <a class="btn btn--outline btn--sm header__cta${page === 'booking' ? ' is-current' : ''}" href="booking.html">${icon('i-calendar')}Записаться</a>
        <button class="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="site-nav" data-burger>
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>`;

  const FOOTER = `
  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div class="footer__brand">
          ${logo}
          <p>Детейлинг-студия и автомойка в Москве. Бережный уход за автомобилями любого класса с 2014 года.</p>
          <div class="footer__socials">
            <a class="icon-btn" href="https://t.me/aquacar_moscow" target="_blank" rel="noopener" aria-label="Telegram" data-c-href="telegram">${icon('i-telegram')}</a>
            <a class="icon-btn" href="https://wa.me/74951204567" target="_blank" rel="noopener" aria-label="WhatsApp" data-c-href="whatsapp">${icon('i-whatsapp')}</a>
            <a class="icon-btn" href="https://vk.com/aquacar_moscow" target="_blank" rel="noopener" aria-label="ВКонтакте" data-c-href="vk">${icon('i-vk')}</a>
          </div>
        </div>
        <nav class="footer__col" aria-label="Навигация в подвале">
          <h3>Навигация</h3>
          <ul>
            ${NAV.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join('')}
            <li><a href="booking.html">Онлайн-запись</a></li>
          </ul>
        </nav>
        <div class="footer__col">
          <h3>Популярное</h3>
          <ul>
            <li><a href="booking.html?service=body-wash">Мойка кузова</a></li>
            <li><a href="booking.html?service=interior-clean">Химчистка салона</a></li>
            <li><a href="booking.html?service=polish">Полировка кузова</a></li>
            <li><a href="booking.html?service=coating">Защитное покрытие</a></li>
            <li><a href="booking.html?service=detailing">Детейлинг</a></li>
          </ul>
        </div>
        <div class="footer__col">
          <h3>Контакты</h3>
          <ul class="footer__contacts">
            <li><a href="${PHONE_HREF}" data-c-href="tel" data-c="phone">${PHONE}</a></li>
            <li><a href="mailto:hello@aquacar.ru" data-c-href="mail" data-c="email">hello@aquacar.ru</a></li>
            <li data-c="address">Москва, ул. Автозаводская, 23, стр. 4</li>
            <li data-c="hours">Ежедневно 08:00–22:00</li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <p>© ${new Date().getFullYear()} AQUACAR. Все права защищены.</p>
        <a href="privacy.html">Политика конфиденциальности</a>
        <a href="consent.html">Согласие на обработку данных</a>
        <a class="footer__credits" href="https://www.pexels.com" target="_blank" rel="noopener">Фото: Pexels</a>
      </div>
    </div>
  </footer>`;

  const MODAL = `
  <dialog class="modal" aria-labelledby="modal-title" data-modal>
    <div class="modal__inner">
      <button class="icon-btn modal__close" type="button" aria-label="Закрыть окно" data-modal-close>${icon('i-close')}</button>
      <div class="modal__content" data-modal-content></div>
    </div>
  </dialog>
  <div class="toasts" aria-live="polite" aria-atomic="true" data-toasts></div>
  <div class="page-curtain" aria-hidden="true"></div>`;

  // ---------- Вставка ----------
  document.body.insertAdjacentHTML('afterbegin', SPRITE + '<a class="skip-link" href="#main">Перейти к содержанию</a>' + HEADER);
  document.body.insertAdjacentHTML('beforeend', FOOTER + MODAL);

  // ---------- Переходы между страницами ----------
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Браузеры с cross-document View Transitions анимируют переход сами (см. base.css)
  const nativeVT = 'onpagereveal' in window;

  const isInternalPage = (a) => {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false; // якорь на этой же странице
    return /\.html$|\/$/.test(url.pathname);
  };

  AQ.navigate = function (href) {
    if (reduced || nativeVT) { location.href = href; return; }
    root.classList.add('is-leaving');
    setTimeout(() => { location.href = href; }, 380);
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!isInternalPage(a) || a.hasAttribute('data-no-transition')) return;
    if (reduced || nativeVT) return;
    e.preventDefault();
    AQ.navigate(a.href);
  });

  // Предзагрузка страниц при наведении — переход становится мгновенным
  const prefetched = new Set();
  document.addEventListener('pointerover', (e) => {
    const a = e.target.closest('a[href]');
    if (!isInternalPage(a)) return;
    const url = new URL(a.href, location.href);
    url.hash = '';
    if (prefetched.has(url.href)) return;
    prefetched.add(url.href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url.href;
    document.head.appendChild(link);
  }, { passive: true });

  // Нативный переход может прерваться, если пользователь быстро кликает дальше — это не ошибка
  window.addEventListener('pagereveal', (e) => {
    const vt = e.viewTransition;
    if (vt) [vt.ready, vt.finished, vt.updateCallbackDone].forEach((p) => p && p.catch(() => {}));
  });
  window.addEventListener('pageswap', (e) => {
    const vt = e.viewTransition;
    if (vt) [vt.ready, vt.finished, vt.updateCallbackDone].forEach((p) => p && p.catch(() => {}));
  });

  // Возврат кнопкой «Назад» из bfcache
  window.addEventListener('pageshow', () => root.classList.remove('is-leaving'));

  // Вход на страницу: шторка уходит
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));

})();
