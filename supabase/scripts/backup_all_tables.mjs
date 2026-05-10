// Bэкап всех пользовательских таблиц перед запуском cleanup_user_data.sql.
// Каждая таблица сохраняется отдельным JSON в backup-<YYYY-MM-DD>/<table>.json.
//
// Использование:
//   SUPABASE_SERVICE_KEY="xxx" node supabase/scripts/backup_all_tables.mjs
//
// Где взять service key:
//   Vercel Dashboard → Project (visadel-test) → Settings → Environment Variables
//   → SUPABASE_SERVICE_KEY → Show value → копировать.
//
// SUPABASE_URL читается из .env через dotenv (VITE_SUPABASE_URL).

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Простейший .env loader — без зависимости от dotenv пакета
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const envPath = resolve(repoRoot, '../.env'); // .env лежит в "VISADEL AGENCY (Community)/.env"

let supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
if (!supabaseUrl && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^VITE_SUPABASE_URL=(.+)$/);
    if (m) { supabaseUrl = m[1].trim().replace(/^["']|["']$/g, ''); break; }
  }
}

const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('❌ SUPABASE_URL не найден (искал в env и в .env)');
  process.exit(1);
}
if (!serviceKey) {
  console.error('❌ SUPABASE_SERVICE_KEY не передан');
  console.error('   Запусти так:');
  console.error('   SUPABASE_SERVICE_KEY="<твой-ключ>" node supabase/scripts/backup_all_tables.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Все user-data таблицы. Каталоги (visa_products, visa_form_fields, etc) и
// admin_users не бэкапим — они не очищаются скриптом cleanup_user_data.sql.
const TABLES = [
  'users',
  'applications',
  'hotel_bookings',
  'flight_bookings',
  'bonus_logs',
  'status_log',
  'booking_status_log',
  'partner_payouts',
  'partner_applications',
  'partner_settings',
  'referral_clicks',
  'reviews',
  'reminders',
  'notification_dedup',
  'admin_audit_log',
  'tasks',
];

const date = new Date().toISOString().slice(0, 10);
const dir = resolve(repoRoot, `backup-${date}`);
mkdirSync(dir, { recursive: true });
console.log(`📦 Backup → ${dir}\n`);

let totalRows = 0;
let failedTables = 0;

for (const table of TABLES) {
  process.stdout.write(`  ${table.padEnd(24)} ... `);
  try {
    // Page через range — на случай если таблица > 1000 строк (Supabase default limit)
    const all = [];
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    writeFileSync(
      resolve(dir, `${table}.json`),
      JSON.stringify(all, null, 2),
    );
    console.log(`✓ ${all.length} rows`);
    totalRows += all.length;
  } catch (e) {
    console.log(`✗ ${e?.message ?? e}`);
    failedTables++;
  }
}

console.log(`\n📊 Итого: ${totalRows} строк в ${TABLES.length - failedTables}/${TABLES.length} таблиц`);
if (failedTables > 0) {
  console.error(`⚠️  ${failedTables} таблиц не удалось забэкапить — НЕ ЗАПУСКАЙ cleanup пока не разберёшься`);
  process.exit(1);
}
console.log(`\n✅ Бэкап готов. Файлы в: ${dir}`);
console.log(`   Если что-то пойдёт не так после cleanup — данные можно восстановить из этих JSON.`);
