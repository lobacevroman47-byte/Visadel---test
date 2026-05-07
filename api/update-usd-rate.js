// Cron job — обновляет курс USD → RUB из API ЦБ РФ.
// Записывает в app_settings.usd_rate_rub (та же запись с id=1).
//
// Триггер из vercel.json: cron 0 6 * * * (каждый день в 6:00 UTC = 9:00 МСК).
// Чтобы предотвратить хук от посторонних — поддерживаем X-Service-Key либо
// Vercel-cron-secret (Vercel автоматически шлёт его на cron-запросы).

const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Простая авторизация: либо Vercel cron, либо явный X-Service-Key
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

  try {
    // ЦБ возвращает Valute.USD.Value — это сколько RUB за 1 USD
    const r = await fetch(CBR_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) throw new Error(`CBR returned HTTP ${r.status}`);
    const data = await r.json();
    const usdRub = Number(data?.Valute?.USD?.Value);
    if (!Number.isFinite(usdRub) || usdRub <= 0) {
      throw new Error(`Invalid USD rate from CBR: ${usdRub}`);
    }

    // Округляем до 2 знаков и записываем в app_settings (singleton, id=1)
    const rounded = Math.round(usdRub * 100) / 100;
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ usd_rate_rub: rounded, usd_rate_updated_at: new Date().toISOString() }),
    });
    if (!upd.ok) {
      const txt = await upd.text();
      // Если колонок нет — мягко игнорируем (миграция ещё не применена), но
      // покажем хинт что нужно сделать.
      res.status(200).json({
        ok: false,
        rate: rounded,
        warn: 'app_settings update failed — добавь колонки usd_rate_rub NUMERIC и usd_rate_updated_at TIMESTAMPTZ',
        details: txt,
      });
      return;
    }
    console.log('[update-usd-rate] CBR → app_settings:', rounded);
    res.status(200).json({ ok: true, rate: rounded, source: 'cbr-xml-daily.ru' });
  } catch (e) {
    console.error('[update-usd-rate] error:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
