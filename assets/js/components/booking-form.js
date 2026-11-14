/** Форма записи: маска телефона, валидация, отправка, состояние успеха. */
(function () {
  'use strict';
  const { qs, qsa, escape, toISODate, formatDateRu, scrollToEl } = AQ.utils;

  const NAME_RE = /^[A-Za-zА-Яа-яЁё\s'-]{2,50}$/;

  /** Маска +7 (XXX) XXX-XX-XX */
  function formatPhone(value) {
    let d = value.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  }

  AQ.components.bookingForm = {
    init() {
      const form = qs('[data-booking-form]');
      // «Записаться» из каталога: на странице записи — предзаполняем, на других — переходим на неё
      AQ.on('book', ({ serviceId } = {}) => {
        if (form) this.prefill(serviceId);
        else AQ.navigate('booking.html' + (serviceId ? '?service=' + encodeURIComponent(serviceId) : ''));
      });
      if (!form) return;
      this.form = form;
      const success = qs('[data-booking-success]');
      const submitBtn = qs('[data-submit]', form);
      const status = qs('[data-form-status]', form);
      const serviceSel = qs('[data-service-select]', form);
      const timeSel = qs('[data-time-select]', form);
      const dateInput = form.elements.date;
      const phoneInput = form.elements.phone;
      const comment = form.elements.comment;
      const counter = qs('[data-comment-counter]', form);
      const cfg = AQ.config;

      // ---------- Наполнение полей ----------
      serviceSel.insertAdjacentHTML('beforeend',
        AQ.services.map((s) => `<option value="${s.id}">${escape(s.title)} — ${AQ.utils.formatPrice(s.price)}</option>`).join('') +
        '<option value="consult">Нужна консультация — подберите комплекс</option>');

      const today = new Date();
      const maxDate = new Date(); maxDate.setDate(today.getDate() + cfg.bookingDaysAhead);
      dateInput.min = toISODate(today);
      dateInput.max = toISODate(maxDate);

      const slots = [];
      for (let h = cfg.timeSlots.from; h <= cfg.timeSlots.to; h += cfg.timeSlots.stepMinutes / 60) slots.push(h);
      timeSel.insertAdjacentHTML('beforeend', slots.map((h) => `<option value="${String(h).padStart(2, '0')}:00">${String(h).padStart(2, '0')}:00</option>`).join(''));

      // На сегодня недоступны уже прошедшие слоты (+1 час на дорогу)
      const updateSlots = () => {
        const isToday = dateInput.value === toISODate(new Date());
        const minHour = new Date().getHours() + 1;
        qsa('option[value]', timeSel).forEach((o) => {
          if (!o.value) return;
          o.disabled = isToday && parseInt(o.value, 10) <= minHour;
        });
        if (timeSel.selectedOptions[0]?.disabled) timeSel.value = '';
      };
      dateInput.addEventListener('change', updateSlots);

      // ---------- Маска телефона ----------
      phoneInput.addEventListener('input', () => {
        const pos = phoneInput.selectionStart;
        const before = phoneInput.value.length;
        phoneInput.value = formatPhone(phoneInput.value);
        if (pos < before) {
          const diff = phoneInput.value.length - before;
          phoneInput.setSelectionRange(pos + diff, pos + diff);
        }
      });
      phoneInput.addEventListener('focus', () => { if (!phoneInput.value) phoneInput.value = '+7 ('; });
      phoneInput.addEventListener('blur', () => { if (phoneInput.value.replace(/\D/g, '').length <= 1) phoneInput.value = ''; });

      comment.addEventListener('input', () => { counter.textContent = `${comment.value.length} / 500`; });

      // ---------- Валидация ----------
      const rules = {
        name: (v) => (!v.trim() ? 'Укажите, как к вам обращаться' : !NAME_RE.test(v.trim()) ? 'Имя может содержать только буквы, минимум 2 символа' : ''),
        phone: (v) => {
          const d = v.replace(/\D/g, '');
          if (d.length <= 1) return 'Укажите номер телефона для связи';
          return d.length !== 11 ? 'Номер неполный: формат +7 (XXX) XXX-XX-XX' : '';
        },
        service: (v) => (!v ? 'Выберите услугу или «Нужна консультация»' : ''),
        date: (v) => {
          if (!v) return 'Выберите желаемую дату';
          if (v < dateInput.min) return 'Дата не может быть в прошлом';
          if (v > dateInput.max) return `Запись открыта на ${cfg.bookingDaysAhead} дней вперёд`;
          return '';
        },
        time: () => '',
        comment: (v) => (v.length > 500 ? 'Не более 500 символов' : ''),
        consent: (_, el) => (!el.checked ? 'Необходимо согласие на обработку данных' : '')
      };

      const validateField = (name, silent = false) => {
        const el = form.elements[name];
        const field = qs(`[data-field="${name}"]`, form);
        const msg = rules[name](el.value || '', el);
        if (!silent) {
          field.classList.toggle('is-invalid', !!msg);
          field.classList.toggle('is-valid', !msg && name !== 'consent' && !!el.value);
          el.setAttribute('aria-invalid', String(!!msg));
          qs('.field__error', field).textContent = msg;
        }
        return !msg;
      };

      Object.keys(rules).forEach((name) => {
        const el = form.elements[name];
        el.addEventListener('blur', () => { if (el.value || name === 'consent') validateField(name); });
        el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'hidden' ? 'change' : 'input', () => {
          if (qs(`[data-field="${name}"]`, form).classList.contains('is-invalid')) validateField(name);
        });
      });

      // ---------- Отправка ----------
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.textContent = '';
        const names = Object.keys(rules);
        const results = names.map((n) => validateField(n));
        if (results.includes(false)) {
          const first = names[results.indexOf(false)];
          const target = form.elements[first];
          (target.type === 'hidden' ? qs(`[data-field="${first}"] button, [data-field="${first}"] input`, form) : target).focus();
          const count = results.filter((r) => !r).length;
          status.textContent = `Проверьте ${count === 1 ? 'выделенное поле' : 'выделенные поля'}`;
          return;
        }

        const data = Object.fromEntries(new FormData(form));
        const service = AQ.services.find((s) => s.id === data.service);
        const payload = {
          name: data.name.trim(),
          phone: '+' + data.phone.replace(/\D/g, ''),
          service: data.service,
          serviceTitle: service ? service.title : 'Консультация',
          date: data.date,
          time: data.time || null,
          comment: (data.comment || '').trim(),
          source: location.href,
          createdAt: new Date().toISOString(),
          consent: true,
          consentAt: new Date().toISOString(),
          policyVersion: AQ.config.policyVersion
        };

        // Без сервера — сразу открываем чат с менеджером в Telegram (в рамках клика, чтобы не сработал блокировщик окон)
        if (!cfg.booking.endpoint) {
          if (!data.company) window.open(AQ.api.telegramLink(payload), '_blank', 'noopener');
          this.showSuccess(payload, success, 'redirect');
          return;
        }

        submitBtn.classList.add('is-loading');
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.disabled = true;
        qs('[data-form-fallback]', form)?.remove();

        try {
          // Honeypot: боты получают «успех» без отправки
          if (data.company) await new Promise((r) => setTimeout(r, 800));
          else await AQ.api.submitBooking({ ...payload, company: data.company || '' });
          this.showSuccess(payload, success, 'bot');
        } catch (err) {
          // Демо-режим админки (хостинг без PHP): сохраняем заявку в браузере, чтобы увидеть её в админке
          if (this.saveDemoBooking(payload)) {
            this.showSuccess(payload, success, 'bot');
            return;
          }
          console.error('[AQUACAR] Заявка не доставлена', err);
          // Переадресация: клиент отправляет готовую заявку менеджеру сам, одним нажатием
          const box = document.createElement('div');
          box.className = 'form-fallback';
          box.setAttribute('data-form-fallback', '');
          box.innerHTML = `<p>Не удалось отправить заявку автоматически. Отправьте её менеджеру в Telegram — текст уже готов.</p>
            <a class="btn btn--tg btn--block" href="${AQ.api.telegramLink(payload)}" target="_blank" rel="noopener">${AQ.utils.icon('i-telegram')}Отправить заявку в Telegram</a>`;
          submitBtn.insertAdjacentElement('afterend', box);
          box.querySelector('a').addEventListener('click', () => setTimeout(() => this.showSuccess(payload, success, 'redirect'), 400));
          status.textContent = '';
        } finally {
          submitBtn.classList.remove('is-loading');
          submitBtn.removeAttribute('aria-busy');
          submitBtn.disabled = false;
        }
      });

      qs('[data-booking-reset]', success)?.addEventListener('click', () => {
        form.reset();
        qsa('.field', form).forEach((f) => f.classList.remove('is-invalid', 'is-valid'));
        qsa('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
        counter.textContent = '0 / 500';
        success.hidden = true;
        form.hidden = false;
        form.elements.name.focus();
      });

      // ---------- Предзаполнение услуги из ссылки ?service=… ----------
      const fromUrl = new URLSearchParams(location.search).get('service');
      if (fromUrl && (fromUrl === 'consult' || AQ.services.some((x) => x.id === fromUrl))) this.prefill(fromUrl, false);
    },

    saveDemoBooking(p) {
      try {
        if (localStorage.getItem('aq-demo') !== '1') return false;
        const list = JSON.parse(localStorage.getItem('aq-demo-bookings') || '[]');
        list.unshift({
          id: Date.now().toString(36), status: 'new', created_at: new Date().toISOString(),
          name: p.name, phone: p.phone, service: p.serviceTitle, date: p.date, time: p.time || '', comment: p.comment
        });
        localStorage.setItem('aq-demo-bookings', JSON.stringify(list.slice(0, 200)));
        return true;
      } catch (_) {
        return false;
      }
    },

    prefill(serviceId, scroll = true) {
      const form = this.form;
      if (!form) return;
      const section = document.getElementById('booking');
      const success = qs('[data-booking-success]');
      if (success && !success.hidden) qs('[data-booking-reset]', success).click();
      if (serviceId) {
        const sel = form.elements.service;
        sel.value = serviceId;
        sel.dispatchEvent(new Event('change'));
        const field = qs('[data-field="service"]', form);
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        qs('.field__error', field).textContent = '';
      }
      if (!scroll) return;
      scrollToEl(section);
      setTimeout(() => form.elements.name.focus({ preventScroll: true }), AQ.env.reducedMotion ? 0 : 700);
    },

    showSuccess(p, success, mode = 'bot') {
      const rows = [
        ['Имя', p.name],
        ['Телефон', (p.phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4'))],
        ['Услуга', p.serviceTitle],
        ['Дата', formatDateRu(p.date) + (p.time ? `, ${p.time}` : '')]
      ];
      qs('[data-success-summary]', success).innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escape(v)}</dd>`).join('');
      const first = p.name.split(' ')[0];
      qs('[data-success-text]', success).textContent = mode === 'redirect'
        ? `${first}, мы открыли чат с менеджером в Telegram с готовой заявкой — нажмите «Отправить», и он подтвердит запись.`
        : `${first}, спасибо! Заявка принята — менеджер свяжется с вами в течение 10 минут, чтобы подтвердить время.`;
      const tg = qs('[data-success-tg]', success);
      if (tg) {
        tg.href = AQ.api.telegramLink(p);
        tg.lastChild.textContent = mode === 'redirect' ? 'Открыть Telegram ещё раз' : 'Написать менеджеру в Telegram';
      }
      this.form.hidden = true;
      success.hidden = false;
      success.focus();
      AQ.toast(mode === 'redirect' ? 'Заявка подготовлена в Telegram' : 'Заявка отправлена — скоро свяжемся!');
    }
  };
})();
