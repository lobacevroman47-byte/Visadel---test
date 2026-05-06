import React, { useState, useEffect, useCallback } from 'react';
import {
  Hotel, Plane, RefreshCw, X, Check, Clock, FileText, Search, ChevronRight, Loader2, Upload,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uploadFile } from '../../lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HotelBooking {
  id: string;
  created_at: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string;
  last_name: string;
  country: string;
  city: string;
  check_in: string;
  check_out: string;
  guests: number;
  children_ages: string[];
  email: string;
  phone: string;
  telegram_login: string;
  passport_url: string | null;
  payment_screenshot_url: string | null;
  confirmation_url: string | null;
  price: number | null;
  status: string;
}

interface FlightBooking {
  id: string;
  created_at: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string;
  last_name: string;
  from_city: string;
  to_city: string;
  booking_date: string;
  email: string;
  phone: string;
  telegram_login: string;
  passport_url: string | null;
  payment_screenshot_url: string | null;
  confirmation_url: string | null;
  price: number | null;
  status: string;
}

type Tab = 'hotels' | 'flights';

const STATUS_OPTIONS = [
  { value: 'new',         label: 'Новая',     color: 'bg-[#EAF1FF] text-[#3B5BFF]' },
  { value: 'in_progress', label: 'В работе',  color: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed',   label: 'Готово',    color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled',   label: 'Отменена',  color: 'bg-red-100 text-red-700' },
];

const fmtDate = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtDateTime = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// ─── Component ───────────────────────────────────────────────────────────────

export const Bookings: React.FC = () => {
  const [tab, setTab] = useState<Tab>('hotels');
  const [hotels, setHotels] = useState<HotelBooking[]>([]);
  const [flights, setFlights] = useState<FlightBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedHotel, setSelectedHotel] = useState<HotelBooking | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<FlightBooking | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const [h, f] = await Promise.all([
        supabase.from('hotel_bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('flight_bookings').select('*').order('created_at', { ascending: false }),
      ]);
      if (h.data) setHotels(h.data as HotelBooking[]);
      if (f.data) setFlights(f.data as FlightBooking[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredHotels = hotels.filter(b => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [b.first_name, b.last_name, b.country, b.city, b.email, b.phone, b.telegram_login].some(v => v?.toLowerCase().includes(q));
  });

  const filteredFlights = flights.filter(b => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [b.first_name, b.last_name, b.from_city, b.to_city, b.email, b.phone, b.telegram_login].some(v => v?.toLowerCase().includes(q));
  });

  const updateStatus = async (table: 'hotel_bookings' | 'flight_bookings', id: string, status: string) => {
    if (!isSupabaseConfigured()) return;
    await supabase.from(table).update({ status }).eq('id', id);
    void refresh();
    if (selectedHotel?.id === id) setSelectedHotel(s => s ? { ...s, status } : s);
    if (selectedFlight?.id === id) setSelectedFlight(s => s ? { ...s, status } : s);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Брони для виз</h1>
          <p className="text-sm text-gray-500 mt-0.5">Заявки на отели и авиабилеты</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition active:scale-95">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Обновить
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <TabPill active={tab === 'hotels'} onClick={() => setTab('hotels')} icon={<Hotel size={16} />} label={`Отели (${hotels.length})`} />
        <TabPill active={tab === 'flights'} onClick={() => setTab('flights')} icon={<Plane size={16} />} label={`Авиабилеты (${flights.length})`} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'hotels' ? 'Поиск по имени, городу, email…' : 'Поиск по имени, городам, email…'}
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF] focus:ring-2 focus:ring-[#5C7BFF]/20"
        />
      </div>

      {/* List */}
      {tab === 'hotels' && (
        <BookingList
          items={filteredHotels}
          renderRow={(b) => (
            <HotelRow key={b.id} b={b} onClick={() => setSelectedHotel(b)} />
          )}
          emptyIcon={<Hotel className="w-12 h-12 text-gray-300" />}
          emptyText="Заявок на отель пока нет"
        />
      )}

      {tab === 'flights' && (
        <BookingList
          items={filteredFlights}
          renderRow={(b) => (
            <FlightRow key={b.id} b={b} onClick={() => setSelectedFlight(b)} />
          )}
          emptyIcon={<Plane className="w-12 h-12 text-gray-300" />}
          emptyText="Заявок на авиабилет пока нет"
        />
      )}

      {/* Modals */}
      {selectedHotel && (
        <HotelDetail
          b={selectedHotel}
          onClose={() => setSelectedHotel(null)}
          onStatusChange={(status) => updateStatus('hotel_bookings', selectedHotel.id, status)}
          onConfirmationUploaded={(url) => {
            setSelectedHotel(s => s ? { ...s, confirmation_url: url } : s);
            void refresh();
          }}
        />
      )}
      {selectedFlight && (
        <FlightDetail
          b={selectedFlight}
          onClose={() => setSelectedFlight(null)}
          onStatusChange={(status) => updateStatus('flight_bookings', selectedFlight.id, status)}
          onConfirmationUploaded={(url) => {
            setSelectedFlight(s => s ? { ...s, confirmation_url: url } : s);
            void refresh();
          }}
        />
      )}
    </div>
  );
};

