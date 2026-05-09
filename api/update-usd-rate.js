// Cron job — daily housekeeping. Делает 2 задачи:
// 1. Обновляет курс USD → RUB из API ЦБ РФ → app_settings.usd_rate_rub
// 2. Промоутит partner_pending → partner_approved через 30-дневный hold
//    (часть партнёрской программы — подробности в supabase/017_*.sql)
//
// Объединено в одну функцию из-за лимита Vercel Hobby: 12 Serverless
// Functions max. Раньше partner-holds был отдельным файлом, но это
// 13-я функция → build fail. Логически это разные задачи, но обе
// daily-cron с service-key auth — переиспользуем одну точку входа.
//
// Триггер из vercel.json: cron 0 6 * * * (каждый день в 6:00 UTC = 9:00 МСК).
// Авторизация: либо x-vercel-cron header, либо x-service-key.

const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';
const HOLD_DAYS = 30;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// ─── Task 1: USD → RUB rate ────────────────────────────────────────────────
async function updateUsdRate() {
  const r = await fetch(CBR_URL, { headers: { 'Cache-Control': 'no-cache' } });
  if (!r.ok) throw new Error(`CBR returned HTTP ${r.status}`);
  const data = await r.json();
  const usdRub = Number(data?.Valute?.USD?.Value);
  if (!Number.isFinite(usdRub) || usdRub <= 0) {
    throw new Error(`Invalid USD rate from CBR: ${usdRub}`);
  }
  const rounded = Math.round(usdRub * 100) / 100;
  const upd = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ usd_rate_rub: rounded, usd_rate_updated_at: new Date().toISOString() }),
  });
  if (!upd.ok) {
    const txt = await upd.text().catch(() => '');
    return { ok: false, rate: rounded, warn: 'app_settings update failed', details: txt };
  }
  return { ok: true, rate: rounded };
}

// ─── Task 2: partner_pending → partner_approved (после 30-дневного hold) ───
async function processPartnerHolds() {
  const cutoffISO = new Date(Date.now() - HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const pendingResp = await fetch(
    `${SUPABASE_URL}/rest/v1/bonus_logs?type=eq.partner_pending&created_at=lt.${cutoffISO}&select=telegram_id,amount,description,dedupe_key,created_at`,
    { headers: sbHeaders() },
  );
  if (!pendingResp.ok) throw new Error(`fetch pending: ${pendingResp.status}`);
  const pending = await pendingResp.json();
  if (!Array.isArray(pending) || pending.length === 0) {
    return { processed: 0 };
  }

  let approved = 0;
  let skipped = 0;
  const errors = [];

  for (const p of pending) {
    try {
      // Канонический dedupe_key: убираем "<bonus_type>:" префикс который
      // grant-bonus.js добавил при insert pending. Без strip получится
      // dedupe_key="partner_pending:partner_visa_<id>" на partner_approved
      // логе — семантически кривовато, хотя unique constraint работает по
      // (type, dedupe_key) и тип разный.
      const canonicalKey = (p.dedupe_key ?? '').replace(/^partner_[a-z]+:/, '');

      // Insert approved log (idempotent via unique constraint on
      // (telegram_id, type, dedupe_key)).
      const insR = await fetch(
        `${SUPABASE_URL}/rest/v1/bonus_logs?on_conflict=telegram_id,type,dedupe_key`,
        {
          method: 'POST',
          headers: sbHeaders({ Prefer: 'return=representation,resolution=ignore-duplicates' }),
          body: JSON.stringify({
            telegram_id: p.telegram_id,
            type: 'partner_approved',
            amount: p.amount,
            description: `Approved: ${p.description}`,
            dedupe_key: canonicalKey,
          }),
        },
      );
      if (!insR.ok) {
        errors.push({ dedupe_key: canonicalKey, error: `insert ${insR.status}` });
        continue;
      }
      const inserted = await insR.json().catch(() => []);
      const wasNew = Array.isArray(inserted) && inserted.length > 0;
      if (!wasNew) { skipped++; continue; }

      // Атомарный inc partner_balance через RPC (миграция 020).
      // Защита от race condition с admin payout.
      const bumpR = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/inc_partner_balance`,
        {
          method: 'POST',
          headers: sbHeaders(),
          body: JSON.stringify({ p_telegram_id: p.telegram_id, p_delta: p.amount }),
        },
      );
      if (!bumpR.ok) {
        errors.push({ dedupe_key: canonicalKey, error: `bump balance ${bumpR.status}` });
        continue;
      }

      // Апдейтим partner_commission_status у источника (для hotel/flight bookings).
      // У applications такой колонки нет — пропускаем визы.
      const sourceMatch = canonicalKey.match(/^partner_(hotel_bookings|flight_bookings)_(.+)$/);
      if (sourceMatch) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/${sourceMatch[1]}?id=eq.${sourceMatch[2]}`,
          {
            method: 'PATCH',
            headers: sbHeaders({ Prefer: 'return=minimal' }),
            body: JSON.stringify({
              partner_commission_status: 'approved',
              partner_commission_approved_at: new Date().toISOString(),
            }),
          },
        ).catch(e => console.warn('[partner-holds] booking status update failed:', e?.message ?? e));
      }
      approved++;

      // Push-уведомление партнёру: «+X₽ доступно к выплате» (best-effort).
      // Используем service-key чтобы notify-status позволил отправить любому.
      try {
        const appUrl = process.env.TELEGRAM_APP_URL ?? process.env.TELEGRAM_MINI_APP_URL ?? '';
        if (appUrl) {
          await fetch(`${appUrl.replace(/\/$/, '')}/api/notify-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': SERVICE_KEY,
            },
            body: JSON.stringify({
              telegram_id: p.telegram_id,
              status: 'partner_hold_approved',
              amount: p.amount,
              application_id: `partner_notify_approved_${p.dedupe_key}`,
            }),
          });
        }
      } catch (e) {
        console.warn('[partner-holds] notify error (non-fatal):', e?.message ?? e);
      }
    } catch (e) {
      errors.push({ dedupe_key: p.dedupe_key, error: String(e?.message ?? e) });
    }
  }

  return {
    cutoff: cutoffISO,
    total: pending.length,
    approved,
    skipped,
    errors: errors.slice(0, 10),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Auth: либо Vercel cron header, либо x-service-key
  const isCron = !!req.headers['x-vercel-cron'];
  const hasServiceKey = SERVICE_KEY && req.headers['x-service-key'] === SERVICE_KEY;
  if (!isCron && !hasServiceKey) {
    res.status(401).json({ error: 'unauthorized — only cron or service key' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'supabase not configured' });
    return;
  }

  // Запускаем обе задачи параллельно — они независимы. Если одна упадёт,
  // другая всё равно выполнится. Возвращаем сводку по обеим.
  const [usdResult, holdsResult] = await Promise.allSettled([
    updateUsdRate(),
    processPartnerHolds(),
  ]);

  const usd = usdResult.status === 'fulfilled'
    ? usdResult.value
    : { ok: false, error: String(usdResult.reason?.message ?? usdResult.reason) };
  const holds = holdsResult.status === 'fulfilled'
    ? holdsResult.value
    : { error: String(holdsResult.reason?.message ?? holdsResult.reason) };

  console.log('[daily-cron]', JSON.stringify({ usd, holds }));
  res.status(200).json({ ok: true, usd, holds });
}
