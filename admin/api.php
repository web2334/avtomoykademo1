<?php
/**
 * AQUACAR — API админ-панели.
 *
 * GET  ?action=me                 — статус сессии и CSRF-токен
 * POST ?action=login              — вход {login, password}
 * POST ?action=logout
 * GET  ?action=content            — данные сайта
 * POST ?action=content_save       — сохранить {content}
 * POST ?action=upload             — загрузить фото (multipart, поле file)
 * GET  ?action=bookings           — список заявок
 * POST ?action=booking_update     — {id, status, note}
 * POST ?action=booking_delete     — {id}
 * GET  ?action=bookings_csv       — выгрузка заявок в CSV
 * GET  ?action=settings           — настройки Telegram (токен скрыт)
 * POST ?action=settings_save      — {bot_token?, chat_ids}
 * POST ?action=telegram_test      — тестовое сообщение
 * POST ?action=password           — {current, login, password}
 */
declare(strict_types=1);

require __DIR__ . '/../api/lib.php';

session_name('aq_admin');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Strict',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();

const SESSION_TTL = 8 * 3600;
const STATUSES = ['new', 'confirmed', 'done', 'cancelled'];

$action = (string) ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ---------- Учётная запись ---------- */

function admin_account(): array
{
    $file = aq_storage() . '/admin.json';
    $acc = aq_read_json($file);
    if (!is_array($acc) || empty($acc['hash'])) {
        // Первый запуск: логин admin, пароль admin. Смените их в разделе «Безопасность».
        $acc = ['login' => 'admin', 'hash' => password_hash('admin', PASSWORD_DEFAULT), 'default' => true];
        aq_write_json($file, $acc);
    }
    return $acc;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function is_authed(): bool
{
    if (empty($_SESSION['auth'])) {
        return false;
    }
    if (time() - (int) ($_SESSION['seen'] ?? 0) > SESSION_TTL) {
        $_SESSION = [];
        return false;
    }
    $_SESSION['seen'] = time();
    return true;
}

function body(): array
{
    $data = json_decode((string) file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function str_clean($v, int $max = 500): string
{
    $s = trim((string) $v);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}

function url_clean($v): string
{
    $s = str_clean($v, 500);
    return preg_match('~^(https?://|tel:|mailto:)~i', $s) ? $s : '';
}

/* ---------- Проверки перед действиями ---------- */

if ($action === 'me') {
    aq_json(200, [
        'auth'            => is_authed(),
        'login'           => $_SESSION['login'] ?? null,
        'csrf'            => csrf_token(),
        'defaultPassword' => !empty(admin_account()['default']),
    ]);
}

if ($method === 'POST') {
    $sent = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if ($sent === '' || !hash_equals(csrf_token(), $sent)) {
        aq_json(403, ['ok' => false, 'error' => 'Сессия устарела, обновите страницу']);
    }
}

/* ---------- Вход / выход ---------- */

if ($action === 'login' && $method === 'POST') {
    // Не больше 5 неудачных попыток с одного IP за 15 минут
    $file = aq_storage() . '/login_attempts.json';
    $attempts = aq_read_json($file, []);
    $ip = aq_client_ip();
    $now = time();
    $recent = array_values(array_filter((array) ($attempts[$ip] ?? []), fn($t) => $t > $now - 900));
    if (count($recent) >= 5) {
        aq_json(429, ['ok' => false, 'error' => 'Слишком много попыток. Подождите 15 минут']);
    }

    $in = body();
    $acc = admin_account();
    $okLogin = hash_equals((string) $acc['login'], str_clean($in['login'] ?? '', 64));
    $okPass = password_verify((string) ($in['password'] ?? ''), (string) $acc['hash']);

    if (!$okLogin || !$okPass) {
        $recent[] = $now;
        $attempts[$ip] = $recent;
        aq_write_json($file, $attempts);
        usleep(400000);
        aq_json(401, ['ok' => false, 'error' => 'Неверный логин или пароль']);
    }

    unset($attempts[$ip]);
    aq_write_json($file, $attempts);
    session_regenerate_id(true);
    $_SESSION['auth'] = true;
    $_SESSION['login'] = $acc['login'];
    $_SESSION['seen'] = $now;
    $_SESSION['csrf'] = bin2hex(random_bytes(24));
    aq_json(200, ['ok' => true, 'csrf' => $_SESSION['csrf'], 'defaultPassword' => !empty($acc['default'])]);
}

if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];
    session_destroy();
    aq_json(200, ['ok' => true]);
}

if (!is_authed()) {
    aq_json(401, ['ok' => false, 'error' => 'Нужно войти']);
}

/* ---------- Контент сайта ---------- */

if ($action === 'content' && $method === 'GET') {
    aq_json(200, ['ok' => true, 'content' => aq_read_json(AQ_CONTENT, [])]);
}

if ($action === 'content_save' && $method === 'POST') {
    $in = body()['content'] ?? null;
    if (!is_array($in)) {
        aq_json(400, ['ok' => false, 'error' => 'Нет данных']);
    }
    $old = aq_read_json(AQ_CONTENT, []);
    $categories = is_array($old['categories'] ?? null) ? $old['categories'] : ['exterior' => 'Экстерьер', 'interior' => 'Интерьер', 'protection' => 'Защита', 'complex' => 'Комплексные услуги'];

    $c = $in['contacts'] ?? [];
    $h = $in['hero'] ?? [];
    $b = $in['booking'] ?? [];
    $r = $in['rating'] ?? [];

    $content = [
        'version'  => (int) ($old['version'] ?? 0) + 1,
        'updated'  => date('c'),
        'contacts' => [
            'phone'       => str_clean($c['phone'] ?? '', 40),
            'email'       => filter_var(str_clean($c['email'] ?? '', 120), FILTER_VALIDATE_EMAIL) ?: '',
            'address'     => str_clean($c['address'] ?? '', 200),
            'addressHint' => str_clean($c['addressHint'] ?? '', 200),
            'hours'       => str_clean($c['hours'] ?? '', 120),
            'openHour'    => max(0, min(23, (int) ($c['openHour'] ?? 8))),
            'closeHour'   => max(1, min(24, (int) ($c['closeHour'] ?? 22))),
            'telegram'    => url_clean($c['telegram'] ?? ''),
            'whatsapp'    => url_clean($c['whatsapp'] ?? ''),
            'vk'          => url_clean($c['vk'] ?? ''),
            'route'       => url_clean($c['route'] ?? ''),
            'map'         => url_clean($c['map'] ?? ''),
        ],
        'hero' => [
            'title'    => str_clean($h['title'] ?? '', 120),
            'accent'   => str_clean($h['accent'] ?? '', 60),
            'subtitle' => str_clean($h['subtitle'] ?? '', 300),
            'meta'     => array_values(array_filter(array_map(fn($m) => str_clean($m, 60), array_slice((array) ($h['meta'] ?? []), 0, 4)))),
        ],
        'rating' => [
            'value' => str_clean($r['value'] ?? '', 10),
            'count' => str_clean($r['count'] ?? '', 20),
        ],
        'booking' => [
            'telegramManager' => ltrim(preg_replace('/[^A-Za-z0-9_@]/', '', (string) ($b['telegramManager'] ?? '')), '@'),
            'slotFrom'        => max(0, min(23, (int) ($b['slotFrom'] ?? 8))),
            'slotTo'          => max(0, min(23, (int) ($b['slotTo'] ?? 21))),
            'daysAhead'       => max(1, min(365, (int) ($b['daysAhead'] ?? 60))),
        ],
        'categories' => $categories,
        'services'   => [],
        'reviews'    => [],
    ];

    $ids = [];
    foreach (array_slice((array) ($in['services'] ?? []), 0, 60) as $s) {
        $title = str_clean($s['title'] ?? '', 120);
        if ($title === '') {
            continue;
        }
        $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string) ($s['id'] ?? '')));
        if ($id === '' || isset($ids[$id])) {
            $id = 's-' . bin2hex(random_bytes(3));
        }
        $ids[$id] = true;
        $photo = str_clean($s['photo'] ?? '', 200);
        if (!preg_match('~^assets/img/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$~', $photo) || str_contains($photo, '..')) {
            $photo = '';
        }
        $price = $s['price'] ?? null;
        $content['services'][] = [
            'id'          => $id,
            'title'       => $title,
            'short'       => str_clean($s['short'] ?? '', 300),
            'description' => str_clean($s['description'] ?? '', 1000),
            'categories'  => array_values(array_intersect((array) ($s['categories'] ?? []), array_keys($categories))) ?: ['exterior'],
            'price'       => ($price === null || $price === '') ? null : max(0, (int) $price),
            'duration'    => str_clean($s['duration'] ?? '', 40),
            'icon'        => preg_replace('/[^a-z0-9-]/', '', (string) ($s['icon'] ?? 's-wash')) ?: 's-wash',
            'badge'       => str_clean($s['badge'] ?? '', 30),
            'photo'       => $photo,
            'includes'    => array_values(array_filter(array_map(fn($x) => str_clean($x, 160), array_slice((array) ($s['includes'] ?? []), 0, 12)))),
            'hidden'      => !empty($s['hidden']),
        ];
    }
    if (!$content['services']) {
        aq_json(422, ['ok' => false, 'error' => 'Должна остаться хотя бы одна услуга']);
    }

    foreach (array_slice((array) ($in['reviews'] ?? []), 0, 100) as $i => $rv) {
        $text = str_clean($rv['text'] ?? '', 1200);
        $name = str_clean($rv['name'] ?? '', 80);
        if ($text === '' || $name === '') {
            continue;
        }
        $content['reviews'][] = [
            'id'      => preg_replace('/[^a-z0-9-]/', '', (string) ($rv['id'] ?? '')) ?: 'r' . bin2hex(random_bytes(3)),
            'name'    => $name,
            'car'     => str_clean($rv['car'] ?? '', 80),
            'rating'  => max(1, min(5, (int) ($rv['rating'] ?? 5))),
            'date'    => str_clean($rv['date'] ?? '', 40),
            'service' => str_clean($rv['service'] ?? '', 40),
            'text'    => $text,
            'hidden'  => !empty($rv['hidden']),
        ];
    }

    // Резервная копия предыдущей версии (храним 20 последних)
    $backups = aq_storage() . '/backups';
    if (!is_dir($backups)) {
        @mkdir($backups, 0750, true);
    }
    if (is_file(AQ_CONTENT)) {
        @copy(AQ_CONTENT, $backups . '/content-' . date('Ymd-His') . '.json');
        $list = glob($backups . '/content-*.json') ?: [];
        sort($list);
        foreach (array_slice($list, 0, max(0, count($list) - 20)) as $oldFile) {
            @unlink($oldFile);
        }
    }

    if (!aq_write_json(AQ_CONTENT, $content)) {
        aq_json(500, ['ok' => false, 'error' => 'Не удалось записать data/content.json — проверьте права на папку data']);
    }
    aq_json(200, ['ok' => true, 'content' => $content]);
}