// ─── Helper components ───────────────────────────────────────────────────────

function TabPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 ${
        active ? 'vd-grad text-white shadow-md vd-shadow-cta' : 'bg-white border border-gray-200 text-[#0F2A36]/70 hover:bg-gray-50'
      }`}>
      {icon}
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>;
}

function BookingList<T extends { id: string }>({ items, renderRow, emptyIcon, emptyText }: {
  items: T[];
  renderRow: (item: T) => React.ReactNode;
  emptyIcon: React.ReactNode;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <div className="flex justify-center mb-3">{emptyIcon}</div>
        <p className="text-sm text-gray-500">{emptyText}</p>
      </div>
    );
  }
  return <div className="space-y-2">{items.map(renderRow)}</div>;
}

function HotelRow({ b, onClick }: { b: HotelBooking; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 hover:shadow-md active:scale-[0.99] transition p-4 flex items-center gap-4 text-left">
      <div className="w-11 h-11 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
        <Hotel className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-[#0F2A36]">{b.first_name} {b.last_name}</p>
          <StatusBadge status={b.status} />
          {b.price != null && <span className="text-[11px] font-bold text-[#3B5BFF]">{b.price.toLocaleString('ru-RU')} ₽</span>}
        </div>
        <p className="text-xs text-[#0F2A36]/60 mt-0.5 truncate">
          {b.country}, {b.city} · {fmtDate(b.check_in)} → {fmtDate(b.check_out)} · {b.guests} гост.{b.children_ages.length > 0 ? ` + ${b.children_ages.length} реб.` : ''}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {fmtDateTime(b.created_at)}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
    </button>
  );
}

function FlightRow({ b, onClick }: { b: FlightBooking; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-100 hover:shadow-md active:scale-[0.99] transition p-4 flex items-center gap-4 text-left">
      <div className="w-11 h-11 rounded-xl vd-grad-soft border border-blue-100 flex items-center justify-center text-[#3B5BFF] shrink-0">
        <Plane className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-[#0F2A36]">{b.first_name} {b.last_name}</p>
          <StatusBadge status={b.status} />
          {b.price != null && <span className="text-[11px] font-bold text-[#3B5BFF]">{b.price.toLocaleString('ru-RU')} ₽</span>}
        </div>
        <p className="text-xs text-[#0F2A36]/60 mt-0.5 truncate">
          {b.from_city} → {b.to_city} · {fmtDate(b.booking_date)}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {fmtDateTime(b.created_at)}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
    </button>
  );
}

function ConfirmationUploader({
  url, status, table, id, onUploaded,
}: {
  url: string | null;
  status: string;
  table: 'hotel_bookings' | 'flight_bookings';
  id: string;
  onUploaded: (newUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const ready = status === 'confirmed';

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const newUrl = await uploadFile(file, 'visas');
      if (!newUrl) { alert('Не удалось загрузить файл в хранилище. Проверь Supabase Storage.'); return; }
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from(table).update({ confirmation_url: newUrl }).eq('id', id);
        if (error) {
          alert(
            `Не удалось сохранить ссылку на файл:\n${error.message}\n\n` +
            `Похоже что в БД нет колонки confirmation_url. Выполни в Supabase SQL Editor:\n\n` +
            `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS confirmation_url text;`
          );
          return;
        }
      }
      onUploaded(newUrl);
    } catch (e) {
      alert(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Подтверждение брони (для клиента)</p>

      {!ready && !url && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-900">
          ℹ️ Чтобы прикрепить файл, сначала переведи статус в <span className="font-bold">«Готово»</span> (выше).
        </div>
      )}

      {(ready || url) && (
        url ? (
          <div className="vd-grad-soft border border-blue-100 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" strokeWidth={3} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0F2A36]">Загружено</p>
              <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#3B5BFF] hover:underline">Открыть</a>
            </div>
            {ready && (
              <label className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-[#3B5BFF] hover:bg-[#EAF1FF] cursor-pointer transition active:scale-95 flex items-center gap-1 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                Заменить
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
              </label>
            )}
          </div>
        ) : (
          <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition text-center">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[#3B5BFF] mx-auto" /> : <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />}
            <p className="text-xs text-[#0F2A36]">{uploading ? 'Загружаем…' : 'Загрузить подтверждение'}</p>
            <p className="text-[10px] text-[#0F2A36]/55 mt-0.5">PDF/JPG/PNG · после загрузки клиент сможет скачать в кабинете</p>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
          </label>
        )
      )}
    </div>
  );
}

function PaymentBlock({ price, screenshotUrl }: { price: number | null; screenshotUrl: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Оплата</p>
      <div className="vd-grad-soft border border-blue-100 rounded-xl p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#3B5BFF]">К оплате</p>
          <p className="text-base font-extrabold text-[#0F2A36]">{price != null ? `${price.toLocaleString('ru-RU')} ₽` : '—'}</p>
        </div>
        {screenshotUrl ? (
          <a href={screenshotUrl} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-[#3B5BFF] hover:bg-[#EAF1FF] transition active:scale-95 flex items-center gap-1 shrink-0">
            <FileText className="w-3.5 h-3.5" />
            Скриншот
          </a>
        ) : (
          <span className="text-[11px] text-gray-400 italic">Скриншот не приложен</span>
        )}
      </div>
    </div>
  );
}

// ─── Detail modals ───────────────────────────────────────────────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-[#0F2A36]/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        {children}
      </div>
      <button onClick={onClose}
        className="hidden sm:flex fixed top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-gray-700 items-center justify-center hover:bg-white">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function StatusSelector({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Статус</p>
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 flex items-center gap-1 ${
              status === opt.value ? `${opt.color} ring-2 ring-offset-1 ring-[#5C7BFF]/40` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {status === opt.value && <Check className="w-3 h-3" />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ContactBlock({ email, phone, telegramLogin }: { email: string; phone: string; telegramLogin: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-1">Контакты</p>
      <p className="text-sm text-[#0F2A36]"><a href={`mailto:${email}`} className="text-[#3B5BFF] hover:underline">{email}</a></p>
      <p className="text-sm text-[#0F2A36]"><a href={`tel:${phone}`} className="text-[#3B5BFF] hover:underline">{phone}</a></p>
      <p className="text-sm text-[#0F2A36]">
        TG: <a href={`https://t.me/${telegramLogin.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-[#3B5BFF] hover:underline">{telegramLogin}</a>
      </p>
    </div>
  );
}

function PassportBlock({ url }: { url: string | null }) {
  if (!url) return <p className="text-xs text-gray-400 italic">Паспорт не приложен</p>;
  return (
    <div>
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Загранпаспорт</p>
      <a href={url} target="_blank" rel="noreferrer"
        className="block bg-gray-50 hover:bg-gray-100 rounded-xl p-3 flex items-center gap-3 transition">
        <FileText className="w-5 h-5 text-[#3B5BFF] shrink-0" />
        <span className="text-sm text-[#3B5BFF] font-semibold flex-1 truncate">Открыть скан</span>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </a>
    </div>
  );
}

function HotelDetail({ b, onClose, onStatusChange, onConfirmationUploaded }: {
  b: HotelBooking; onClose: () => void; onStatusChange: (s: string) => void;
  onConfirmationUploaded: (url: string) => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div className="vd-grad-soft px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Бронь отеля</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-700 flex items-center justify-center transition active:scale-95 sm:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">{b.first_name} {b.last_name}</h2>
        <p className="text-xs text-[#0F2A36]/60 mt-1">Подана {fmtDateTime(b.created_at)}</p>
      </div>

      <div className="px-5 py-5 space-y-4">
        <StatusSelector status={b.status} onChange={onStatusChange} />

        {/* Trip */}
        <div className="grid grid-cols-2 gap-3">
          <DetailItem label="Страна" value={b.country} />
          <DetailItem label="Город" value={b.city} />
          <DetailItem label="Заезд" value={fmtDate(b.check_in)} />
          <DetailItem label="Выезд" value={fmtDate(b.check_out)} />
          <DetailItem label="Гостей" value={String(b.guests)} />
          {b.children_ages.length > 0 && (
            <DetailItem label="Дети" value={`${b.children_ages.length} (${b.children_ages.join(', ')} лет)`} />
          )}
        </div>

        <ContactBlock email={b.email} phone={b.phone} telegramLogin={b.telegram_login} />
        <PaymentBlock price={b.price} screenshotUrl={b.payment_screenshot_url} />
        <PassportBlock url={b.passport_url} />
        <ConfirmationUploader
          url={b.confirmation_url}
          status={b.status}
          table="hotel_bookings"
          id={b.id}
          onUploaded={onConfirmationUploaded}
        />
      </div>
    </ModalShell>
  );
}

function FlightDetail({ b, onClose, onStatusChange, onConfirmationUploaded }: {
  b: FlightBooking; onClose: () => void; onStatusChange: (s: string) => void;
  onConfirmationUploaded: (url: string) => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <div className="vd-grad-soft px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Бронь авиабилета</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-700 flex items-center justify-center transition active:scale-95 sm:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">{b.first_name} {b.last_name}</h2>
        <p className="text-xs text-[#0F2A36]/60 mt-1">Подана {fmtDateTime(b.created_at)}</p>
      </div>

      <div className="px-5 py-5 space-y-4">
        <StatusSelector status={b.status} onChange={onStatusChange} />

        <div className="grid grid-cols-2 gap-3">
          <DetailItem label="Откуда" value={b.from_city} />
          <DetailItem label="Куда" value={b.to_city} />
          <DetailItem label="Дата брони" value={fmtDate(b.booking_date)} />
        </div>

        <ContactBlock email={b.email} phone={b.phone} telegramLogin={b.telegram_login} />
        <PaymentBlock price={b.price} screenshotUrl={b.payment_screenshot_url} />
        <PassportBlock url={b.passport_url} />
        <ConfirmationUploader
          url={b.confirmation_url}
          status={b.status}
          table="flight_bookings"
          id={b.id}
          onUploaded={onConfirmationUploaded}
        />
      </div>
    </ModalShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2A36]/50">{label}</p>
      <p className="text-sm text-[#0F2A36] font-semibold mt-0.5">{value}</p>
    </div>
  );
}
