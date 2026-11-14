/** Каталог услуг: рендер карточек, фильтрация, hover-подсветка. */
(function () {
  'use strict';
  const { qs, qsa, escape, formatPrice, icon, plural } = AQ.utils;

  const cardTemplate = (s, i) => {
    const cats = s.categories.map((c) => AQ.categories[c]);
    const priceHtml = s.price == null
      ? `<div class="service-card__price service-card__price--request">Цена по запросу</div>`
      : `<div class="service-card__price"><small>от</small>${s.price.toLocaleString('ru-RU')}&nbsp;₽</div>`;
    return `
      <article class="service-card" data-id="${s.id}" data-cats="${s.categories.join(' ')}" aria-labelledby="svc-${s.id}">
        <div class="service-card__media">
          <img class="service-card__photo" src="${s.photo || `assets/img/photos/svc-${s.id}.jpg`}" alt="${escape(s.photoAlt || s.title)}" loading="lazy" decoding="async" width="900" height="600">
          ${s.badge ? `<span class="service-card__badge">${escape(s.badge)}</span>` : ''}
          <span class="service-card__chipicon" aria-hidden="true">${icon(s.icon, '')}</span>
        </div>
        <div class="service-card__body">
          <div class="service-card__meta">
            <span class="chip">${escape(cats[0])}</span>
            <span class="service-card__time">${icon('i-clock')}<span class="visually-hidden">Длительность: </span>${escape(s.duration)}</span>
          </div>
          <h3 class="service-card__title" id="svc-${s.id}">${escape(s.title)}</h3>
          <p class="service-card__text">${escape(s.short)}</p>
          <div class="service-card__footer">
            ${priceHtml}
            <div class="service-card__actions">
              <button class="btn btn--ghost btn--sm" type="button" data-action="details" aria-label="Подробнее: ${escape(s.title)}">Подробнее</button>
              <button class="btn btn--primary btn--sm" type="button" data-action="book" aria-label="Записаться: ${escape(s.title)}">Записаться</button>
            </div>
          </div>
        </div>
      </article>`;
  };

  AQ.components.catalog = {
    init() {
      const popular = qs('[data-popular]');
      if (popular) this.renderPopular(popular);

      const grid = qs('[data-catalog-grid]');
      if (!grid) return;

      grid.innerHTML = AQ.services.map(cardTemplate).join('');
      const cards = qsa('.service-card', grid);

      // Появление карточек «волной» слева направо — по направлению движения автомобиля
      cards.forEach((card, i) => {
        card.setAttribute('data-reveal', 'left');
        card.style.setProperty('--d', `${(i % 4) * 90}ms`);
        AQ.reveal.observe(card);
      });

      // Счётчики в фильтрах
      const counts = { all: AQ.services.length };
      AQ.services.forEach((s) => s.categories.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
      qsa('[data-count]').forEach((el) => (el.textContent = counts[el.dataset.count] || 0));

      // Фильтрация
      const filters = qsa('[data-filter]');
      const status = qs('[data-filter-status]');
      const apply = (cat) => {
        const run = () => {
          let n = 0;
          cards.forEach((card) => {
            const show = cat === 'all' || card.dataset.cats.split(' ').includes(cat);
            card.hidden = !show;
            card.classList.remove('is-entering');
            if (show) {
              card.classList.add('is-visible');
              card.style.setProperty('--i-delay', `${n * 45}ms`);
              void card.offsetWidth;
              card.classList.add('is-entering');
              n++;
            }
          });
          if (status) status.textContent = `Показано ${n} ${plural(n, ['услуга', 'услуги', 'услуг'])}`;
        };
        run();
      };

      filters.forEach((btn) =>
        btn.addEventListener('click', () => {
          if (btn.classList.contains('is-active')) return;
          filters.forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
          apply(btn.dataset.filter);
        })
      );

      this.bindCards(grid);
    },

    renderPopular(box) {
      const ids = box.dataset.popular.split(',');
      const list = ids.map((id) => AQ.services.find((s) => s.id === id)).filter(Boolean);
      box.innerHTML = list.map((s) => cardTemplate(s, AQ.services.indexOf(s))).join('');
      AQ.utils.qsa('.service-card', box).forEach((card, i) => {
        card.setAttribute('data-reveal', 'left');
        card.style.setProperty('--d', `${i * 90}ms`);
        AQ.reveal.observe(card);
      });
      this.bindCards(box);
    },

    bindCards(grid) {
      // Действия в карточках
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.closest('.service-card').dataset.id;
        if (btn.dataset.action === 'details') AQ.components.modal.openService(id, btn);
        else AQ.emit('book', { serviceId: id });
      });

      // Подсветка за курсором (только устройства с hover)
      if (AQ.env.hover && !AQ.env.lite) {
        grid.addEventListener('pointermove', (e) => {
          const card = e.target.closest('.service-card');
          if (!card) return;
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - r.left}px`);
          card.style.setProperty('--my', `${e.clientY - r.top}px`);
        }, { passive: true });
      }
    }
  };
})();
