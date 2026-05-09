// Vercel Serverless / Cron — promotes partner_pending → partner_approved
// after the 30-day hold period (so the partner can withdraw the money).
//
// Auth: x-vercel-cron header (auto by Vercel cron) OR x-service-key.
//
// Trigger: vercel.json cron, daily.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const HOLD_DAYS    = 30;

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function dbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  if (!r.ok) throw new Error(`dbGet ${path}: ${r.status}`);
  return r.json();
}

// Insert with on_conflict to dedup — same dedupe_key+type+telegram_id
// никогда не создастся дважды (защита от повторного approve того же hold-а).
async function tryInsertApprovedLog(telegram_id, amount, description, dedupe_key) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bonus_logs?on_conflict=telegram_id,type,dedupe_key`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation,resolution=ignore-duplicates' }),
    body: JSON.stringify({
      telegram_id,
      type: 'partner_approved',
      amount,
      description,
      dedupe_key,
    }),
  });
  if (!r.ok) throw new Error(`approved log insert: ${r.status} ${await r.text().catch(() => '')}`);
  const inserted = await r.json().catch(() => []);
  return Array.isArray(inserted) && inserted.length > 0;
}

async function bumpPartnerBalance(telegram_id, amount) {
  // Read-modify-write — нет атомарного inc, но защищены dedup-ом выше.
  const userArr = await dbGet(`users?telegram_id=eq.${telegram_id}&select=partner_balance`);
  const current = (userArr?.[0]?.partner_balance) ?? 0;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/users?telegram_id=eq.${telegram_id}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ partner_balance: current + amount }),
  });
  if (!r.ok) throw new Error(`bump balance: ${r.status} ${await r.text().catch(() => '')}`);
}

export default async function handler(req, res) {
  // Auth: разрешаем только Vercel cron header или явный service-key
  const isCron = !!req.headers['x-vercel-cron'];
  const serviceKeyHeader = req.headers['x-service-key'];
  const isServiceCall = SERVICE_KEY && serviceKeyHeader === SERVICE_KEY;

  if (!isCron && !isServiceCall) {
    res.status(401).json({ error: 'unauthorized — cron or service key required' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'env not configured' });
    return;
  }

  const cutoffISO = new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Найти все partner_pending старше HOLD_DAYS
    const pending = await dbGet(
      `bonus_logs?type=eq.partner_pending&created_at=lt.${cutoffISO}&select=telegram_id,amount,description,dedupe_key,created_at`
    );

    if (!Array.isArray(pending) || pending.length === 0) {
      console.log('[partner-holds] no pending entries to approve');
      res.status(200).json({ ok: true, processed: 0, cutoff: cutoffISO });
      return;
    }

    let approved = 0;
    let skipped = 0;
    const errors = [];

    for (const p of pending) {
      try {
        const inserted = await tryInsertApprovedLog(
          p.telegram_id,
          p.amount,
          `Approved: ${p.description}`,
          p.dedupe_key,
        );
        if (!inserted) {
          // Уже approved (dedupe_key conflict) — пропускаем без ошибки.
          skipped++;
          continue;
        }
        await bumpPartnerBalance(p.telegram_id, p.amount);
        approved++;
      } catch (e) {
        errors.push({ dedupe_key: p.dedupe_key, error: String(e?.message ?? e) });
      }
    }

    console.log(`[partner-holds] processed=${pending.length} approved=${approved} skipped=${skipped} errors=${errors.length}`);
    res.status(200).json({
      ok: true,
      cutoff: cutoffISO,
      total: pending.length,
      approved,
      skipped,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error('[partner-holds] error:', err?.message ?? err);
    res.status(500).json({ error: String(err?.message ?? err) });
  }
}
