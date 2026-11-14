/** Отзывы: карусель на главной (scroll-snap) и сетка на странице отзывов. */
(function () {
  'use strict';
  const { qs, escape, icon } = AQ.utils;

  const stars = (n) =>
    `<div class="stars" role="img" aria-label="Оценка ${n} из 5">${Array.from({ length: 5 }, (_, i) =>
      `<svg class="icon${i < n ? '' : ' is-empty'}" aria-hidden="true"><use href="#i-star"/></svg>`).join('')}</div>`;

  const initials = (name) => name.split(' ').map((p) => p[0]).slice(0, 2).join('');

  const card = (r) => `
    <article class="review">
      <div class="review__head">${stars(r.rating)}<span class="review__date">${escape(r.date)}</span></div>
      <p class="review__text">${escape(r.text)}</p>
      <div class="review__author">
        <span class="review__avatar" aria-hidden="true">${escape(initials(r.name))}</span>
        <div><span class="review__name">${escape(r.name)}</span><span class="review__car">${escape(r.car)}</span></div>
        <span class="chip review__service">${escape(r.service)}</span>
      </div>
    </article>`;

  AQ.components.reviews = {
    init() {
      const grid = qs('[data-reviews-grid]');
      if (grid) {
        grid.innerHTML = AQ.reviews.map(card).join('');
        AQ.utils.qsa('.review', grid).forEach((el, i) => {
          el.setAttribute('data-reveal', '');
          el.style.setProperty('--d', `${(i % 3) * 80}ms`);
          AQ.reveal.observe(el);
        });
      }
      const root = qs('[data-carousel]');
      if (!root) return;
      const track = qs('[data-carousel-track]', root);
      const prev = qs('[data-carousel-prev]', root);
      const next = qs('[data-carousel-next]', root);
      const bar = qs('[data-carousel-progress]', root);

      track.innerHTML = AQ.reviews.map(card).join('');

      const step = () => {
        const first = track.firstElementChild;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
        return first ? first.offsetWidth + gap : track.clientWidth;
      };
      const update = () => {
        const max = track.scrollWidth - track.clientWidth;
        const visible = track.clientWidth / track.scrollWidth;
        const p = max > 0 ? track.scrollLeft / max : 1;
        bar.style.transform = `translateX(${(p * (1 - visible) * 100).toFixed(2)}%) scaleX(${visible.toFixed(3)})`;
        bar.style.transformOrigin = '0 50%';
        prev.disabled = track.scrollLeft <= 4;
        next.disabled = track.scrollLeft >= max - 4;
      };
      prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: AQ.env.reducedMotion ? 'auto' : 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: AQ.env.reducedMotion ? 'auto' : 'smooth' }));
      track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
      track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { next.click(); e.preventDefault(); }
        if (e.key === 'ArrowLeft') { prev.click(); e.preventDefault(); }
      });
      window.addEventListener('resize', AQ.utils.debounce(update, 150));
      update();
    }
  };
})();
