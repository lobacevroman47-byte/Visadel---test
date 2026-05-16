// Vercel Serverless Function — proxy to Travelpayouts (Aviasales) data API.
// One function, dispatched by ?action=… (kept single-file to respect Vercel's
// free-plan limit of 12 serverless functions per project).
//
// Public docs: https://support.travelpayouts.com/hc/en-us/categories/200358578
//
// Supported actions:
//   GET ?action=places&term=<q>&locale=ru
//   GET ?action=pricesForDates&origin=MOW&destination=IST&departure_at=2026-06-15&return_at=2026-06-22&currency=rub&direct=false&one_way=false
//   GET ?action=groupedPrices&origin=MOW&destination=BKK&group_by=departure_at&currency=rub
//
// Env:
//   TRAVELPAYOUTS_API_TOKEN — обязательный для pricesForDates / groupedPrices
//                             (хранится только на сервере, в бандл клиента не попадает)

import { setCors } from './_lib/cors.js';
import { rateLimitByIp } from './_lib/rate-limit.js';

const TP_BASE   = 'https://api.travelpayouts.com';
const PLACES    = 'https://autocomplete.travelpayouts.com/places2';
const TOKEN     = process.env.TRAVELPAYOUTS_API_TOKEN || '';

const ACTIONS = {
  places: {
    base: PLACES,
    path: '',
    forwardParams: ['term', 'locale', 'types'],
    needsToken: false,
  },
  pricesForDates: {
    base: TP_BASE,
    path: '/aviasales/v3/prices_for_dates',
    forwardParams: ['origin', 'destination', 'departure_at', 'return_at',
                    'currency', 'direct', 'one_way', 'sorting', 'unique', 'limit', 'page'],
    needsToken: true,
  },
  groupedPrices: {
    base: TP_BASE,
    path: '/aviasales/v3/grouped_prices',
    forwardParams: ['origin', 'destination', 'group_by', 'departure_at', 'return_at',
                    'currency', 'direct', 'market', 'trip_class'],
    needsToken: true,
  },
};

function buildQueryString(params, allowed) {
  const out = new URLSearchParams();
  for (const key of allowed) {
    const val = params[key];
    if (val === undefined || val === null || val === '') continue;
    if (Array.isArray(val)) {
      for (const v of val) out.append(key + '[]', String(v));
    } else {
      out.append(key, String(val));
    }
  }
  return out.toString();
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'method not allowed' }); return; }

  // Rate-limit: 60/мин на IP. Travelpayouts сам платит за запросы — защита
  // от runaway autocomplete (places action), и от cost amplification.
  if (rateLimitByIp(req, { bucket: 'travelpayouts', max: 60, windowMs: 60_000 })) {
    res.status(429).json({ error: 'rate limit exceeded' });
    return;
  }

  const { action } = req.query || {};
  const cfg = ACTIONS[action];
  if (!cfg) { res.status(400).json({ error: `unknown action: ${action || '<empty>'}` }); return; }
  if (cfg.needsToken && !TOKEN) {
    res.status(500).json({ error: 'TRAVELPAYOUTS_API_TOKEN is not configured on the server' });
    return;
  }

  const qs = buildQueryString(req.query, cfg.forwardParams);
  const url = cfg.base + cfg.path + (qs ? '?' + qs : '');

  const headers = { Accept: 'application/json' };
  if (cfg.needsToken) headers['X-Access-Token'] = TOKEN;

  try {
    const upstream = await fetch(url, { headers });
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    // Cache cheap-fare lookups briefly to spare the upstream
    if (action === 'pricesForDates' || action === 'groupedPrices') {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    } else if (action === 'places') {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    }
    res.send(text);
  } catch (err) {
    console.error('[travelpayouts] proxy error', err);
    res.status(502).json({ error: 'upstream fetch failed', message: String(err?.message || err) });
  }
}
