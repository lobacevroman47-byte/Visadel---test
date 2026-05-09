#!/usr/bin/env node
// supabase/scripts/cleanup_storage.mjs
//
// ⚠️ DESTRUCTIVE — стирает все файлы в bucket'е visadel-files (папки
// photos/, payments/, visas/). Парный скрипт к cleanup_user_data.sql.
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
  process.exit(1);
}

const BUCKET = 'visadel-files';
const FOLDERS = ['photos', 'payments', 'visas'];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function listAll(folder) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
      limit, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data.map(o => `${folder}/${o.name}`));
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function deleteBatch(paths) {
  if (paths.length === 0) return 0;
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
  return data?.length ?? paths.length;
}

(async () => {
  console.log(`🪣 Bucket: ${BUCKET}`);
  let totalDeleted = 0;

  for (const folder of FOLDERS) {
    process.stdout.write(`  📁 ${folder}/ ... listing ... `);
    const files = await listAll(folder);
    process.stdout.write(`${files.length} files. `);

    if (files.length === 0) {
      console.log('skip');
      continue;
    }

    // Удаляем батчами по 1000 (лимит Supabase Storage API)
    let deleted = 0;
    for (let i = 0; i < files.length; i += 1000) {
      const chunk = files.slice(i, i + 1000);
      deleted += await deleteBatch(chunk);
    }
    console.log(`deleted ${deleted}`);
    totalDeleted += deleted;
  }

  console.log(`\n✅ Done — total deleted: ${totalDeleted} files`);
})().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
