#!/usr/bin/env node
// supabase/scripts/cleanup_storage.mjs
//
// ⚠️ DESTRUCTIVE — стирает ВСЕ файлы в bucket'е visadel-files.
// Парный скрипт к cleanup_user_data.sql.
//
// Структура (текущая, по 003_storage_rls.sql):
//   <telegram_id>/<folder>/<filename>   — основная (5697891657/photos/..., 123456789/payments/...)
//   shared/<folder>/<filename>          — анон (если попадал)
//   <folder>/<filename>                 — legacy от старой версии до telegram_id-префикса
//
// Скрипт обходит дерево рекурсивно и сносит всё что найдёт. Без необходимости
// править список папок руками — подходит и для legacy, и для новых telegram_id-папок.
//
// Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node supabase/scripts/cleanup_storage.mjs
//
// Или с .env:
//   node --env-file=.env supabase/scripts/cleanup_storage.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Нужны env vars: SUPABASE_URL и SUPABASE_SERVICE_KEY');
  console.error('   (anon-key не подходит — он не может удалять в приватных бакетах)');
  process.exit(1);
}

const BUCKET = 'visadel-files';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Рекурсивный листинг: возвращает массив путей всех файлов под `prefix`.
// Supabase Storage API возвращает либо файлы (с .id), либо «папки» (без .id) —
// последние нужно листать ещё раз.
async function listAllFiles(prefix) {
  const files = [];
  const stack = [prefix];

  while (stack.length > 0) {
    const dir = stack.pop();
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase.storage.from(BUCKET).list(dir, {
        limit, offset, sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`list ${dir}: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const obj of data) {
        const fullPath = dir ? `${dir}/${obj.name}` : obj.name;
        // Папка: id == null (Supabase quirk). Файл: id == uuid.
        if (obj.id === null || obj.id === undefined) {
          stack.push(fullPath);
        } else {
          files.push(fullPath);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  return files;
}

async function deleteBatch(paths) {
  if (paths.length === 0) return 0;
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw new Error(`remove batch: ${error.message}`);
  return data?.length ?? paths.length;
}

(async () => {
  console.log(`🪣 Bucket: ${BUCKET}`);
  console.log('🔎 Recursively listing all files...');

  const files = await listAllFiles('');
  console.log(`   found ${files.length} files`);

  if (files.length === 0) {
    console.log('✅ Bucket is already empty');
    return;
  }

  // Сэмпл первых 10 файлов чтобы убедиться что мы там где надо
  console.log('   sample paths:');
  files.slice(0, 10).forEach(p => console.log(`     ${p}`));
  if (files.length > 10) console.log(`     ... +${files.length - 10} more`);

  // Удаляем батчами по 1000 (лимит Supabase Storage API)
  console.log('🗑️  Deleting...');
  let deleted = 0;
  for (let i = 0; i < files.length; i += 1000) {
    const chunk = files.slice(i, i + 1000);
    deleted += await deleteBatch(chunk);
    process.stdout.write(`   ${deleted}/${files.length}\r`);
  }
  console.log(`\n✅ Done — deleted ${deleted} files`);
})().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
