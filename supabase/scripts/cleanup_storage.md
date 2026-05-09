# Чистка Storage после `cleanup_user_data.sql`

SQL-скрипт стирает рядки из БД, но **файлы в Storage** (паспорта, скрины
оплат, выданные визы) остаются — без сирот в БД они «оторваны»: место
занимают, но никто на них не ссылается.

Если хочется полностью чистый старт — стереть и файлы.

## Что лежит в Storage

Бакет: **`visadel-files`** (приватный, доступ через signed URLs)

Структура:
- `photos/<uuid>.jpg` — паспорта, face-фото, дополнительные фотки виз
- `payments/<uuid>.png` — скриншоты оплат
- `visas/<uuid>.pdf` — выданные админом визы (упоминаются в `applications.visa_file_url`)

## Способ 1 — Dashboard (просто, для теста)

Подходит когда файлов мало (десятки).

1. Supabase Dashboard → Storage → `visadel-files`
2. Открыть папку `photos/` → выделить все файлы (Ctrl/Cmd+A) → Delete
3. Повторить для `payments/`
4. Повторить для `visas/`
5. (Опционально) удалить сами папки если они отображаются как объекты

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
