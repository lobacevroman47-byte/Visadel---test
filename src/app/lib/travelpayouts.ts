// Typed client for our Travelpayouts proxy at /api/travelpayouts.
// Plus the Aviasales partner-link builder that injects our marker for attribution.

// Public partner ID (marker). Safe to ship to the client — it's just a tracking
// identifier appended to outbound Aviasales URLs, exactly like a UTM tag.
export const TP_MARKER = '725259';

// ─── Place search (autocomplete) ──────────────────────────────────────────────

export interface TpPlace {
  type: 'city' | 'airport';
  code: string;            // IATA: 'MOW', 'SVO'
  name: string;            // Москва / Шереметьево
  country_code: string;    // 'RU'
  country_name: string;
  city_code?: string;      // For airports: parent city code
  city_name?: string;
  weight: number;
}

// ─── Flight prices ────────────────────────────────────────────────────────────

export interface TpFare {
  origin: string;             // city IATA, e.g. MOW
  destination: string;        // city IATA, e.g. IST
  origin_airport: string;     // specific airport, e.g. SVO
  destination_airport: string;
  airline: string;            // 2-letter carrier code
  flight_number: string;
  departure_at: string;       // ISO 8601 with timezone
  return_at?: string;
  price: number;              // в выбранной валюте
  duration: number;           // total minutes (round-trip if applicable)
  duration_to?: number;
  duration_back?: number;
  transfers: number;
  return_transfers?: number;
  link: string;               // relative path on aviasales.com starting with /search/...
  gate?: string;
}

export interface TpPricesResponse {
  data: TpFare[];
  currency?: string;
}

const ENDPOINT = '/api/travelpayouts';

async function request<T>(action: string, query: Record<string, string | string[] | number | boolean | undefined> = {}): Promise<T> {
  const params = new URLSearchParams({ action });
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => params.append(k + '[]', String(x)));
    else params.append(k, String(v));
  }
  const res = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Travelpayouts ${action} failed: ${res.status} ${text.slice(0, 240)}`);
  }
  return res.json() as Promise<T>;
}

export const tp = {
  searchPlaces: (term: string, locale = 'ru') =>
    request<TpPlace[]>('places', { term, locale, types: ['city', 'airport'] }),

  getPricesForDates: (q: {
    origin: string;
    destination: string;
    departure_at?: string;        // YYYY-MM-DD or YYYY-MM
    return_at?: string;
    currency?: 'rub' | 'usd' | 'eur';
    direct?: boolean;
    one_way?: boolean;
    sorting?: 'price' | 'route';
    unique?: boolean;
    limit?: number;
  }) => request<TpPricesResponse>('pricesForDates', { ...q, sorting: q.sorting ?? 'price', currency: q.currency ?? 'rub' }),

  getGroupedPrices: (q: {
    origin: string;
    destination: string;
    group_by?: 'departure_at' | 'price';
    currency?: 'rub' | 'usd' | 'eur';
    direct?: boolean;
  }) => request<{ data: Record<string, TpFare> }>('groupedPrices', { ...q, group_by: q.group_by ?? 'departure_at', currency: q.currency ?? 'rub' }),
};

// ─── Aviasales link builder ───────────────────────────────────────────────────

/**
 * Build the public Aviasales URL we open via tg.openLink.
 * Two flavours:
 *   1) Full Aviasales internal `link` (returned by prices_for_dates) —
 *      that path already encodes the exact fare; we just prefix the host
 *      and append our marker so the booking is attributed to us.
 *   2) Plain search URL when we don't have an internal link yet
 *      (e.g. when the user picks dates that aren't in the price cache).
 */
export function buildAviasalesUrl(opts:
  | { fareLink: string }
  | {
      origin: string;
      destination: string;
      departureDate: string;       // YYYY-MM-DD
      returnDate?: string;
      adults?: number;
    }
): string {
  if ('fareLink' in opts) {
    const sep = opts.fareLink.includes('?') ? '&' : '?';
    return `https://aviasales.com${opts.fareLink}${sep}marker=${TP_MARKER}`;
  }
  const dep = compactDate(opts.departureDate);
  const ret = opts.returnDate ? compactDate(opts.returnDate) : '';
  // Aviasales URL pattern: /search/<FROM><DDMM><TO><DDMM><PAX>
  // where PAX = adults count (1..9). Return leg is omitted for one-way trips.
  const pax = Math.max(1, Math.min(9, opts.adults ?? 1));
  const path = `/search/${opts.origin}${dep}${opts.destination}${ret}${pax}`;
  return `https://aviasales.com${path}?marker=${TP_MARKER}`;
}

// "2026-06-23" → "2306"
function compactDate(yyyyMmDd: string): string {
  const [, mm, dd] = yyyyMmDd.split('-');
  return `${dd}${mm}`;
}

// ─── Helpers used by the UI ───────────────────────────────────────────────────

const RU_CARRIERS: Record<string, string> = {
  SU: 'Аэрофлот', S7: 'S7 Airlines', U6: 'Ural Airlines', UT: 'UTair', N4: 'Nordwind',
  DP: 'Победа', WZ: 'Red Wings', FV: 'Россия', ZF: 'AZAL', HY: 'Uzbekistan Airways',
  KC: 'Air Astana', TK: 'Turkish Airlines', PC: 'Pegasus', VF: 'AJet',
  EK: 'Emirates', QR: 'Qatar Airways', EY: 'Etihad', FZ: 'flydubai', J2: 'AZAL',
  KR: 'Centrum Air', I8: 'Izhavia', '5N': 'Smartavia',
};

export function airlineName(code: string): string {
  return RU_CARRIERS[code] || code;
}

export function formatRub(n: number): string {
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
