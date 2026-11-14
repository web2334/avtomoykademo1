<?php
/**
 * Настройки Telegram-бота для заявок.
 *
 * 1. Создайте бота у @BotFather → получите токен.
 * 2. Напишите боту /start (или добавьте его в группу менеджеров).
 * 3. Узнайте chat_id: откройте https://api.telegram.org/bot<ТОКЕН>/getUpdates
 *    и найдите "chat":{"id": ...}. У групп id отрицательный.
 *
 * Можно задать через переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_IDS (через запятую).
 */
return [
    'bot_token' => getenv('TELEGRAM_BOT_TOKEN') ?: 'PASTE_YOUR_BOT_TOKEN',

    // Куда пересылать заявки: один или несколько чатов
    'chat_ids' => array_filter(array_map('trim', explode(',', getenv('TELEGRAM_CHAT_IDS') ?: '123456789'))),

    // Дополнительные домены, с которых можно отправлять форму (свой домен разрешён всегда)
    'allowed_origins' => ['https://aquacar.ru', 'https://www.aquacar.ru'],

    // Максимум заявок с одного IP за 10 минут
    'rate_limit' => 5,

    // Где хранить заявки (сервер должен находиться в РФ). Папка закрыта от доступа из браузера.
    'storage_dir' => __DIR__ . '/storage',
];
