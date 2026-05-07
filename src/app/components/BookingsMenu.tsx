import { useEffect, useState } from 'react';
import { User, ChevronRight, Hotel, Plane } from 'lucide-react';
import { getAdditionalServices, type AdditionalService } from '../lib/db';

interface BookingsMenuProps {
  onOpenProfile?: () => void;
  onOpenHotelBooking: () => void;
  onOpenFlightBooking: () => void;
}

// Текстовые дефолты — используются пока не загрузились данные из БД,
// и как фолбэк если админ не задал имя/описание в Каталог → Брони.
const HOTEL_DEFAULTS  = { name: 'Бронь отеля для визы',  description: 'Подтверждение для визы и границы' };
const FLIGHT_DEFAULTS = { name: 'Бронь обратного билета', description: 'Подтверждение рейса для визы и границы' };

// localStorage-кеш загруженных значений: при следующих заходах подписи
// появятся мгновенно без свапа на дефолты → загрузка → подмена.
const CACHE_KEY = 'visadel:bookings-menu-cache:v1';
type Cached = { hotel: Pick<AdditionalService, 'name' | 'description' | 'enabled'> | null;
                flight: Pick<AdditionalService, 'name' | 'description' | 'enabled'> | null };

const readCache = (): Cached | null => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CACHE_KEY) : null;
    return raw ? JSON.parse(raw) as Cached : null;
  } catch { return null; }
};

const writeCache = (c: Cached) => {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* ignore quota */ }
};

export default function BookingsMenu({ onOpenProfile, onOpenHotelBooking, onOpenFlightBooking }: BookingsMenuProps) {
  // Initial render берёт значения из кеша — нет свапа при повторных заходах.
  const cached = readCache();
  const [hotel,  setHotel]  = useState<Pick<AdditionalService, 'name' | 'description' | 'enabled'> | null>(cached?.hotel  ?? null);
  const [flight, setFlight] = useState<Pick<AdditionalService, 'name' | 'description' | 'enabled'> | null>(cached?.flight ?? null);

  useEffect(() => {
    let alive = true;
    getAdditionalServices()
      .then(rows => {
        if (!alive) return;
        const h = rows.find(x => x.id === 'hotel-booking')  ?? null;
        const f = rows.find(x => x.id === 'flight-booking') ?? null;
        const slim = (s: AdditionalService | null) => s ? { name: s.name, description: s.description, enabled: s.enabled } : null;
        setHotel(slim(h));
        setFlight(slim(f));
        writeCache({ hotel: slim(h), flight: slim(f) });
      })
      .catch(() => { /* network error — keep current/cached values */ });
    return () => { alive = false; };
  }, []);

  // Если админ скрыл услугу в Каталог → Брони (enabled=false), кнопку не показываем.
  // Если данных ещё нет (нет кеша и не загрузилось) — показываем кнопку с дефолтным текстом.
  const showHotel  = hotel  ? hotel.enabled  : true;
  const showFlight = flight ? flight.enabled : true;

  const hotelName        = hotel?.name        || HOTEL_DEFAULTS.name;
  const hotelDescription = hotel?.description || HOTEL_DEFAULTS.description;
  const flightName        = flight?.name        || FLIGHT_DEFAULTS.name;
  const flightDescription = flight?.description || FLIGHT_DEFAULTS.description;

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      {/* Header — same shape as Home */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight">VISADEL</span>
          </div>
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
              aria-label="Профиль"
            >
              <User className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Hero — без раздела-метки, более лаконично */}
        <div className="vd-grad-soft px-5 pt-7 pb-6">
          <h1 className="text-center text-[28px] leading-[1.05] tracking-tight font-extrabold text-[#0F2A36]">
            Брони для визы <br/>
            <span className="vd-grad-text">и пересечения границы</span>
          </h1>
          <p className="text-center text-[13px] text-[#0F2A36]/65 mt-3 max-w-sm mx-auto leading-snug">
            Документы, которые принимают посольства и пограничные службы
          </p>
        </div>

        {/* Services list — name/description/visibility синхронизированы с Каталог → Брони */}
        <div className="px-4 py-5 space-y-3">
          {showHotel && (
            <button
              onClick={onOpenHotelBooking}
              className="w-full bg-white rounded-2xl border border-gray-100 hover:shadow-md active:scale-[0.99] transition-all p-4 flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl vd-grad flex items-center justify-center text-white shrink-0 shadow-md">
                <Hotel className="w-6 h-6" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#0F2A36]">{hotelName}</p>
                <p className="text-[12px] text-[#0F2A36]/60 mt-0.5">{hotelDescription}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
            </button>
          )}

          {showFlight && (
            <button
              onClick={onOpenFlightBooking}
              className="w-full bg-white rounded-2xl border border-gray-100 hover:shadow-md active:scale-[0.99] transition-all p-4 flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl vd-grad flex items-center justify-center text-white shrink-0 shadow-md">
                <Plane className="w-6 h-6" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#0F2A36]">{flightName}</p>
                <p className="text-[12px] text-[#0F2A36]/60 mt-0.5">{flightDescription}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
            </button>
          )}
        </div>

        {/* Info card */}
        <div className="px-4">
          <div className="vd-grad-soft border border-blue-100 rounded-2xl px-4 py-4">
            <p className="text-[11px] uppercase tracking-widest text-[#3B5BFF] font-bold">Как это работает</p>
            <ol className="mt-2 space-y-1 text-sm text-[#0F2A36]/80 list-decimal list-inside">
              <li>Заполни анкету за 3 минуты</li>
              <li>Оплати и пришли скриншот</li>
              <li>Получи подтверждение в Telegram в течение часа</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