/* ---------- Загрузка фото ---------- */

if ($action === 'upload' && $method === 'POST') {
    $f = $_FILES['file'] ?? null;
    if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) {
        aq_json(400, ['ok' => false, 'error' => 'Файл не получен']);
    }
    if ($f['size'] > 6 * 1024 * 1024) {
        aq_json(413, ['ok' => false, 'error' => 'Файл больше 6 МБ']);
    }
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) {
        aq_json(415, ['ok' => false, 'error' => 'Нужна картинка JPG, PNG или WebP']);
    }
    $dir = AQ_ROOT . '/assets/img/uploads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    $name = date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.' . $types[$info[2]];
    if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) {
        aq_json(500, ['ok' => false, 'error' => 'Не удалось сохранить файл — проверьте права на assets/img/uploads']);
    }
    aq_json(200, ['ok' => true, 'path' => 'assets/img/uploads/' . $name]);
}

/* ---------- Заявки ---------- */

if ($action === 'bookings' && $method === 'GET') {
    $list = array_map(function ($b) {
        unset($b['_file'], $b['user_agent']);
        return $b;
    }, aq_bookings_load());
    aq_json(200, ['ok' => true, 'bookings' => $list, 'telegramReady' => aq_bot_ready()]);
}

if ($action === 'booking_update' && $method === 'POST') {
    $in = body();
    $patch = [];
    if (isset($in['status'])) {
        if (!in_array($in['status'], STATUSES, true)) {
            aq_json(422, ['ok' => false, 'error' => 'Неизвестный статус']);
        }
        $patch['status'] = $in['status'];
    }
    if (isset($in['note'])) {
        $patch['note'] = str_clean($in['note'], 500);
    }
    $ok = aq_booking_update(str_clean($in['id'] ?? '', 40), $patch);
    aq_json($ok ? 200 : 404, ['ok' => $ok]);
}

