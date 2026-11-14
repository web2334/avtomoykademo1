/** Модальное окно с подробностями услуги (нативный <dialog>). */
(function () {
  'use strict';
  const { qs, escape, formatPrice, icon } = AQ.utils;

  AQ.components.modal = {
    init() {
      this.dialog = qs('[data-modal]');
      if (!this.dialog) return;
      this.content = qs('[data-modal-content]', this.dialog);

      qs('[data-modal-close]', this.dialog).addEventListener('click', () => this.close());
      this.dialog.addEventListener('click', (e) => { if (e.target === this.dialog) this.close(); });
      this.dialog.addEventListener('cancel', (e) => { e.preventDefault(); this.close(); });
      this.content.addEventListener('click', (e) => {
        const book = e.target.closest('[data-modal-book]');
        if (book) { this.close(); AQ.emit('book', { serviceId: book.dataset.modalBook }); }
        if (e.target.closest('[data-modal-dismiss]')) this.close();
      });
    },

    openService(id, trigger) {
      const s = AQ.services.find((x) => x.id === id);
      if (!s || !this.dialog) return;
      this.trigger = trigger;
      const chips = s.categories.map((c) => `<span class="chip">${escape(AQ.categories[c])}</span>`).join('');
      this.content.innerHTML = `
        <div class="modal__media" aria-hidden="true">${icon(s.icon, '')}</div>
        <div class="modal__body">
          <div class="modal__chips">${chips}</div>
          <h2 class="modal__title" id="modal-title">${escape(s.title)}</h2>
          <p class="modal__desc">${escape(s.description)}</p>
          <div class="modal__facts">
            <div class="modal__fact"><span>Стоимость</span><strong>${formatPrice(s.price)}</strong></div>
            <div class="modal__fact"><span>Длительность</span><strong>${escape(s.duration)}</strong></div>
          </div>
          <h3 class="modal__subtitle">Что входит</h3>
          <ul class="modal__list">${s.includes.map((x) => `<li>${icon('i-check')}<span>${escape(x)}</span></li>`).join('')}</ul>
          <div class="modal__actions">
            <button class="btn btn--primary" type="button" data-modal-book="${s.id}">${icon('i-calendar')}Записаться на услугу</button>
            <button class="btn btn--ghost" type="button" data-modal-dismiss>Вернуться к каталогу</button>
          </div>
        </div>`;
      this.dialog.classList.remove('is-closing');
      if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else this.dialog.setAttribute('open', '');
      document.documentElement.classList.add('modal-open');
      this.dialog.querySelector('.modal__inner').scrollTop = 0;
    },

    close() {
      const d = this.dialog;
      if (!d || !d.open) return;
      const finish = () => {
        d.classList.remove('is-closing');
        if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
        document.documentElement.classList.remove('modal-open');
        this.trigger?.focus?.({ preventScroll: true });
      };
      if (AQ.env.reducedMotion) return finish();
      d.classList.add('is-closing');
      setTimeout(finish, 260);
    }
  };
})();
