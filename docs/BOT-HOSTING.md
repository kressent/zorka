# 🤖 Бот и канал 24/7 на Supabase (бесплатно, без нового хостинга)

> Переводим бота с «постоянного процесса на компе» на **webhook**: Telegram сам
> дёргает нашу Edge-функцию на каждое сообщение — always-on процесс не нужен.
> Дайджест в канал — по cron. Всё на Supabase, который у нас уже есть.

Функции готовы: `supabase/functions/telegram-bot` (ответы) и `telegram-daily` (дайджест).
Движок в них — копия нашего (`tools/bundle-push.js`).

## 1. Секреты функций (один раз)
```
supabase secrets set TELEGRAM_BOT_TOKEN=8678131897:AAHrz77nirSziE625lnQB7gnAzeSWFvXpow
supabase secrets set TELEGRAM_CHANNEL=@nakryuchke_rb
# по желанию — секрет для проверки вебхука (любая случайная строка):
supabase secrets set TELEGRAM_WEBHOOK_SECRET=любая_случайная_строка
```

## 2. Обновить движок и задеплоить функции
```
node tools/bundle-push.js
supabase functions deploy telegram-bot   --no-verify-jwt
supabase functions deploy telegram-daily --no-verify-jwt
```

## 3. Переключить бота на webhook
Один запрос (подставь секрет, если задавал; иначе убери `secret_token`):
```
curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook" \
  --data-urlencode "url=https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/telegram-bot" \
  --data-urlencode "secret_token=любая_случайная_строка"
```
Проверить: `curl https://api.telegram.org/bot<ТОКЕН>/getWebhookInfo` → должен быть наш url.

⚠️ **После включения webhook останови локальный `node bot/bot.js`** — long-polling и
webhook несовместимы (Telegram отдаёт апдейты только одному). Локальный бот больше не нужен.

## 4. Автопостинг дайджеста (cron)
Прогнать `supabase/021_telegram_cron.sql` в SQL Editor (нужны pg_cron + pg_net).
Постит в канал раз в день в 02:00 UTC (≈07:00 Уфа). Проверить вручную:
```
curl -X POST https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/telegram-daily \
  -H "Authorization: Bearer <anon/publishable key>"
```
Ответ `sent` → пост ушёл в канал.

## 5. Проверить
- Напиши боту «Нугуш» → должен ответить (уже через webhook, не с компа).
- `getWebhookInfo` не показывает ошибок (`last_error_message` пуст).

---

### Почему так
- **Бесплатно и 24/7:** функции живут на Supabase, платить за отдельный хостинг/VPS не нужно.
- **Тот же движок:** ответы бота = прогноз приложения (общий код через `bundle-push.js`).
- Если правил движок — перед деплоем повтори `node tools/bundle-push.js`.

### Если что-то не так
- Логи: Supabase → Edge Functions → telegram-bot / telegram-daily → Logs.
- Бот молчит: проверь `getWebhookInfo` (url + last_error_message), секрет токена.
- Дайджест не пришёл: бот должен быть **админом канала** с правом «Публикация сообщений».