if ($action === 'booking_delete' && $method === 'POST') {
    $ok = aq_booking_update(str_clean(body()['id'] ?? '', 40), null);
    aq_json($ok ? 200 : 404, ['ok' => $ok]);
}

if ($action === 'bookings_csv' && $method === 'GET') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="aquacar-bookings-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM, чтобы Excel понял кириллицу
    fputcsv($out, ['Создана', 'Статус', 'Имя', 'Телефон', 'Услуга', 'Дата', 'Время', 'Комментарий', 'Заметка'], ';');
    foreach (aq_bookings_load() as $b) {
        // Защита от формул в Excel: значения, начинающиеся с = + - @, экранируем
        $row = array_map(fn($v) => preg_match('/^([=\-@\t\r]|\+(?!\d))/', (string) $v) ? "'" . $v : (string) $v, [
            $b['created_at'] ?? '', $b['status'] ?? '', $b['name'] ?? '', $b['phone'] ?? '', $b['service'] ?? '',
            $b['date'] ?? '', $b['time'] ?? '', $b['comment'] ?? '', $b['note'] ?? '',
        ]);
        fputcsv($out, $row, ';');
    }
    exit;
}

/* ---------- Telegram ---------- */

if ($action === 'settings' && $method === 'GET') {
    $cfg = aq_config();
    $token = (string) ($cfg['bot_token'] ?? '');
    $has = $token !== '' && !str_starts_with($token, 'PASTE');
    aq_json(200, [
        'ok'        => true,
        'hasToken'  => $has,
        'tokenHint' => $has ? substr($token, 0, 6) . '…' . substr($token, -4) : '',
        'chatIds'   => array_values((array) ($cfg['chat_ids'] ?? [])),
    ]);
}

