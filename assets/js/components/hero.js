/**
 * Главный экран. По «Перейти в каталог»: камера чуть приближается,
 * машина трогается и уезжает вперёд, после чего открывается каталог.
 * Вся сцена длится около секунды.
 */
(function () {
  'use strict';
  const { qs } = AQ.utils;

  AQ.components.hero = {
    init() {
      const hero = qs('[data-hero]');
      if (!hero) return;
      const camera = qs('[data-hero-camera]', hero);
      const car = qs('[data-hero-car]', hero);
      const go = qs('[data-drive-go]', hero);

      requestAnimationFrame(() => document.documentElement.classList.add('is-loaded'));

      // Наведение на кнопку — фары ярче, машина «готова»
      const hint = (on) => hero.classList.toggle('is-hinting', on);
      go.addEventListener('pointerenter', () => hint(true));
      go.addEventListener('pointerleave', () => hint(false));
      go.addEventListener('focus', () => hint(true));
      go.addEventListener('blur', () => hint(false));

      let busy = false;
      go.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (busy) return;
        busy = true;
        const href = go.getAttribute('href');
        if (AQ.env.reducedMotion || typeof car.animate !== 'function') { location.href = href; return; }
        this.drive(hero, camera, car);
        setTimeout(() => AQ.navigate(href), 720);
      });

      // «Назад» из bfcache — возвращаем машину на место
      window.addEventListener('pageshow', (ev) => {
        if (!ev.persisted) return;
        busy = false;
        document.documentElement.classList.remove('is-driving');
        camera.getAnimations().forEach((a) => a.cancel());
        car.getAnimations().forEach((a) => a.cancel());
      });
    },

    drive(hero, camera, car) {
      document.documentElement.classList.add('is-driving');
      hero.classList.remove('is-hinting');

      const rect = car.getBoundingClientRect();
      const out = rect.bottom + 80; // путь до полного выезда за верхний край

      camera.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }],
        { duration: 900, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'forwards' }
      );
      car.animate(
        [
          { transform: 'translateY(0)', easing: 'ease-out' },
          { transform: 'translateY(5px)', offset: 0.14, easing: 'cubic-bezier(.55,0,.85,.3)' }, // присел перед стартом
          { transform: `translateY(${-out}px)` }
        ],
        { duration: 820, delay: 80, fill: 'forwards' }
      );
    }
  };
})();
