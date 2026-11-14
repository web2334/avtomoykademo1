<?php
/**
 * AQUACAR — общие функции серверной части (PHP 8.0+).
 */
declare(strict_types=1);

date_default_timezone_set('Europe/Moscow');

const AQ_ROOT = __DIR__ . '/..';
const AQ_CONTENT = AQ_ROOT . '/data/content.json';

/** Папка для приватных данных (закрыта .htaccess). */
function aq_storage(): string
{
    $dir = __DIR__ . '/storage';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    return $dir;
}

function aq_read_json(string $file, $default = null)
{
    if (!is_file($file)) {
        return $default;
    }
    $data = json_decode((string) file_get_contents($file), true);
    return $data === null ? $default : $data;
}

/** Атомарная запись: сначала во временный файл, затем переименование. */
function aq_write_json(string $file, $data): bool
{
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        @unlink($tmp);
        return false;
    }
    return rename($tmp, $file);
}

function aq_json(int $code, array $body): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Настройки: api/config.php + то, что сохранили в админке (storage/settings.json). */
function aq_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
        $saved = aq_read_json(aq_storage() . '/settings.json', []);
        if (!empty($saved['bot_token'])) {
            $config['bot_token'] = $saved['bot_token'];
        }
        if (isset($saved['chat_ids']) && is_array($saved['chat_ids'])) {
            $config['chat_ids'] = $saved['chat_ids'];
        }
    }
    return $config;
}

function aq_bot_ready(): bool
{
    $token = (string) (aq_config()['bot_token'] ?? '');
    return $token !== '' && !str_starts_with($token, 'PASTE') && !empty(aq_config()['chat_ids']);
}

/** Отправляет сообщение во все чаты из настроек. Возвращает число доставленных. */
function aq_telegram_send(string $text): int
{
    if (!aq_bot_ready()) {
        return 0;
    }
    $token = (string) aq_config()['bot_token'];
    $delivered = 0;
    foreach ((array) aq_config()['chat_ids'] as $chatId) {
        $ch = curl_init("https://api.telegram.org/bot{$token}/sendMessage");
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode([
                'chat_id'                  => $chatId,
                'text'                     => $text,
                'parse_mode'               => 'HTML',
                'disable_web_page_preview' => true,
            ], JSON_UNESCAPED_UNICODE),
        ]);
        $result = json_decode((string) curl_exec($ch), true);
        curl_close($ch);
        if (!empty($result['ok'])) {
            $delivered++;
        } else {
            error_log('[AQUACAR] Telegram error for chat ' . $chatId . ': ' . json_encode($result, JSON_UNESCAPED_UNICODE));
        }
    }
    return $delivered;
}

/* ---------- Заявки: storage/bookings-ГГГГ-ММ.jsonl ---------- */

function aq_booking_files(): array
{
    $files = glob(aq_storage() . '/bookings-*.jsonl') ?: [];
    rsort($files);
    return $files;
}

/** Все заявки, новые сверху. У старых записей без id id вычисляется. */
function aq_bookings_load(): array
{
    $all = [];
    foreach (aq_booking_files() as $file) {
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $row = json_decode($line, true);
            if (!is_array($row)) {
                continue;
            }
            $row['id'] = $row['id'] ?? substr(md5(($row['created_at'] ?? '') . ($row['phone'] ?? '')), 0, 12);
            $row['status'] = $row['status'] ?? 'new';
            $row['_file'] = basename($file);
            $all[] = $row;
        }
    }
    usort($all, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
    return $all;
}

/** Меняет или удаляет заявку по id. $patch === null — удалить. */
function aq_booking_update(string $id, ?array $patch): bool
{
    foreach (aq_booking_files() as $file) {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
        $changed = false;
        $out = [];
        foreach ($lines as $line) {
            $row = json_decode($line, true);
            if (!is_array($row)) {
                continue;
            }
            $rowId = $row['id'] ?? substr(md5(($row['created_at'] ?? '') . ($row['phone'] ?? '')), 0, 12);
            if ($rowId === $id) {
                $changed = true;
                if ($patch === null) {
                    continue;
                }
                $row = array_merge($row, $patch, ['id' => $rowId]);
            }
            $out[] = json_encode($row, JSON_UNESCAPED_UNICODE);
        }
        if ($changed) {
            $tmp = $file . '.tmp';
            file_put_contents($tmp, $out ? implode("\n", $out) . "\n" : '', LOCK_EX);
            return rename($tmp, $file);
        }
    }
    return false;
}

function aq_client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
}
