/**
 * AQUACAR — админ-панель (без сборки и фреймворков).
 * Все данные приходят из admin/api.php, всё, что выводится на страницу, экранируется.
 */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const ICONS = {
    's-wash': 'Мойка', 's-complex': 'Комплекс', 's-interior': 'Салон', 's-blacken': 'Шина/чернение', 's-wax': 'Капля/воск',
    's-polish': 'Полировка', 's-rim': 'Диск', 's-tire': 'Шина', 's-bug': 'Насекомые', 's-diamond': 'Бриллиант', 's-shield': 'Щит', 's-ozone': 'Озон'
  };
  const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Выполнена', cancelled: 'Отменена' };

  const state = { csrf: '', content: null, saved: null, tab: 'bookings', bookings: [], filter: { q: '', status: '' } };

  /* ---------- API ---------- */
  async function api(action, { method = 'GET', body, form } = {}) {
    if (state.demo) return DEMO.call(action, { body, form });
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (method !== 'GET') opts.headers['X-CSRF-Token'] = state.csrf;
    if (form) opts.body = form;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, data;
    try {
      res = await fetch('api.php?action=' + action, opts);
      data = await res.json();
    } catch (e) {
      // Первый запрос не получил JSON — значит, PHP на хостинге нет (например, GitHub Pages)
      if (action === 'me' && !state.checked) {
        state.demo = true;
        DEMO.enable();
        return DEMO.call(action, { body, form });
      }
      throw new Error('Сервер не отвечает. Проверьте подключение и обновите страницу');
    }
    if (action === 'me') { state.checked = true; DEMO.disable(); }
    if (res.status === 401 && action !== 'login') { showLogin(); throw new Error('Сессия закончилась, войдите снова'); }
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Ошибка ' + res.status);
    return data;
  }

  /* ---------- Демо-режим: без сервера, данные в браузере ---------- */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } }
  };
  const sha256 = async (txt) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  // Уменьшаем фото перед сохранением в браузер (место ограничено ~5 МБ)
  const shrink = (file) => new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Нужна картинка JPG, PNG или WebP'));
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1000 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Не удалось прочитать картинку'));
    img.src = URL.createObjectURL(file);
  });
  const DEMO_OFF = 'В демо-режиме это не работает — нужен хостинг с PHP (см. INSTALL.txt)';

  const DEMO = {
    enable() { try { localStorage.setItem('aq-demo', '1'); } catch (_) {} $('[data-demo-warn]').hidden = false; },
    disable() { try { localStorage.removeItem('aq-demo'); } catch (_) {} },
    async account() { return LS.get('aq-demo-account', null) || { login: 'admin', hash: await sha256('admin'), default: true }; },
    authed() { try { return sessionStorage.getItem('aq-demo-auth') === '1'; } catch (_) { return false; } },
    async call(action, { body = {}, form } = {}) {
      const acc = await this.account();
      if (action === 'me') return { auth: this.authed(), login: acc.login, csrf: 'demo', defaultPassword: !!acc.default };
      if (action === 'login') {
        if (body.login === acc.login && (await sha256(body.password || '')) === acc.hash) {
          try { sessionStorage.setItem('aq-demo-auth', '1'); } catch (_) {}
          return { ok: true, csrf: 'demo', defaultPassword: !!acc.default };
        }
        throw new Error('Неверный логин или пароль');
      }
      if (action === 'logout') { try { sessionStorage.removeItem('aq-demo-auth'); } catch (_) {} return { ok: true }; }
      if (!this.authed()) { showLogin(); throw new Error('Нужно войти'); }

      switch (action) {
        case 'content': {
          let c = LS.get('aq-demo-content', null);
          if (!c) c = await fetch('../data/content.json', { cache: 'no-cache' }).then((r) => r.json());
          return { ok: true, content: c };
        }
        case 'content_save': {
          const c = clone(body.content);
          c.version = (c.version || 0) + 1;
          c.updated = new Date().toISOString();
          if (!LS.set('aq-demo-content', c)) throw new Error('В браузере закончилось место — удалите лишние загруженные фото');
          return { ok: true, content: c };
        }
        case 'upload': return { ok: true, path: await shrink(form.get('file')) };
        case 'bookings': return { ok: true, bookings: LS.get('aq-demo-bookings', []), telegramReady: false };
        case 'booking_update': {
          const list = LS.get('aq-demo-bookings', []);
          list.forEach((b) => { if (b.id === body.id) b.status = body.status; });
          LS.set('aq-demo-bookings', list);
          return { ok: true };
        }
        case 'booking_delete': {
          LS.set('aq-demo-bookings', LS.get('aq-demo-bookings', []).filter((b) => b.id !== body.id));
          return { ok: true };
        }
        case 'settings': return { ok: true, hasToken: false, tokenHint: '', chatIds: [] };
        case 'settings_save':
        case 'telegram_test': throw new Error(DEMO_OFF);
        case 'password': {
          if ((await sha256(body.current || '')) !== acc.hash) throw new Error('Текущий пароль неверный');
          if (!/^[A-Za-z0-9_.@-]{3,64}$/.test(body.login || '')) throw new Error('Логин: 3–64 символа, латиница, цифры, _ . @ -');
          if ((body.password || '').length < 8) throw new Error('Пароль — не короче 8 символов');
          LS.set('aq-demo-account', { login: body.login, hash: await sha256(body.password), default: false });
          return { ok: true };
        }
        default: throw new Error('Неизвестное действие');
      }
    }
  };

  // CSV в демо-режиме собираем прямо в браузере
  function downloadCsv(list) {
    const cell = (v) => {
      let t = String(v ?? '');
      if (/^([=\-@\t\r]|\+(?!\d))/.test(t)) t = "'" + t;
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const rows = [['Создана', 'Статус', 'Имя', 'Телефон', 'Услуга', 'Дата', 'Время', 'Комментарий']]
      .concat(list.map((b) => [b.created_at, b.status, b.name, b.phone, b.service, b.date, b.time, b.comment]));
    const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aquacar-bookings-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Путь к фото: загруженное в демо-режиме хранится как data:URL
  const photoSrc = (p, id) => (p && p.startsWith('data:') ? p : '../' + (p || 'assets/img/photos/svc-' + id + '.jpg'));

  let toastTimer;
  function toast(msg, error = false) {
    const t = $('[data-toast]');
    t.textContent = msg;
    t.classList.toggle('is-error', error);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), error ? 6000 : 3000);
  }

  /* ---------- Вход ---------- */
  function showLogin() {
    $('[data-app]').hidden = true;
    $('[data-login]').hidden = false;
    $('[data-login-form] [name=login]').focus();
  }

  $('[data-login-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $('[data-login-error]');
    err.textContent = '';
    const btn = f.querySelector('button');
    btn.disabled = true;
    try {
      const d = await api('login', { method: 'POST', body: { login: f.login.value.trim(), password: f.password.value } });
      state.csrf = d.csrf;
      f.reset();
      await startApp(d.defaultPassword);
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    if (isDirty() && !confirm('Есть несохранённые изменения. Всё равно выйти?')) return;
    await api('logout', { method: 'POST' }).catch(() => {});
    const me = await api('me');
    state.csrf = me.csrf;
    showLogin();
  });

  async function startApp(defaultPassword) {
    $('[data-login]').hidden = true;
    $('[data-app]').hidden = false;
    $('[data-default-warn]').hidden = !defaultPassword;
    const d = await api('content');
    state.content = d.content;
    state.saved = clone(d.content);
    await loadBookings();
    go(state.tab);
  }

  /* ---------- Навигация ---------- */
  function go(tab) {
    state.tab = tab;
    $$('[data-tab]').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    VIEWS[tab]();
    window.scrollTo(0, 0);
  }
  $('[data-nav]').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) go(b.dataset.goto); });

  /* ---------- Сохранение контента ---------- */
  const isDirty = () => state.content && JSON.stringify(state.content) !== JSON.stringify(state.saved);
  const markDirty = () => { $('[data-savebar]').hidden = !isDirty(); };

  $('[data-save]').addEventListener('click', async () => {
    const btn = $('[data-save]');
    btn.disabled = true;
    try {
      const d = await api('content_save', { method: 'POST', body: { content: state.content } });
      state.content = d.content;
      state.saved = clone(d.content);
      markDirty();
      VIEWS[state.tab]();
      toast('Сохранено. Изменения уже на сайте');
    } catch (ex) {
      toast(ex.message, true);
    } finally {
      btn.disabled = false;
    }
  });
  $('[data-revert]').addEventListener('click', () => {
    state.content = clone(state.saved);
    markDirty();
    VIEWS[state.tab]();
  });
  window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  // Поля с data-path="contacts.phone" пишут прямо в state.content
  function bindPaths(root) {
    $$('[data-path]', root).forEach((el) => {
      const path = el.dataset.path.split('.');
      let obj = state.content;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] = obj[path[i]] || {};
      const key = path[path.length - 1];
      el.value = obj[key] ?? '';
      el.addEventListener('input', () => {
        obj[key] = el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value;
        markDirty();
      });
    });
  }

  async function upload(file) {
    const form = new FormData();
    form.append('file', file);
    const d = await api('upload', { method: 'POST', form });
    return d.path;
  }

  /* ---------- Разделы ---------- */
  const view = () => $('[data-view]');

  async function loadBookings() {
    const d = await api('bookings');
    state.bookings = d.bookings;
    state.telegramReady = d.telegramReady;
    const n = d.bookings.filter((b) => b.status === 'new').length;
    const badge = $('[data-new-count]');
    badge.textContent = n;
    badge.hidden = !n;
  }

  const VIEWS = {
    bookings() {
      const { q, status } = state.filter;
      const list = state.bookings.filter((b) =>
        (!status || b.status === status) &&
        (!q || [b.name, b.phone, b.service, b.comment].join(' ').toLowerCase().includes(q.toLowerCase())));
      const fmt = (iso) => iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      const date = (d) => d ? new Date(d + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' }) : '';
      view().innerHTML = `
        <header>
          <div><h1>Заявки</h1><p>Все заявки с сайта сохраняются здесь${state.telegramReady ? ' и дублируются в Telegram' : '. Telegram пока не подключён — <button class="link" data-goto="telegram">подключить</button>'}.</p></div>
          <div class="tools">
            <input type="search" placeholder="Поиск: имя, телефон, услуга" value="${esc(q)}" data-q>
            <select data-status>
              <option value="">Все статусы</option>
              ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === status ? ' selected' : ''}>${v}</option>`).join('')}
            </select>
            <button class="btn" type="button" data-refresh>Обновить</button>
            <a class="btn" href="api.php?action=bookings_csv" data-csv>Скачать CSV</a>
          </div>
        </header>
        ${list.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>Создана</th><th>Клиент</th><th>Услуга</th><th>Когда</th><th>Комментарий</th><th>Статус</th><th></th></tr></thead>
          <tbody>${list.map((b) => `
            <tr class="st-${esc(b.status)}" data-id="${esc(b.id)}">
              <td class="nowrap">${esc(fmt(b.created_at))}</td>
              <td><b>${esc(b.name)}</b><br><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td>
              <td>${esc(b.service)}</td>
              <td class="nowrap">${esc(date(b.date))}${b.time ? '<br>' + esc(b.time) : ''}</td>
              <td><div class="comment">${esc(b.comment) || '<span class="muted">—</span>'}</div></td>
              <td><select data-set-status>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === b.status ? ' selected' : ''}>${v}</option>`).join('')}</select></td>
              <td><button class="btn btn--sm btn--danger" type="button" data-del>Удалить</button></td>
            </tr>`).join('')}</tbody>
        </table></div>` : `<div class="card empty">${state.bookings.length ? 'Ничего не найдено' : 'Заявок пока нет. Как только клиент отправит форму на сайте, она появится здесь.'}</div>`}`;

      const q$ = $('[data-q]'), s$ = $('[data-status]');
      q$.addEventListener('input', () => { state.filter.q = q$.value; VIEWS.bookings(); const el = $('[data-q]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
      s$.addEventListener('change', () => { state.filter.status = s$.value; VIEWS.bookings(); });
      $('[data-csv]').addEventListener('click', (e) => { if (state.demo) { e.preventDefault(); downloadCsv(state.bookings); } });
      $('[data-refresh]').addEventListener('click', async () => { await loadBookings(); VIEWS.bookings(); toast('Список обновлён'); });
      $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
        const id = b.closest('tr').dataset.id;
        if (!confirm('Удалить заявку без возможности восстановления?')) return;
        try { await api('booking_delete', { method: 'POST', body: { id } }); await loadBookings(); VIEWS.bookings(); toast('Заявка удалена'); }
        catch (ex) { toast(ex.message, true); }
      }));
    },

    services() {
      const c = state.content;
      const cats = c.categories || {};
      view().innerHTML = `
        <header>
          <div><h1>Услуги</h1><p>Карточки каталога, окна «Подробнее» и список в форме записи. Пустая цена — «Цена по запросу».</p></div>
          <div class="tools"><button class="btn btn--primary" type="button" data-add>+ Добавить услугу</button></div>
        </header>
        <div data-list>${c.services.map((s, i) => `
          <details class="item${s.hidden ? ' is-hidden' : ''}" data-i="${i}">
            <summary>
              <img class="item__thumb" src="${esc(photoSrc(s.photo, s.id))}" alt="" onerror="this.style.visibility='hidden'">
              <div><div class="item__title">${esc(s.title)}</div><div class="item__sub">${s.price == null ? 'Цена по запросу' : 'от ' + Number(s.price).toLocaleString('ru-RU') + ' ₽'} · ${esc(s.duration)}</div></div>
              <div class="item__actions">
                <button class="btn btn--sm" type="button" data-move="-1" title="Выше" aria-label="Переместить выше">↑</button>
                <button class="btn btn--sm" type="button" data-move="1" title="Ниже" aria-label="Переместить ниже">↓</button>
              </div>
            </summary>
            <div class="item__body grid grid--2">
              <label class="fld"><span>Название</span><input data-f="title" value="${esc(s.title)}" maxlength="120"></label>
              <label class="fld"><span>Длительность</span><input data-f="duration" value="${esc(s.duration)}" placeholder="30–40 мин" maxlength="40"></label>
              <label class="fld"><span>Цена «от», ₽</span><input data-f="price" type="number" min="0" step="100" value="${s.price ?? ''}" placeholder="пусто — по запросу"></label>
              <label class="fld"><span>Метка на фото</span><input data-f="badge" value="${esc(s.badge)}" placeholder="например, «Чаще всего»" maxlength="30"></label>
              <label class="fld full"><span>Кратко (в карточке)</span><textarea data-f="short" rows="2" maxlength="300">${esc(s.short)}</textarea></label>
              <label class="fld full"><span>Подробное описание (в окне «Подробнее»)</span><textarea data-f="description" rows="3" maxlength="1000">${esc(s.description)}</textarea></label>
              <label class="fld full"><span>Что входит — по одному пункту в строке</span><textarea data-f="includes" rows="5">${esc((s.includes || []).join('\n'))}</textarea></label>
              <div class="fld"><span>Категории</span><div class="checks">${Object.entries(cats).map(([k, v]) => `<label><input type="checkbox" data-cat="${esc(k)}"${(s.categories || []).includes(k) ? ' checked' : ''}>${esc(v)}</label>`).join('')}</div></div>
              <label class="fld"><span>Иконка</span><select data-f="icon">${Object.entries(ICONS).map(([k, v]) => `<option value="${k}"${k === s.icon ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
              <div class="fld full"><span>Фото</span>
                <div class="photo">
                  <img src="${esc(photoSrc(s.photo, s.id))}" alt="" data-preview onerror="this.style.visibility='hidden'">
                  <div class="tools"><label class="btn">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp" hidden data-upload></label><small class="muted">JPG/PNG/WebP до 6 МБ, лучше горизонтальное 900×600</small></div>
                </div>
              </div>
              <div class="full tools">
                <label class="checks"><label><input type="checkbox" data-f="hidden"${s.hidden ? ' checked' : ''}>Скрыть с сайта</label></label>
                <button class="btn btn--danger" type="button" data-remove style="margin-left:auto">Удалить услугу</button>
              </div>
            </div>
          </details>`).join('')}</div>`;

      $('[data-add]').addEventListener('click', () => {
        c.services.push({ id: '', title: 'Новая услуга', short: '', description: '', categories: ['exterior'], price: null, duration: '', icon: 's-wash', badge: '', photo: '', includes: [], hidden: true });
        markDirty();
        VIEWS.services();
        const last = $$('[data-list] details').pop();
        last.open = true;
        last.scrollIntoView({ block: 'center' });
        toast('Услуга добавлена скрытой — заполните её и снимите галочку «Скрыть»');
      });
      bindItems(c.services, 'services', (s, el) => {
        el.querySelector('[data-upload]').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            s.photo = await upload(file);
            el.querySelector('[data-preview]').src = photoSrc(s.photo, s.id);
            el.querySelector('[data-preview]').style.visibility = '';
            el.querySelector('.item__thumb').src = photoSrc(s.photo, s.id);
            markDirty();
            toast('Фото загружено. Не забудьте сохранить');
          } catch (ex) { toast(ex.message, true); }
        });
        el.querySelectorAll('[data-cat]').forEach((cb) => cb.addEventListener('change', () => {
          s.categories = $$('[data-cat]', el).filter((x) => x.checked).map((x) => x.dataset.cat);
          markDirty();
        }));
      });
    },

    reviews() {
      const c = state.content;
      view().innerHTML = `
        <header>
          <div><h1>Отзывы</h1><p>Показываются на главной (карусель) и на странице «Отзывы».</p></div>
          <div class="tools"><button class="btn btn--primary" type="button" data-add>+ Добавить отзыв</button></div>
        </header>
        <div class="card grid">
          <label class="fld"><span>Средняя оценка</span><input data-path="rating.value" placeholder="4,9" maxlength="10"></label>
          <label class="fld"><span>Количество отзывов</span><input data-path="rating.count" placeholder="640+" maxlength="20"></label>
        </div>
        <div data-list>${c.reviews.map((r, i) => `
          <details class="item${r.hidden ? ' is-hidden' : ''}" data-i="${i}">
            <summary>
              <div><div class="item__title">${esc(r.name)}</div><div class="item__sub">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} · ${esc(r.car)}</div></div>
              <div class="item__actions">
                <button class="btn btn--sm" type="button" data-move="-1" aria-label="Переместить выше">↑</button>
                <button class="btn btn--sm" type="button" data-move="1" aria-label="Переместить ниже">↓</button>
              </div>
            </summary>
            <div class="item__body grid grid--2">
              <label class="fld"><span>Имя</span><input data-f="name" value="${esc(r.name)}" maxlength="80"></label>
              <label class="fld"><span>Автомобиль</span><input data-f="car" value="${esc(r.car)}" maxlength="80"></label>
              <label class="fld"><span>Оценка</span><select data-f="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${n === r.rating ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
              <label class="fld"><span>Когда</span><input data-f="date" value="${esc(r.date)}" placeholder="2 недели назад" maxlength="40"></label>
              <label class="fld"><span>Услуга (метка)</span><input data-f="service" value="${esc(r.service)}" maxlength="40"></label>
              <label class="fld full"><span>Текст отзыва</span><textarea data-f="text" rows="4" maxlength="1200">${esc(r.text)}</textarea></label>
              <div class="full tools">
                <label class="checks"><label><input type="checkbox" data-f="hidden"${r.hidden ? ' checked' : ''}>Скрыть с сайта</label></label>
                <button class="btn btn--danger" type="button" data-remove style="margin-left:auto">Удалить отзыв</button>
              </div>
            </div>
          </details>`).join('')}</div>`;
      bindPaths(view());
      $('[data-add]').addEventListener('click', () => {
        c.reviews.unshift({ id: '', name: 'Имя клиента', car: '', rating: 5, date: 'сегодня', service: '', text: '', hidden: true });
        markDirty();
        VIEWS.reviews();
        $('[data-list] details').open = true;
      });
      bindItems(c.reviews, 'reviews');
    },

    contacts() {
      view().innerHTML = `
        <header><div><h1>Контакты и главная</h1><p>Меняются в шапке, подвале, на странице контактов и записи.</p></div></header>
        <div class="card"><h3>Контакты</h3><div class="grid">
          <label class="fld"><span>Телефон</span><input data-path="contacts.phone" placeholder="+7 (495) 120-45-67"></label>
          <label class="fld"><span>E-mail</span><input data-path="contacts.email" type="email"></label>
          <label class="fld full"><span>Адрес</span><input data-path="contacts.address"></label>
          <label class="fld full"><span>Как добраться (подпись под адресом)</span><input data-path="contacts.addressHint"></label>
          <label class="fld"><span>График (текст)</span><input data-path="contacts.hours" placeholder="Ежедневно, 08:00–22:00"></label>
          <label class="fld"><span>Открываемся, час</span><input data-path="contacts.openHour" type="number" min="0" max="23"></label>
          <label class="fld"><span>Закрываемся, час</span><input data-path="contacts.closeHour" type="number" min="1" max="24"></label>
        </div><p class="muted">Часы нужны для подписи «Сейчас открыто / закрыто» на странице контактов (по московскому времени).</p></div>
        <div class="card"><h3>Ссылки</h3><div class="grid">
          <label class="fld"><span>Telegram-канал или чат</span><input data-path="contacts.telegram" placeholder="https://t.me/..."></label>
          <label class="fld"><span>WhatsApp</span><input data-path="contacts.whatsapp" placeholder="https://wa.me/7..."></label>
          <label class="fld"><span>ВКонтакте</span><input data-path="contacts.vk" placeholder="https://vk.com/..."></label>
          <label class="fld full"><span>Кнопка «Построить маршрут»</span><input data-path="contacts.route"><small>Яндекс Карты → ваш адрес → «Маршрут» → скопируйте ссылку</small></label>
          <label class="fld full"><span>Карта (клик по блоку с картой)</span><input data-path="contacts.map"></label>
        </div></div>
        <div class="card"><h3>Главный экран</h3><div class="grid grid--2">
          <label class="fld"><span>Заголовок</span><input data-path="hero.title" maxlength="120"></label>
          <label class="fld"><span>Выделенное слово в конце</span><input data-path="hero.accent" maxlength="60"></label>
          <label class="fld full"><span>Подзаголовок</span><textarea data-path="hero.subtitle" rows="2" maxlength="300"></textarea></label>
          <label class="fld"><span>Факт 1</span><input data-path="hero.meta.0" maxlength="60"></label>
          <label class="fld"><span>Факт 2</span><input data-path="hero.meta.1" maxlength="60"></label>
          <label class="fld"><span>Факт 3</span><input data-path="hero.meta.2" maxlength="60"></label>
        </div></div>`;
      bindPaths(view());
    },

    async telegram() {
      view().innerHTML = `
        <header><div><h1>Запись и Telegram</h1><p>Куда приходят заявки и какие даты и время можно выбрать в форме.</p></div></header>
        <div class="card"><h3>Форма записи</h3><div class="grid">
          <label class="fld"><span>Первый слот, час</span><input data-path="booking.slotFrom" type="number" min="0" max="23"></label>
          <label class="fld"><span>Последний слот, час</span><input data-path="booking.slotTo" type="number" min="0" max="23"></label>
          <label class="fld"><span>Запись вперёд, дней</span><input data-path="booking.daysAhead" type="number" min="1" max="365"></label>
          <label class="fld"><span>Username менеджера в Telegram</span><input data-path="booking.telegramManager" placeholder="aquacar_manager"><small>Без @. Кнопка «Написать менеджеру» и запасной вариант отправки.</small></label>
        </div><p class="muted">Эти поля сохраняются кнопкой «Сохранить на сайте» внизу.</p></div>
        <div class="card"><h3>Telegram-бот для уведомлений</h3>
          <div class="note">1. Создайте бота у <b>@BotFather</b> и скопируйте токен.<br>2. Напишите боту /start (или добавьте его в группу менеджеров).<br>3. Откройте <code>api.telegram.org/bot&lt;токен&gt;/getUpdates</code> и найдите <code>"chat":{"id": …}</code>.</div>
          <div class="grid grid--2">
            <label class="fld"><span>Токен бота</span><input type="password" autocomplete="off" data-token placeholder="загрузка…"><small data-token-hint></small></label>
            <label class="fld"><span>chat_id — по одному в строке</span><textarea rows="3" data-chats placeholder="123456789"></textarea><small>Заявка уйдёт во все указанные чаты</small></label>
          </div>
          <div class="tools" style="margin-top:14px">
            <button class="btn btn--primary" type="button" data-save-tg>Сохранить настройки бота</button>
            <button class="btn" type="button" data-test-tg>Отправить тестовое сообщение</button>
          </div>
        </div>`;
      bindPaths(view());
      if (state.demo) {
        $('[data-token]').disabled = true;
        $('[data-chats]').disabled = true;
        $('[data-token-hint]').textContent = 'В демо-режиме бот не подключается: токен нельзя хранить в браузере. Работает на хостинге с PHP.';
      }
      try {
        const s = await api('settings');
        $('[data-token]').placeholder = s.hasToken ? 'Токен сохранён — оставьте пустым, чтобы не менять' : '123456789:AA…';
        $('[data-token-hint]').textContent = s.hasToken ? 'Сейчас: ' + s.tokenHint : 'Токен ещё не указан';
        $('[data-chats]').value = s.chatIds.join('\n');
      } catch (ex) { toast(ex.message, true); }
      $('[data-save-tg]').addEventListener('click', async () => {
        try {
          await api('settings_save', { method: 'POST', body: { bot_token: $('[data-token]').value.trim(), chat_ids: $('[data-chats]').value.split(/[\s,]+/).filter(Boolean) } });
          toast('Настройки бота сохранены');
          VIEWS.telegram();
          loadBookings();
        } catch (ex) { toast(ex.message, true); }
      });
      $('[data-test-tg]').addEventListener('click', async () => {
        try { const d = await api('telegram_test', { method: 'POST' }); toast(`Отправлено в чатов: ${d.delivered}`); }
        catch (ex) { toast(ex.message, true); }
      });
    },

    security() {
      view().innerHTML = `
        <header><div><h1>Безопасность</h1><p>Логин и пароль для входа в админ-панель.</p></div></header>
        <form class="card grid" style="max-width:640px" data-pass>
          <label class="fld full"><span>Текущий пароль</span><input name="current" type="password" autocomplete="current-password" required></label>
          <label class="fld"><span>Новый логин</span><input name="login" autocomplete="username" required></label>
          <label class="fld"><span>Новый пароль</span><input name="password" type="password" autocomplete="new-password" minlength="8" required><small>Не короче 8 символов</small></label>
          <label class="fld"><span>Повторите пароль</span><input name="password2" type="password" autocomplete="new-password" required></label>
          <div class="full"><button class="btn btn--primary" type="submit">Сменить</button></div>
        </form>`;
      api('me').then((m) => { $('[data-pass] [name=login]').value = m.login || 'admin'; });
      $('[data-pass]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        if (f.password.value !== f.password2.value) { toast('Пароли не совпадают', true); return; }
        try {
          await api('password', { method: 'POST', body: { current: f.current.value, login: f.login.value.trim(), password: f.password.value } });
          f.reset();
          $('[data-default-warn]').hidden = true;
          toast('Логин и пароль изменены');
          VIEWS.security();
        } catch (ex) { toast(ex.message, true); }
      });
    }
  };

  async function onBookingChange(e) {
    const sel = e.target.closest('[data-set-status]');
    if (!sel) return;
    const id = sel.closest('tr').dataset.id;
    try {
      await api('booking_update', { method: 'POST', body: { id, status: sel.value } });
      const b = state.bookings.find((x) => x.id === id);
      if (b) b.status = sel.value;
      await loadBookings();
      VIEWS.bookings();
      toast('Статус обновлён');
    } catch (ex) { toast(ex.message, true); VIEWS.bookings(); }
  }

  // Общие действия для списков услуг и отзывов
  function bindItems(arr, name, extra) {
    $$('[data-list] > details').forEach((el) => {
      const i = Number(el.dataset.i);
      const item = arr[i];
      $$('[data-f]', el).forEach((input) => {
        const f = input.dataset.f;
        const ev = input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(ev, () => {
          if (input.type === 'checkbox') item[f] = input.checked;
          else if (f === 'price') item[f] = input.value === '' ? null : Number(input.value);
          else if (f === 'rating') item[f] = Number(input.value);
          else if (f === 'includes') item[f] = input.value.split('\n').map((x) => x.trim()).filter(Boolean);
          else item[f] = input.value;
          if (f === 'hidden') el.classList.toggle('is-hidden', input.checked);
          if (f === 'title' || f === 'name') el.querySelector('.item__title').textContent = input.value;
          markDirty();
        });
      });
      $$('[data-move]', el).forEach((b) => b.addEventListener('click', (e) => {
        e.preventDefault();
        const j = i + Number(b.dataset.move);
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        markDirty();
        VIEWS[name]();
      }));
      el.querySelector('[data-remove]').addEventListener('click', () => {
        if (!confirm('Удалить? Восстановить можно только кнопкой «Отменить» до сохранения.')) return;
        arr.splice(i, 1);
        markDirty();
        VIEWS[name]();
      });
      if (extra) extra(item, el);
    });
  }

  // Один делегированный обработчик статусов на весь раздел «Заявки»
  view().addEventListener('change', (e) => { if (state.tab === 'bookings') onBookingChange(e); });

  /* ---------- Старт ---------- */
  (async function init() {
    try {
      const me = await api('me');
      state.csrf = me.csrf;
      if (me.auth) await startApp(me.defaultPassword);
      else showLogin();
    } catch (ex) {
      showLogin();
      $('[data-login-error]').textContent = ex.message;
    }
  })();
})();
