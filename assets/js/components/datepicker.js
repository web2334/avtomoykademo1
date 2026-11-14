/**
 * Компактный календарь для поля «Желаемая дата».
 * Значение хранится в скрытом input (YYYY-MM-DD), границы — его атрибуты min/max
 * (их выставляет форма записи). Клавиатура: стрелки, PageUp/PageDown, Enter, Esc.
 */
(function () {
  'use strict';
  const { qs, toISODate } = AQ.utils;

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  AQ.components.datepicker = {
    init() {
      const root = qs('[data-datepicker]');
      if (!root) return;
      const trigger = qs('[data-date-trigger]', root);
      const label = qs('[data-date-label]', root);
      const input = qs('[data-date-value]', root);
      const pop = qs('[data-date-pop]', root);

      let view = new Date();      // показываемый месяц
      let focus = null;           // дата с фокусом клавиатуры

      const bounds = () => ({
        min: input.min ? parse(input.min) : null,
        max: input.max ? parse(input.max) : null
      });
      const allowed = (d) => {
        const { min, max } = bounds();
        return (!min || d >= min) && (!max || d <= max);
      };

      const render = () => {
        const y = view.getFullYear(), m = view.getMonth();
        const first = new Date(y, m, 1);
        const shift = (first.getDay() + 6) % 7;   // неделя с понедельника
        const days = new Date(y, m + 1, 0).getDate();
        const today = toISODate(new Date());
        const { min, max } = bounds();
        const canPrev = !min || new Date(y, m, 0) >= new Date(min.getFullYear(), min.getMonth(), 1);
        const canNext = !max || new Date(y, m + 1, 1) <= max;

        let cells = '';
        for (let i = 0; i < shift; i++) cells += '<span></span>';
        for (let d = 1; d <= days; d++) {
          const date = new Date(y, m, d);
          const iso = toISODate(date);
          const ok = allowed(date);
          const cls = ['datepicker__day', iso === today && 'is-today', iso === input.value && 'is-selected'].filter(Boolean).join(' ');
          const name = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
          cells += `<button type="button" class="${cls}" data-iso="${iso}" aria-label="${name}"${iso === input.value ? ' aria-pressed="true"' : ''}${ok ? '' : ' disabled'} tabindex="-1">${d}</button>`;
        }

        pop.innerHTML = `
          <div class="datepicker__head">
            <button type="button" class="datepicker__nav" data-nav="-1" aria-label="Предыдущий месяц"${canPrev ? '' : ' disabled'}><svg class="icon" aria-hidden="true"><use href="#i-chev-left"/></svg></button>
            <strong class="datepicker__title" aria-live="polite">${MONTHS[m]} ${y}</strong>
            <button type="button" class="datepicker__nav" data-nav="1" aria-label="Следующий месяц"${canNext ? '' : ' disabled'}><svg class="icon" aria-hidden="true"><use href="#i-chev-right"/></svg></button>
          </div>
          <div class="datepicker__week" aria-hidden="true">${WEEK.map((w) => `<span>${w}</span>`).join('')}</div>
          <div class="datepicker__grid">${cells}</div>
          <div class="datepicker__foot">
            <button type="button" class="datepicker__quick" data-quick="0">Сегодня</button>
            <button type="button" class="datepicker__quick" data-quick="1">Завтра</button>
          </div>`;

        // Быстрые кнопки недоступны, если дата вне диапазона
        pop.querySelectorAll('[data-quick]').forEach((b) => { b.disabled = !allowed(addDays(new Date(new Date().toDateString()), +b.dataset.quick)); });
        if (focus) pop.querySelector(`[data-iso="${toISODate(focus)}"]`)?.focus();
      };

      const open = () => {
        const base = input.value ? parse(input.value) : (bounds().min || new Date());
        view = new Date(base.getFullYear(), base.getMonth(), 1);
        focus = base;
        pop.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        root.classList.add('is-open');
        render();
      };
      const close = (restore = true) => {
        if (pop.hidden) return;
        pop.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        root.classList.remove('is-open');
        if (restore) trigger.focus();
      };
      const choose = (iso) => {
        input.value = iso;
        label.textContent = parse(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
        label.classList.remove('is-empty');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      };
      const moveFocus = (n) => {
        const next = addDays(focus, n);
        if (!allowed(next)) return;
        focus = next;
        if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) view = new Date(next.getFullYear(), next.getMonth(), 1);
        render();
      };

      trigger.addEventListener('click', () => (pop.hidden ? open() : close()));
      trigger.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && pop.hidden) { e.preventDefault(); open(); } });

      pop.addEventListener('click', (e) => {
        const day = e.target.closest('[data-iso]');
        const nav = e.target.closest('[data-nav]');
        const quick = e.target.closest('[data-quick]');
        if (day && !day.disabled) choose(day.dataset.iso);
        else if (nav && !nav.disabled) { view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1); focus = null; render(); }
        else if (quick && !quick.disabled) choose(toISODate(addDays(new Date(), +quick.dataset.quick)));
      });

      pop.addEventListener('keydown', (e) => {
        const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (!e.target.matches('[data-iso]')) return;
        focus = parse(e.target.dataset.iso);
        if (e.key in keys) { e.preventDefault(); moveFocus(keys[e.key]); }
        else if (e.key === 'PageUp' || e.key === 'PageDown') {
          e.preventDefault();
          const d = new Date(focus.getFullYear(), focus.getMonth() + (e.key === 'PageDown' ? 1 : -1), focus.getDate());
          if (allowed(d)) { focus = d; view = new Date(d.getFullYear(), d.getMonth(), 1); render(); }
        }
      });

      document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) close(false); });
      root.addEventListener('focusout', (e) => { if (e.relatedTarget && !root.contains(e.relatedTarget)) close(false); });

      // Сброс формы — очищаем подпись
      input.form?.addEventListener('reset', () => {
        setTimeout(() => { label.textContent = 'Выберите дату'; label.classList.add('is-empty'); close(false); });
      });
    }
  };
})();
