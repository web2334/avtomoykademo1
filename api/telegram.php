<?php
/**
 * AQUACAR — пересылка заявок с сайта в Telegram.
 *
 * Принимает POST JSON от формы записи и отправляет сообщение
 * в один или несколько чатов (менеджер, группа администраторов).
 * Настройки — в api/config.php.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

require __DIR__ . '/lib.php';
$config = aq_config();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Метод не поддерживается']);
}

// Защита от отправки с чужих сайтов
// Запросы со своего же домена разрешены всегда, allowed_origins — дополнительные домены
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $sameHost = strcasecmp((string) parse_url($origin, PHP_URL_HOST), (string) preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '')) === 0;
    if (!$sameHost && !in_array($origin, (array) ($config['allowed_origins'] ?? []), true)) {
        respond(403, ['ok' => false, 'error' => 'Запрещённый источник']);
    }
}

$raw = file_get_contents('php://input') ?: '';
if (strlen($raw) > 10000) {
    respond(413, ['ok' => false, 'error' => 'Слишком большой запрос']);
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(400, ['ok' => false, 'error' => 'Некорректные данные']);
}

// Honeypot: боты заполняют скрытое поле — отвечаем «успехом», но ничего не отправляем
if (!empty($data['company'])) {
    respond(200, ['ok' => true]);
}

// Ограничение частоты: не больше N заявок с одного IP за 10 минут
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . '/aquacar_rate_' . md5($ip);
$now = time();
$hits = array_filter(
    is_file($rateFile) ? (array) json_decode((string) file_get_contents($rateFile), true) : [],
    fn($t) => is_int($t) && $t > $now - 600
);
if (count($hits) >= (int) ($config['rate_limit'] ?? 5)) {
    respond(429, ['ok' => false, 'error' => 'Слишком много заявок, попробуйте позже']);
}
$hits[] = $now;
@file_put_contents($rateFile, json_encode(array_values($hits)));

// Валидация
$str = fn(string $key, int $max) => trim(mb_substr((string) ($data[$key] ?? ''), 0, $max));
$name    = $str('name', 50);
$phone   = preg_replace('/[^\d+]/', '', $str('phone', 20));
$service = $str('serviceTitle', 120);
$date    = $str('date', 10);
$time    = $str('time', 5);
$comment = $str('comment', 500);
$source  = $str('source', 300);
$consent = !empty($data['consent']);

if (mb_strlen($name) < 2 || strlen(preg_replace('/\D/', '', $phone)) !== 11 || $service === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    respond(422, ['ok' => false, 'error' => 'Проверьте заполнение формы']);
}
if (!$consent) {
    respond(422, ['ok' => false, 'error' => 'Нет согласия на обработку персональных данных']);
}

// Локализация (ст. 18 ч. 5 152-ФЗ): сначала записываем заявку в хранилище на сервере в РФ,
// и только потом пересылаем в Telegram. Если записать не удалось — в Telegram не отправляем.
$storageDir = (string) ($config['storage_dir'] ?? __DIR__ . '/storage');
if (!is_dir($storageDir) && !@mkdir($storageDir, 0750, true)) {
    respond(500, ['ok' => false, 'error' => 'Хранилище заявок недоступно']);
}
$record = [
    'id'             => bin2hex(random_bytes(6)),
    'status'         => 'new',
    'created_at'     => date('c'),
    'name'           => $name,
    'phone'          => $phone,
    'service'        => $service,
    'date'           => $date,
    'time'           => $time,
    'comment'        => $comment,
    'consent'        => true,
    'consent_at'     => $str('consentAt', 40) ?: date('c'),
    'policy_version' => $str('policyVersion', 20),
    'ip'             => $ip,
    'user_agent'     => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300),
];
$saved = @file_put_contents(
    $storageDir . '/bookings-' . date('Y-m') . '.jsonl',
    json_encode($record, JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND | LOCK_EX
);
if ($saved === false) {
    respond(500, ['ok' => false, 'error' => 'Не удалось сохранить заявку']);
}

// Сообщение
$e = fn(string $s) => htmlspecialchars($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
$dateHuman = date('d.m.Y', strtotime($date));
$lines = [
    '🚗 <b>Новая заявка с сайта AQUACAR</b>',
    '',
    '👤 <b>Имя:</b> ' . $e($name),
    '📞 <b>Телефон:</b> <a href="tel:' . $e($phone) . '">' . $e($phone) . '</a>',
    '🧽 <b>Услуга:</b> ' . $e($service),
    '📅 <b>Дата:</b> ' . $e($dateHuman) . ($time !== '' ? ', ' . $e($time) : ''),
];
if ($comment !== '') {
    $lines[] = '💬 <b>Комментарий:</b> ' . $e($comment);
}
$lines[] = '';
$lines[] = '🕒 ' . date('d.m.Y H:i') . ($source !== '' ? ' · ' . $e(parse_url($source, PHP_URL_HOST) ?: '') : '');
$text = implode("\n", $lines);

// Заявка уже сохранена и видна в админ-панели. Дополнительно — уведомление в Telegram
// (во все чаты из настроек). Если бот не настроен или недоступен, клиенту всё равно
// отвечаем успехом: заявка не потеряется.
$delivered = aq_bot_ready() ? aq_telegram_send($text) : 0;
respond(200, ['ok' => true, 'telegram' => $delivered > 0]);
