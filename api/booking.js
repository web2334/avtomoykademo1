/**
 * Вариант для Vercel / Netlify Functions (Node 18+).
 * Переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_IDS (через запятую).
 * В assets/js/config.js укажите endpoint: '/api/booking'.
 *
 * ВНИМАНИЕ: Vercel/Netlify размещают функции за рубежом. Для соответствия требованию
 * о локализации (ст. 18 ч. 5 152-ФЗ) заявку нужно сначала сохранить в базе в РФ
 * (например, Yandex Cloud) — добавьте запись перед отправкой в Telegram.
 * Для российского хостинга используйте api/telegram.php — там сохранение уже есть.
 */
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Метод не поддерживается' });

  const d = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  if (d.company) return res.status(200).json({ ok: true }); // honeypot

  const name = String(d.name || '').trim().slice(0, 50);
  const phone = String(d.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  const service = String(d.serviceTitle || '').slice(0, 120);
  const date = String(d.date || '');
  if (name.length < 2 || phone.replace(/\D/g, '').length !== 11 || !service || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(422).json({ ok: false, error: 'Проверьте заполнение формы' });
  }

  if (!d.consent) return res.status(422).json({ ok: false, error: 'Нет согласия на обработку персональных данных' });

  const [y, m, day] = date.split('-');
  const text = [
    '🚗 <b>Новая заявка с сайта AQUACAR</b>',
    '',
    `👤 <b>Имя:</b> ${esc(name)}`,
    `📞 <b>Телефон:</b> ${esc(phone)}`,
    `🧽 <b>Услуга:</b> ${esc(service)}`,
    `📅 <b>Дата:</b> ${day}.${m}.${y}${d.time ? ', ' + esc(String(d.time).slice(0, 5)) : ''}`,
    d.comment ? `💬 <b>Комментарий:</b> ${esc(String(d.comment).slice(0, 500))}` : ''
  ].filter(Boolean).join('\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!token || !chats.length) return res.status(500).json({ ok: false, error: 'Бот не настроен' });

  const results = await Promise.all(chats.map((chat_id) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true })
    }).then((r) => r.json()).catch(() => ({ ok: false }))
  ));
  const delivered = results.filter((r) => r.ok).length;
  if (!delivered) return res.status(502).json({ ok: false, error: 'Не удалось доставить заявку' });
  return res.status(200).json({ ok: true, delivered });
}
