/**
 * Отправка заявок в Telegram.
 *
 * submitBooking(payload) — POST JSON на серверный обработчик, который пересылает
 *   заявку в Telegram-бот (см. api/telegram.php и api/booking.js).
 * telegramLink(payload)  — ссылка на чат с менеджером с готовым текстом заявки
 *   (переадресация, если сервер не настроен или недоступен).
 *
 * Формат payload:
 * { name, phone, service, serviceTitle, date, time, comment, source, createdAt }
 */
(function () {
  'use strict';

  AQ.api = {
    async submitBooking(payload) {
      const { endpoint, timeoutMs, headers } = AQ.config.booking;
      if (!endpoint) throw new Error('Endpoint не настроен');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) throw new Error(data.error || 'HTTP ' + res.status);
        return data;
      } finally {
        clearTimeout(timer);
      }
    },

    /** Текст заявки для Telegram */
    formatMessage(p) {
      const lines = [
        'Здравствуйте! Хочу записаться в AQUACAR.',
        '',
        `Имя: ${p.name}`,
        `Телефон: ${p.phone}`,
        `Услуга: ${p.serviceTitle}`,
        `Дата: ${AQ.utils.formatDateRu(p.date)}${p.time ? ', ' + p.time : ''}`
      ];
      if (p.comment) lines.push(`Комментарий: ${p.comment}`);
      return lines.join('\n');
    },

    telegramLink(p) {
      const user = AQ.config.booking.telegramManager;
      return `https://t.me/${user}?text=${encodeURIComponent(this.formatMessage(p))}`;
    }
  };
})();
