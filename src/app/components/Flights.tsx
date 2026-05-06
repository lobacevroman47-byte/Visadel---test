import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Loader2, Plane, ArrowRightLeft, Search, Plus, Minus, ExternalLink, RefreshCw } from 'lucide-react';
import {
  tp,
  buildAviasalesUrl,
  airlineName,
  formatRub,
  formatDuration,
  formatTime,
  formatDateShort,
  type TpFare,
  type TpPlace,
} from '../lib/travelpayouts';
import { getTelegramWebApp, haptic } from '../lib/telegram';

interface FlightsProps {
  onOpenProfile: () => void;
}

type Step = 'search' | 'results';

// Quick-pick destinations that match the visa countries the user already books.
const POPULAR: Array<{ flag: string; label: string; code: string; }> = [
  { flag: '🇹🇷', label: 'Стамбул',     code: 'IST' },
  { flag: '🇹🇭', label: 'Бангкок',     code: 'BKK' },
  { flag: '🇦🇪', label: 'Дубай',       code: 'DXB' },
  { flag: '🇪🇬', label: 'Хургада',     code: 'HRG' },
  { flag: '🇬🇪', label: 'Тбилиси',     code: 'TBS' },
  { flag: '🇮🇩', label: 'Бали',        code: 'DPS' },
  { flag: '🇱🇰', label: 'Коломбо',     code: 'CMB' },
  { flag: '🇻🇳', label: 'Нячанг',      code: 'CXR' },
];

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Brand header ─────────────────────────────────────────────────────────────

function BrandHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  return (
    <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
      <div className="px-5 pt-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight">VISADEL</span>
        </div>
        <button
          onClick={onOpenProfile}
          className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition"
          aria-label="Профиль"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── City-pick autocomplete input ─────────────────────────────────────────────

function CityInput({
  label, placeholder, value, onChange, autoFocusKey,
}: {
  label: string;
  placeholder: string;
  value: { code: string; display: string } | null;
  onChange: (v: { code: string; display: string }) => void;
  autoFocusKey?: number;
}) {
  const [term, setTerm] = useState(value?.display ?? '');
  const [items, setItems] = useState<TpPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (value && value.display !== term) setTerm(value.display);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus when caller flips the key (e.g. after swap)
  useEffect(() => {
    if (autoFocusKey === undefined) return;
    inputRef.current?.focus();
  }, [autoFocusKey]);

  // Debounced search
  useEffect(() => {
    if (!term || term.length < 2) { setItems([]); return; }
    if (value && value.display === term) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await tp.searchPlaces(term);
        setItems(res.slice(0, 10));
      } catch (e) {
        console.warn('[flights] places lookup failed', e);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click-outside collapses
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <span className="text-[10px] uppercase tracking-widest text-[#0F2A36]/55 font-bold">{label}</span>
      <input
        ref={inputRef}
        type="text"
        value={term}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
      />
      {open && (term.length >= 2) && (items.length > 0 || loading) && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-72 overflow-y-auto">
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center py-4 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {items.map((p) => (
            <button
              key={`${p.type}-${p.code}`}
              onClick={() => {
                const display = p.type === 'airport' ? `${p.city_name ?? p.name} (${p.code})` : `${p.name} (${p.code})`;
                onChange({ code: p.code, display });
                setTerm(display);
                setOpen(false);
                haptic('light');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition text-left"
            >
              <span className="text-[10px] font-bold text-[#3B5BFF] bg-blue-50 rounded px-1.5 py-0.5 w-12 text-center shrink-0">
                {p.code}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[#0F2A36] truncate">
                  {p.type === 'airport' ? `${p.city_name} · ${p.name}` : p.name}
                </div>
                <div className="text-[11px] text-[#0F2A36]/55">
                  {p.type === 'airport' ? 'Аэропорт' : 'Город'} · {p.country_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Поиск ────────────────────────────────────────────────────────────

interface SearchForm {
  origin: { code: string; display: string } | null;
  destination: { code: string; display: string } | null;
  departureDate: string;
  returnDate: string;
  oneWay: boolean;
  adults: number;
  directOnly: boolean;
}

const DEFAULT_FORM: SearchForm = {
  origin: { code: 'MOW', display: 'Москва (MOW)' },
  destination: null,
  departureDate: todayPlus(14),
  returnDate: todayPlus(21),
  oneWay: false,
  adults: 1,
  directOnly: false,
};

function SearchStep({
  initial, onSubmit,
}: {
  initial: SearchForm;
  onSubmit: (f: SearchForm) => void;
}) {
  const [f, setF] = useState<SearchForm>(initial);
  const [swapKey, setSwapKey] = useState(0);

  const set = <K extends keyof SearchForm>(k: K, v: SearchForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const swap = () => {
    setF((p) => ({ ...p, origin: p.destination, destination: p.origin }));
    setSwapKey((x) => x + 1);
    haptic('light');
  };

  const canSubmit = !!(f.origin?.code && f.destination?.code && f.departureDate &&
                       (f.oneWay || f.returnDate));

  return (
    <>
      <div className="vd-grad-soft px-5 pt-7 pb-8">
        <h1 className="text-center text-[28px] leading-[1.05] tracking-tight font-extrabold text-[#0F2A36]">
          Дешёвые
          <br />
          <span className="vd-grad-text">авиабилеты</span>
        </h1>
        <p className="text-center text-[13px] text-[#0F2A36]/65 mt-3 max-w-sm mx-auto leading-snug">
          Сравниваем цены 700+ авиакомпаний — <span className="text-[#0F2A36] font-semibold">без наценок и сборов</span>
        </p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
          <div className="grid grid-cols-1 gap-3 mb-3 relative">
            <CityInput
              label="Откуда"
              placeholder="Город или аэропорт"
              value={f.origin}
              onChange={(v) => set('origin', v)}
              autoFocusKey={swapKey}
            />
            <button
              onClick={swap}
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center shadow-sm"
              aria-label="Поменять местами"
            >
              <ArrowRightLeft className="w-4 h-4 text-[#3B5BFF]" />
            </button>
            <CityInput
              label="Куда"
              placeholder="Город или аэропорт"
              value={f.destination}
              onChange={(v) => set('destination', v)}
              autoFocusKey={swapKey}
            />
          </div>

          {!f.destination && (
            <div className="mb-3">
              <p className="text-[11px] text-[#0F2A36]/60 mb-2">Популярные направления:</p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {POPULAR.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => { set('destination', { code: p.code, display: `${p.label} (${p.code})` }); haptic('light'); }}
                    className="shrink-0 bg-gray-50 hover:bg-blue-50 rounded-xl px-3 py-2 text-[12px] flex items-center gap-1.5 transition"
                  >
                    <span>{p.flag}</span>
                    <span className="font-semibold text-[#0F2A36]">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-[#0F2A36]/55 font-bold">Туда</span>
              <input
                type="date"
                value={f.departureDate}
                min={todayPlus(0)}
                onChange={(e) => set('departureDate', e.target.value)}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-[#0F2A36]/55 font-bold">
                {f.oneWay ? 'Без обратного' : 'Обратно'}
              </span>
              <input
                type="date"
                value={f.oneWay ? '' : f.returnDate}
                min={f.departureDate || todayPlus(0)}
                disabled={f.oneWay}
                onChange={(e) => set('returnDate', e.target.value)}
                className="mt-1 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF] disabled:opacity-50"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <label className="flex items-center gap-2 text-[12px] text-[#0F2A36]/80 cursor-pointer">
              <input type="checkbox" checked={f.oneWay} onChange={(e) => set('oneWay', e.target.checked)} className="accent-[#5C7BFF]" />
              В одну сторону
            </label>
            <label className="flex items-center gap-2 text-[12px] text-[#0F2A36]/80 cursor-pointer">
              <input type="checkbox" checked={f.directOnly} onChange={(e) => set('directOnly', e.target.checked)} className="accent-[#5C7BFF]" />
              Только прямые
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#0F2A36]/80">Пассажиры</span>
              <button
                onClick={() => set('adults', Math.max(1, f.adults - 1))}
                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                aria-label="-"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-semibold w-5 text-center">{f.adults}</span>
              <button
                onClick={() => set('adults', Math.min(9, f.adults + 1))}
                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                aria-label="+"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <button
          disabled={!canSubmit}
          onClick={() => onSubmit(f)}
          className="w-full py-3.5 rounded-2xl font-bold tracking-wide vd-grad text-white vd-shadow-cta active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" /> Найти билеты
        </button>

        <p className="text-[11px] text-[#0F2A36]/45 mt-3 text-center leading-snug">
          Покупка происходит на сайте Aviasales — мы не берём комиссию,
          цены указаны напрямую от агентств и авиакомпаний.
        </p>
      </div>
    </>
  );
}

// ─── Step 2: Результаты ───────────────────────────────────────────────────────

function ResultsStep({
  form, fares, onBack, onPick, retrying, error, onRetry,
}: {
  form: SearchForm;
  fares: TpFare[];
  onBack: () => void;
  onPick: (f: TpFare) => void;
  retrying: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const sorted = useMemo(() => [...fares].sort((a, b) => a.price - b.price), [fares]);

  return (
    <div className="p-4">
      <button onClick={onBack} className="mb-4 text-[#3B5BFF] hover:text-[#4F2FE6] flex items-center gap-1 text-sm font-medium">
        ← Изменить поиск
      </button>

      <div className="vd-grad-soft rounded-2xl p-5 mb-4 border border-blue-100/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#3B5BFF] shrink-0">
            <Plane className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight text-[#0F2A36] truncate">
              {form.origin?.code} → {form.destination?.code}
            </h2>
            <p className="text-[#0F2A36]/60 text-[12px] mt-0.5">
              {formatDateShort(form.departureDate)}
              {!form.oneWay && form.returnDate ? ` – ${formatDateShort(form.returnDate)}` : ''} · {form.adults} пасс.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-3 text-sm text-red-700">
          {error}
          <button onClick={onRetry} className="ml-2 underline font-semibold inline-flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> повторить
          </button>
        </div>
      )}

      {retrying && sorted.length === 0 && (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {!retrying && !error && sorted.length === 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0F2A36] font-extrabold text-[17px] tracking-tight">
            Поищем у Aviasales напрямую
          </h3>
          <p className="text-[13px] text-[#0F2A36]/65 mt-2 leading-snug">
            Они найдут актуальные тарифы по этим датам в реальном времени — наша база
            обновляется каждые несколько часов, у Aviasales — каждую секунду.
          </p>
          <button
            onClick={() => {
              const url = buildAviasalesUrl({
                origin: form.origin!.code,
                destination: form.destination!.code,
                departureDate: form.departureDate,
                returnDate: form.oneWay ? undefined : form.returnDate,
                adults: form.adults,
              });
              const tg = getTelegramWebApp();
              if (tg && typeof tg.openLink === 'function') tg.openLink(url);
              else window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="mt-4 w-full py-3 rounded-xl vd-grad text-white font-bold text-sm vd-shadow-cta active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            <Plane className="w-4 h-4" /> Открыть Aviasales
          </button>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((f, idx) => {
          const isCheapest = idx === 0;
          const isDirect = f.transfers === 0 && (f.return_transfers ?? 0) === 0;
          return (
            <div key={`${f.airline}-${f.flight_number}-${f.departure_at}-${idx}`} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#3B5BFF] font-extrabold text-sm shrink-0">
                  {f.airline}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[#0F2A36] font-bold text-[14px] truncate">{airlineName(f.airline)}</h3>
                  <p className="text-[11px] text-[#0F2A36]/60 mt-0.5">
                    рейс {f.airline} {f.flight_number}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isCheapest && (
                    <span className="bg-[#00C853]/10 text-[#00C853] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg">
                      Дешевле
                    </span>
                  )}
                  {isDirect && (
                    <span className="bg-blue-50 text-[#3B5BFF] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg">
                      Прямой
                    </span>
                  )}
                </div>
              </div>

              {/* Outbound */}
              <div className="bg-gray-50 rounded-xl p-3 mb-2 flex items-center gap-3">
                <div className="text-center">
                  <div className="text-base font-bold text-[#0F2A36] leading-none">{formatTime(f.departure_at)}</div>
                  <div className="text-[10px] text-[#0F2A36]/55 mt-0.5">{f.origin_airport}</div>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <div className="text-[10px] text-[#0F2A36]/50">{formatDuration(f.duration_to ?? f.duration)}</div>
                  <div className="w-full h-px bg-gray-300 my-1 relative">
                    {f.transfers > 0 && (
                      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-100 text-orange-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {f.transfers} перес.
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#0F2A36]/50">{formatDateShort(f.departure_at)}</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-[#0F2A36] leading-none">
                    {f.duration_to ? formatTime(new Date(new Date(f.departure_at).getTime() + f.duration_to * 60000).toISOString()) : '—'}
                  </div>
                  <div className="text-[10px] text-[#0F2A36]/55 mt-0.5">{f.destination_airport}</div>
                </div>
              </div>

              {/* Return */}
              {f.return_at && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3 flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-base font-bold text-[#0F2A36] leading-none">{formatTime(f.return_at)}</div>
                    <div className="text-[10px] text-[#0F2A36]/55 mt-0.5">{f.destination_airport}</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="text-[10px] text-[#0F2A36]/50">{formatDuration(f.duration_back ?? 0)}</div>
                    <div className="w-full h-px bg-gray-300 my-1 relative">
                      {(f.return_transfers ?? 0) > 0 && (
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-100 text-orange-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {f.return_transfers} перес.
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#0F2A36]/50">{formatDateShort(f.return_at)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold text-[#0F2A36] leading-none">
                      {f.duration_back ? formatTime(new Date(new Date(f.return_at).getTime() + f.duration_back * 60000).toISOString()) : '—'}
                    </div>
                    <div className="text-[10px] text-[#0F2A36]/55 mt-0.5">{f.origin_airport}</div>
                  </div>
                </div>
              )}

              <div className="vd-grad-soft rounded-xl p-3 mb-3 border border-blue-100/60 flex items-end justify-between">
                <div>
                  <div className="text-[10px] text-[#0F2A36]/60 uppercase tracking-wider font-semibold">Цена за всех</div>
                  <div className="text-2xl vd-grad-text font-extrabold leading-none mt-0.5">
                    {formatRub(f.price)}
                  </div>
                </div>
                {f.gate && (
                  <div className="text-right text-[11px] text-[#0F2A36]/55 truncate max-w-[40%]">{f.gate}</div>
                )}
              </div>

              <button
                onClick={() => { haptic('medium'); onPick(f); }}
                className="w-full py-3 rounded-xl font-bold tracking-wide vd-grad text-white vd-shadow-cta active:scale-[0.98] transition text-sm flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" /> Купить за {formatRub(f.price)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Flights({ onOpenProfile }: FlightsProps) {
  const [step, setStep] = useState<Step>('search');
  const [form, setForm] = useState<SearchForm>(DEFAULT_FORM);
  const [fares, setFares] = useState<TpFare[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (f: SearchForm) => {
    if (!f.origin || !f.destination) return;
    setLoading(true);
    setError(null);
    try {
      const res = await tp.getPricesForDates({
        origin: f.origin.code,
        destination: f.destination.code,
        departure_at: f.departureDate,
        return_at: f.oneWay ? undefined : f.returnDate,
        currency: 'rub',
        direct: f.directOnly || undefined,
        one_way: f.oneWay,
        sorting: 'price',
        limit: 30,
      });
      setFares(res.data || []);
      // Empty cache is a normal outcome on rare routes — let the empty-state
      // card render with an "Open Aviasales" CTA instead of a red error.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const openFare = (f: TpFare) => {
    const url = buildAviasalesUrl({ fareLink: f.link });
    const tg = getTelegramWebApp();
    if (tg && typeof tg.openLink === 'function') tg.openLink(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24" style={{ overflowAnchor: 'none' }}>
      <BrandHeader onOpenProfile={onOpenProfile} />

      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {step === 'search' && (
              <SearchStep
                initial={form}
                onSubmit={(f) => {
                  setForm(f);
                  setStep('results');
                  setTimeout(() => runSearch(f), 0);
                }}
              />
            )}
            {step === 'results' && (
              <ResultsStep
                form={form}
                fares={fares}
                onBack={() => setStep('search')}
                onPick={openFare}
                retrying={loading}
                error={error}
                onRetry={() => runSearch(form)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
