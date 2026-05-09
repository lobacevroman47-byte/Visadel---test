# Чистка Storage после `cleanup_user_data.sql`

SQL-скрипт стирает рядки из БД, но **файлы в Storage** (паспорта, скрины
оплат, выданные визы) остаются — без сирот в БД они «оторваны»: место
занимают, но никто на них не ссылается.

Если хочется полностью чистый старт — стереть и файлы.

## Что лежит в Storage

Бакет: **`visadel-files`** (приватный, доступ через signed URLs)

Структура (по `003_storage_rls.sql`):
- `<telegram_id>/photos/<filename>` — паспорта, face-фото, доп. фотки
- `<telegram_id>/payments/<filename>` — скриншоты оплат
- `<telegram_id>/visas/<filename>` — выданные админом визы
- `shared/<folder>/<filename>` — анон-загрузки (до логина)
- `photos/<filename>`, `payments/<filename>`, `visas/<filename>` — legacy
  от старой версии до того как добавили `<telegram_id>/` префикс

То есть на root-уровне ты увидишь:
- Папки с цифрами (`5697891657`, `123456789`, ...) — это telegram_id юзеров
- Папка `shared/`
- Legacy-папки `photos/`, `payments/`, `visas/`

Все они должны быть удалены.

## Способ 1 — Dashboard (просто, для теста)

Подходит когда файлов мало (десятки).

1. Supabase Dashboard → Storage → `visadel-files`
2. На root-уровне видишь все папки (`5697891657`, `123456789`, `shared`, `photos`,
   `payments`, `visas`)
3. Выделяешь все папки сразу — кликаешь на первую, Shift+клик на последнюю →
   Delete справа сверху → подтвердить
4. Если интерфейс не даёт удалить папки сразу — заходи в каждую, Cmd+A,
   Delete, повторяешь

## Способ 2 — скриптом (быстрее, если файлов сотни)

```bash
# Установить supabase-js если нет
npm install @supabase/supabase-js

# Прогнать скрипт ниже (нужны env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY)
node supabase/scripts/cleanup_storage.mjs
```

Сам скрипт смотри в `cleanup_storage.mjs` (рядом). Берёт `SUPABASE_URL` и
`SUPABASE_SERVICE_KEY` из env, листает 3 папки, удаляет всё батчем.

## Способ 3 — пересоздать бакет (самое радикальное)

Если хочется ноль на 100%:

1. Storage → `visadel-files` → ⋮ → Delete bucket
2. Storage → New bucket → имя `visadel-files`, Public: **No**
3. Перенакатить миграцию `003_storage_rls.sql` — она заново раздаст RLS-политики на чтение/запись.

⚠️ После пересоздания бакета все ссылки в `applications.visa_file_url` и
`hotel_bookings.passport_url` / `payment_screenshot_url` будут указывать на
несуществующие файлы — что нормально, потому что мы только что и
удалили все эти строки.

## Что сделать прямо сейчас

Если нет приватных продакшен-файлов и всё это были тесты — **способ 1
(Dashboard)** в самый раз. 5 минут руками.