if ($action === 'settings_save' && $method === 'POST') {
    $in = body();
    $file = aq_storage() . '/settings.json';
    $saved = aq_read_json($file, []);
    $token = trim((string) ($in['bot_token'] ?? ''));
    if ($token !== '') {
        if (!preg_match('/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/', $token)) {
            aq_json(422, ['ok' => false, 'error' => 'Токен похож на неправильный. Формат: 123456789:AA…']);
        }
        $saved['bot_token'] = $token;
    }
    $ids = array_values(array_filter(array_map(
        fn($x) => preg_replace('/[^0-9-]/', '', (string) $x),
        (array) ($in['chat_ids'] ?? [])
    )));
    $saved['chat_ids'] = array_slice($ids, 0, 10);
    if (!aq_write_json($file, $saved)) {
        aq_json(500, ['ok' => false, 'error' => 'Не удалось сохранить настройки']);
    }
    aq_json(200, ['ok' => true]);
}

if ($action === 'telegram_test' && $method === 'POST') {
    if (!aq_bot_ready()) {
        aq_json(422, ['ok' => false, 'error' => 'Сначала укажите токен бота и chat_id']);
    }
    $n = aq_telegram_send("✅ <b>AQUACAR</b>: тестовое сообщение из админ-панели.\nЗаявки с сайта будут приходить сюда.");
    aq_json($n ? 200 : 502, ['ok' => $n > 0, 'delivered' => $n, 'error' => $n ? null : 'Telegram не принял сообщение. Проверьте токен, chat_id и что вы написали боту /start']);
}

/* ---------- Пароль ---------- */

if ($action === 'password' && $method === 'POST') {
    $in = body();
    $acc = admin_account();
    if (!password_verify((string) ($in['current'] ?? ''), (string) $acc['hash'])) {
        aq_json(403, ['ok' => false, 'error' => 'Текущий пароль неверный']);
    }
    $login = str_clean($in['login'] ?? $acc['login'], 64);
    $pass = (string) ($in['password'] ?? '');
    if (!preg_match('/^[A-Za-z0-9_.@-]{3,64}$/', $login)) {
        aq_json(422, ['ok' => false, 'error' => 'Логин: 3–64 символа, латиница, цифры, _ . @ -']);
    }
    if (mb_strlen($pass) < 8) {
        aq_json(422, ['ok' => false, 'error' => 'Пароль — не короче 8 символов']);
    }
    $acc = ['login' => $login, 'hash' => password_hash($pass, PASSWORD_DEFAULT), 'default' => false];
    aq_write_json(aq_storage() . '/admin.json', $acc);
    $_SESSION['login'] = $login;
    aq_json(200, ['ok' => true]);
}

aq_json(404, ['ok' => false, 'error' => 'Неизвестное действие']);
