/** Точка входа: инициализация компонентов. */
(function () {
  'use strict';

  const order = ['header', 'hero', 'catalog', 'modal', 'reviews', 'bookingForm', 'datepicker', 'counters', 'openStatus', 'footer', 'glow', 'cursor'];

  const start = async () => {
    if (AQ.loadContent) await AQ.loadContent();
    AQ.reveal.init();
    order.forEach((name) => {
      try {
        AQ.components[name]?.init();
      } catch (err) {
        console.error(`[AQUACAR] Ошибка инициализации компонента «${name}»`, err);
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
