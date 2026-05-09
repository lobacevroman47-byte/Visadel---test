import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Hotel, Plane, RefreshCw, X, Check, Clock, FileText, Search, ChevronRight, Loader2, Upload, FileDown,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { uploadFile, getAppSettings } from '../../lib/db';
import { apiFetch } from '../../lib/apiFetch';
import { partnerCommission } from '../../lib/bonus-config';
import { useDialog } from '../../components/shared/BrandDialog';

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
  extra_fields: Record<string, string> | null;
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
  extra_fields: Record<string, string> | null;
}

type Tab = 'hotels' | 'flights';

// Статусы броней — упрощённый набор по запросу пользователя:
//   new (default)  → «Ожидает подтверждения»
//   in_progress    → «В работе»
//   confirmed      → «Готово»
//   cancelled      → «Отменена»
//
// 'pending_payment' убран — раньше был для случая когда юзер ещё не
// прикрепил скрин оплаты, но теперь форма сразу пишет 'new' с прикреплённым
// payment_screenshot. Старые brони с pending_payment всё равно отображаются
// корректно (lookup в STATUS_OPTIONS), просто нельзя выбрать в дропдауне.
//
// 'pending_confirmation' оставлен в lookup для legacy записей (если кто-то
// раньше написал такой статус), но в дропдауне не показывается — он
// семантически = 'new'.
const STATUS_OPTIONS = [
  { value: 'new',                  label: 'Ожидает подтверждения',  color: 'bg-[#EAF1FF] text-[#3B5BFF]' },
  { value: 'pending_confirmation', label: 'Ожидает подтверждения',  color: 'bg-[#EAF1FF] text-[#3B5BFF]' },
  { value: 'pending_payment',      label: 'Ожидает оплаты',         color: 'bg-amber-100 text-amber-700' },
  { value: 'in_progress',          label: 'В работе',               color: 'bg-amber-100 text-amber-700' },
  { value: 'confirmed',            label: 'Готово',                 color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled',            label: 'Отменена',               color: 'bg-red-100 text-red-700' },
];

// Что показывать в селекте — только 4 целевых статуса.
// Legacy 'pending_payment' и 'pending_confirmation' видны в badge'ах если
// есть в БД, но менять на них из админки нельзя.
const STATUS_DROPDOWN = STATUS_OPTIONS.filter(s =>
  ['new', 'in_progress', 'confirmed', 'cancelled'].includes(s.value)
);

const fmtDate = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtDateTime = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const statusLabel = (v: string) => STATUS_OPTIONS.find(s => s.value === v)?.label ?? v;

// CSV-экспорт всех броней (отели + авиабилеты, объединённый файл с колонкой "Тип")
function exportBookingsToCsv(hotels: HotelBooking[], flights: FlightBooking[]) {
  const head = ['Тип', 'ID', 'Имя', 'Фамилия', 'Telegram', 'Email', 'Телефон', 'Маршрут / Отель', 'Даты', 'Сумма', 'Статус', 'Создано'];
  const escape = (v: unknown) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[,";\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [head.join(',')];
  for (const b of hotels) {
    lines.push([
      'Отель', b.id, b.first_name, b.last_name, b.telegram_login, b.email, b.phone,
      `${b.country}, ${b.city}`,
      `${fmtDate(b.check_in)} → ${fmtDate(b.check_out)} (${b.guests} гост.)`,
      b.price ?? '', statusLabel(b.status),
      new Date(b.created_at).toLocaleDateString('ru-RU'),
    ].map(escape).join(','));
  }
  for (const b of flights) {
    lines.push([
      'Авиабилет', b.id, b.first_name, b.last_name, b.telegram_login, b.email, b.phone,
      `${b.from_city} → ${b.to_city}`,
      fmtDate(b.booking_date),
      b.price ?? '', statusLabel(b.status),
      new Date(b.created_at).toLocaleDateString('ru-RU'),
    ].map(escape).join(','));
  }
  // Excel-friendly: BOM + CRLF
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookings_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BookingsProps {
  initialTab?: Tab;
}

export const Bookings: React.FC<BookingsProps> = ({ initialTab }) => {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'hotels');
  const [hotels, setHotels] = useState<HotelBooking[]>([]);
  const [flights, setFlights] = useState<FlightBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  const matchesSearch = (b: HotelBooking | FlightBooking, q: string, type: 'hotel' | 'flight') => {
    if (!q) return true;
    const haystack = [
      b.id, b.first_name, b.last_name, b.email, b.phone, b.telegram_login, b.username,
      type === 'hotel' ? 'отель бронь отеля hotel' : 'авиабилет билет рейс flight',
      type === 'hotel'
        ? [(b as HotelBooking).country, (b as HotelBooking).city]
        : [(b as FlightBooking).from_city, (b as FlightBooking).to_city],
    ].flat().filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  };

  const filteredHotels = useMemo(() => {
    const q = search.toLowerCase().trim();
    return hotels.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      return matchesSearch(b, q, 'hotel');
    });
  }, [hotels, search, statusFilter]);

  const filteredFlights = useMemo(() => {
    const q = search.toLowerCase().trim();
    return flights.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      return matchesSearch(b, q, 'flight');
    });
  }, [flights, search, statusFilter]);

  // Сумма по выручке — только подтверждённые брони (как и в финансах).
  // Показываем для активной вкладки, чтобы число было относится к видимым строкам.
  const totalRevenue = useMemo(() => {
    const list = tab === 'hotels' ? filteredHotels : filteredFlights;
    return list
      .filter(b => b.status === 'confirmed')
      .reduce((s, b) => s + (b.price ?? 0), 0);
  }, [tab, filteredHotels, filteredFlights]);

  const updateStatus = async (table: 'hotel_bookings' | 'flight_bookings', id: string, status: string) => {
    if (!isSupabaseConfigured()) return;

    // Validation: status='confirmed' требует прикреплённый confirmation_url.
    // Иначе админ может «отправить бронь готовой» не загрузив подтверждение,
    // и юзер получит push «бронь готова» без файла — пойдут жалобы.
    if (status === 'confirmed') {
      const current = table === 'hotel_bookings'
        ? hotels.find(h => h.id === id)
        : flights.find(f => f.id === id);
      if (!current?.confirmation_url) {
        await dialog.warning(
          'Сначала прикрепи подтверждение',
          'Нельзя поставить статус «Готово» без файла подтверждения брони. Загрузи скан/PDF в карточке брони и попробуй снова.',
        );
        return;
      }
    }

    const { error } = await supabase.from(table).update({ status }).eq('id', id);
    if (error) {
      await dialog.error('Не удалось обновить статус', error.message);
      return;
    }

    // При переходе в любой «paid» статус — начислить партнёрскую комиссию
    // (если бронь привязана к партнёру и комиссия ещё не начислялась).
    const PAID_BOOKING_STATUSES = ['in_progress', 'confirmed'];
    if (PAID_BOOKING_STATUSES.includes(status)) {
      try {
        await maybeAccruePartnerCommission(table, id);
      } catch (e) {
        console.warn('[bookings] partner commission accrual failed (non-fatal):', e);
      }
    }

    // При отмене — откатываем партнёрскую комиссию (если уже начислена).
    if (status === 'cancelled') {
      try {
        await maybeReversePartnerCommission(table, id);
      } catch (e) {
        console.warn('[bookings] partner commission reversal failed (non-fatal):', e);
      }
    }

    void refresh();
    if (selectedHotel?.id === id) setSelectedHotel(s => s ? { ...s, status } : s);
    if (selectedFlight?.id === id) setSelectedFlight(s => s ? { ...s, status } : s);

    // Push клиенту — best-effort. Маппим booking-статус на нотификацию:
    //   in_progress → booking_in_progress («Бронь в работе»)
    //   confirmed   → booking_confirmed («Бронь готова!»)
    //   cancelled   → booking_cancelled («Бронь отменена»)
    //   new / pending_* — без push (это юзер ещё не был информирован)
    const NOTIFY_STATUS_MAP: Record<string, string> = {
      in_progress: 'booking_in_progress',
      confirmed:   'booking_confirmed',
      cancelled:   'booking_cancelled',
    };
    const notifyStatus = NOTIFY_STATUS_MAP[status];
    if (notifyStatus) {
      const booking = table === 'hotel_bookings'
        ? hotels.find(h => h.id === id)
        : flights.find(f => f.id === id);
      if (booking?.telegram_id) {
        apiFetch('/api/notify-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: booking.telegram_id,
            status: notifyStatus,
            application_id: `booking_${table}_${id}_${status}`,
          }),
        }).catch(e => console.warn('[bookings] notify-status failed (non-fatal):', e));
      }
    }

    // Брендовый success после всего — единый стиль (не нативный alert).
    await dialog.success('Статус обновлён', notifyStatus ? 'Уведомление клиенту отправлено.' : undefined);
  };

  // Idempotent: dedupe_key (`partner_${table}_${bookingId}`) защищает от
  // повторного начисления при повторном клике "Готово". Не падает если у
  // брони нет referrer или referrer не партнёр — просто no-op.
  async function maybeAccruePartnerCommission(table: 'hotel_bookings' | 'flight_bookings', bookingId: string) {
    const { data: booking } = await supabase
      .from(table)
      .select('id, price, referrer_code, partner_commission_pct, partner_commission_status')
      .eq('id', bookingId)
      .single();
    const b = booking as {
      price: number | null;
      referrer_code: string | null;
      partner_commission_pct: number | null;
      partner_commission_status: string | null;
    } | null;
    if (!b || !b.referrer_code || !b.price) return;
    if (b.partner_commission_status) return; // уже начислялось

    // Reservation → referrer
    const { data: refRow } = await supabase
      .from('users')
      .select('telegram_id, is_influencer')
      .eq('referral_code', b.referrer_code)
      .single();
    const r = refRow as { telegram_id: number; is_influencer: boolean } | null;
    if (!r || !r.is_influencer) return; // не партнёр — комиссии нет

    const settings = await getAppSettings();
    const defaultPct = table === 'hotel_bookings'
      ? (settings.hotel_partner_pct_default ?? 20)
      : (settings.flight_partner_pct_default ?? 10);
    const pct = b.partner_commission_pct ?? defaultPct;
    const amount = partnerCommission(b.price, pct);
    if (amount <= 0) return;

    // Формат description унифицирован с visa flow (db.ts), чтобы UI breakdown
    // в кабинете партнёра парсил оба единым regex'ом.
    const kindKey = table === 'hotel_bookings' ? 'отель' : 'авиа';
    const dedupeKey = `partner_${table}_${bookingId}`;
    await apiFetch('/api/grant-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: r.telegram_id,
        type: 'partner_pending',
        amount,
        description: `+${amount}₽ партнёру (${kindKey} ${b.price}₽×${pct}%=${amount}₽) — hold 30д`,
        application_id: dedupeKey,
      }),
    });

    // Update booking row with commission tracking fields
    await supabase.from(table).update({
      partner_commission_pct: pct,
      partner_commission_amount_rub: amount,
      partner_commission_status: 'pending',
    }).eq('id', bookingId);

    // Push-уведомление партнёру (best-effort, не блокирует)
    apiFetch('/api/notify-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: r.telegram_id,
        status: 'partner_referral_paid',
        amount,
        source: table === 'hotel_bookings' ? 'hotel' : 'flight',
        application_id: `partner_notify_${dedupeKey}`,
      }),
    }).catch(e => console.warn('partner notify (booking) error:', e));
  }

  // Откат партнёрской комиссии при отмене брони. Идемпотентно через dedupe_key.
  async function maybeReversePartnerCommission(table: 'hotel_bookings' | 'flight_bookings', bookingId: string) {
    const { data: booking } = await supabase
      .from(table)
      .select('id, referrer_code, partner_commission_amount_rub, partner_commission_status')
      .eq('id', bookingId)
      .single();
    const b = booking as {
      referrer_code: string | null;
      partner_commission_amount_rub: number | null;
      partner_commission_status: string | null;
    } | null;
    if (!b || !b.referrer_code || !b.partner_commission_status) return;
    if (b.partner_commission_status === 'cancelled') return; // уже отменено

    const { data: refRow } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('referral_code', b.referrer_code)
      .single();
    const r = refRow as { telegram_id: number } | null;
    if (!r) return;

    // Если комиссия была approved — реверсируем баланс. Иначе amount=0
    // (pending не трогает баланс, просто пишем log для аудита).
    const wasApproved = b.partner_commission_status === 'approved';
    const reverseAmount = wasApproved ? -(b.partner_commission_amount_rub ?? 0) : 0;
    const dedupeKey = `partner_${table}_${bookingId}`;

    await apiFetch('/api/grant-bonus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: r.telegram_id,
        type: 'partner_cancelled',
        amount: reverseAmount,
        description: wasApproved
          ? `Отмена комиссии −${Math.abs(reverseAmount)}₽ — заказ отменён`
          : `Отмена pending-комиссии (${b.partner_commission_amount_rub ?? 0}₽) — заказ отменён`,
        application_id: dedupeKey,
      }),
    });

    await supabase.from(table).update({
      partner_commission_status: 'cancelled',
    }).eq('id', bookingId);
  }

  const handleExportCsv = () => {
    exportBookingsToCsv(hotels, flights);
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">Брони для виз</h1>
          <p className="text-xs text-gray-500 mt-1">
            {(tab === 'hotels' ? filteredHotels.length : filteredFlights.length)} из {(tab === 'hotels' ? hotels.length : flights.length)}
            {' · сумма (подтверждённые): '}
            {totalRevenue.toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition flex items-center gap-1.5 text-sm"
            title="Экспорт CSV"
          >
            <FileDown size={16} /> CSV
          </button>
          <button onClick={() => void refresh()} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition active:scale-95">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Обновить
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <TabPill active={tab === 'hotels'} onClick={() => setTab('hotels')} icon={<Hotel size={16} />} label={`Отели (${hotels.length})`} />
        <TabPill active={tab === 'flights'} onClick={() => setTab('flights')} icon={<Plane size={16} />} label={`Авиабилеты (${flights.length})`} />
      </div>

      {/* Search + status filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ID заявки, имя, страна, email, телефон, тип брони…"
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF] focus:ring-2 focus:ring-[#5C7BFF]/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5C7BFF] focus:ring-2 focus:ring-[#5C7BFF]/20"
        >
          <option value="all">Все статусы</option>
          {STATUS_DROPDOWN.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {tab === 'hotels' && (
        <BookingList
          items={filteredHotels}
          renderRow={(b) => (
            <HotelRow key={b.id} b={b} onClick={() => setSelectedHotel(b)} />
          )}
          emptyIcon={<Hotel className="w-12 h-12 text-gray-300" />}
          emptyText={hotels.length === 0 ? 'Заявок на отель пока нет' : 'По выбранным фильтрам ничего не найдено'}
        />
      )}

      {tab === 'flights' && (
        <BookingList
          items={filteredFlights}
          renderRow={(b) => (
            <FlightRow key={b.id} b={b} onClick={() => setSelectedFlight(b)} />
          )}
          emptyIcon={<Plane className="w-12 h-12 text-gray-300" />}
          emptyText={flights.length === 0 ? 'Заявок на авиабилет пока нет' : 'По выбранным фильтрам ничего не найдено'}
        />
      )}

      {/* Modals */}
      {selectedHotel && (
        <HotelDetail
          b={selectedHotel}
          onClose={() => setSelectedHotel(null)}
          onStatusChange={(status) => updateStatus('hotel_bookings', selectedHotel.id, status)}
          onResendNotification={() => resendBookingNotification('hotel_bookings', selectedHotel)}
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
          onResendNotification={() => resendBookingNotification('flight_bookings', selectedFlight)}
          onConfirmationUploaded={(url) => {
            setSelectedFlight(s => s ? { ...s, confirmation_url: url } : s);
            void refresh();
          }}
        />
      )}
    </div>
  );

  // Повторная отправка push клиенту с текущим статусом — пригодно для
  // случаев когда первый push не дошёл (плохая связь, бот тогда не общался
  // с юзером, etc.). Без смены статуса в БД.
  async function resendBookingNotification(
    table: 'hotel_bookings' | 'flight_bookings',
    booking: HotelBooking | FlightBooking,
  ) {
    if (!booking.telegram_id) {
      await dialog.warning('Telegram ID не указан', 'У этой брони нет привязки к юзеру — отправить нельзя.');
      return;
    }
    const NOTIFY_STATUS_MAP: Record<string, string> = {
      in_progress: 'booking_in_progress',
      confirmed:   'booking_confirmed',
      cancelled:   'booking_cancelled',
    };
    const notifyStatus = NOTIFY_STATUS_MAP[booking.status];
    if (!notifyStatus) {
      await dialog.warning('Нельзя отправить', 'Уведомление по этому статусу не отправляется (только В работе / Готово / Отменена).');
      return;
    }
    try {
      // Уникальный application_id чтобы обойти dedup в notify-status
      // (раньше отправляли тот же id, dedup в течение 1 мин и игнорил)
      await apiFetch('/api/notify-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_id: booking.telegram_id,
          status: notifyStatus,
          application_id: `booking_resend_${table}_${booking.id}_${Date.now()}`,
        }),
      });
      await dialog.success('Уведомление отправлено', 'Клиент получил повторное сообщение в Telegram.');
    } catch (e) {
      await dialog.error('Не удалось отправить', e instanceof Error ? e.message : String(e));
    }
  }
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
  const dialog = useDialog();
  const [uploading, setUploading] = useState(false);
  const ready = status === 'confirmed';

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const newUrl = await uploadFile(file, 'visas');
      if (!newUrl) { await dialog.error('Не удалось загрузить файл', 'Проверь Supabase Storage.'); return; }
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from(table).update({ confirmation_url: newUrl }).eq('id', id);
        if (error) {
          await dialog.error(
            'Не удалось сохранить ссылку на файл',
            `${error.message}\n\nПохоже что в БД нет колонки confirmation_url. Выполни в Supabase SQL Editor:\n\nALTER TABLE ${table} ADD COLUMN IF NOT EXISTS confirmation_url text;`
          );
          return;
        }
      }
      onUploaded(newUrl);
    } catch (e) {
      await dialog.error('Ошибка', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Подтверждение брони (для клиента)</p>

      {!url && !ready && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-[#0F2A36] mb-2">
          ℹ️ Сначала загрузи файл подтверждения, потом переведи статус в <span className="font-bold">«Готово»</span> — иначе клиент получит уведомление без прикреплённого подтверждения.
        </div>
      )}

      {/* Existing file — small green pill above the dropzone */}
      {url && (
        <div className="vd-grad-soft border border-blue-100 rounded-xl p-2.5 flex items-center gap-2 mb-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={3} />
          <p className="text-xs font-semibold text-[#0F2A36] flex-1">Загружено</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#3B5BFF] hover:underline shrink-0">Открыть файл</a>
        </div>
      )}

      {/* Dropzone — доступен ВСЕГДА (раньше только при status=confirmed,
          что вынуждало админа сначала переводить в Готово, и из-за этого
          можно было «отправить» бронь без файла). Теперь сначала прикрепи —
          потом переводи в Готово. */}
      <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition text-center">
        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[#3B5BFF] mx-auto" /> : <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />}
        <p className="text-xs text-[#0F2A36]">
          {uploading ? 'Загружаем…' : url ? 'Загрузить другое подтверждение' : 'Загрузить подтверждение'}
        </p>
        <p className="text-[10px] text-[#0F2A36]/55 mt-0.5">
          {url
            ? 'PDF/JPG/PNG · заменит уже загруженный файл'
            : 'PDF/JPG/PNG · после загрузки клиент сможет скачать в кабинете'}
        </p>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      </label>
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

function StatusSelector({
  status, onChange, onResend,
}: {
  status: string;
  onChange: (s: string) => void;
  onResend?: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(status);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Re-sync draft if upstream status changes (e.g. confirmation upload flips it)
  useEffect(() => { setDraft(status); }, [status]);

  const dirty = draft !== status;

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await onChange(draft);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    setResending(true);
    try { await onResend(); } finally { setResending(false); }
  };

  // Кнопка повторной отправки видна только для статусов которые отправляют
  // push (in_progress, confirmed, cancelled). Для new/pending — нет смысла.
  const canResend = ['in_progress', 'confirmed', 'cancelled'].includes(status);

  return (
    <div>
      <label className="block text-sm text-gray-700 mb-2 font-medium">Статус заявки</label>
      <select
        value={draft}
        onChange={e => setDraft(e.target.value)}
        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {STATUS_DROPDOWN.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* «Отправить уведомление повторно» — зелёная кнопка, как у визы.
          Появляется только если status уже в активной фазе (push был
          отправлен раньше) и нет dirty изменений. */}
      {onResend && canResend && !dirty && (
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="w-full mt-3 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>📨</span>}
          {resending ? 'Отправляем…' : 'Отправить уведомление повторно'}
        </button>
      )}

      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="px-5 py-2.5 bg-[#3B5BFF] hover:bg-[#4F2FE6] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
        {savedAt && !saving && !dirty && (
          <span className="text-xs text-emerald-600">✓ сохранено</span>
        )}
        {dirty && !saving && (
          <span className="text-xs text-amber-600">есть несохранённые изменения</span>
        )}
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

// Доп. поля — те что админ настроил в Конструктор анкет → Брони → Доп. поля
// и юзер заполнил при сабмите. Лейблы хранятся в app_settings.{kind}_extra_fields,
// но мы их сюда не тащим — показываем raw key=value. Если value начинается с
// http(s):// — рендерим как ссылку (для file-полей).
function ExtraFieldsBlock({ fields }: { fields: Record<string, string> | null }) {
  if (!fields || Object.keys(fields).length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-[#0F2A36]/65 mb-2">Доп. поля</p>
      <div className="bg-gray-50 rounded-xl p-3 space-y-2">
        {Object.entries(fields).map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2A36]/50">{k}</p>
            {/^https?:\/\//.test(String(v)) ? (
              <a href={String(v)} target="_blank" rel="noreferrer" className="text-sm text-[#3B5BFF] hover:underline break-all">
                Открыть файл ↗
              </a>
            ) : (
              <p className="text-sm text-[#0F2A36] mt-0.5 whitespace-pre-wrap">{String(v) || '—'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Универсальный layout-обёртка для админских booking-модалок —
// 4 таба «Основное / Анкета / Файлы / Оплата» как у визовой модалки.
// Шапка в стиле визы: лейбл «бронь отеля» / «бронь авиабилета»,
// крупное имя клиента, дата подачи + Telegram-ссылка справа.
function BookingDetailModal({
  b, kind, onClose, onStatusChange, onResendNotification, onConfirmationUploaded,
  TripFields,
}: {
  b: HotelBooking | FlightBooking;
  kind: 'hotel' | 'flight';
  onClose: () => void;
  onStatusChange: (s: string) => void;
  onResendNotification: () => Promise<void> | void;
  onConfirmationUploaded: (url: string) => void;
  TripFields: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'form' | 'files' | 'payment'>('info');
  const tgUsername = b.telegram_login?.replace(/^@/, '') || b.username || '';
  const kindLabel = kind === 'hotel' ? 'бронь отеля' : 'бронь авиабилета';
  const table = kind === 'hotel' ? 'hotel_bookings' : 'flight_bookings';

  return (
    <ModalShell onClose={onClose}>
      {/* Header — same as visa modal */}
      <div className="vd-grad-soft px-5 pt-5 pb-4 sticky top-0 z-10 border-b border-blue-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">{kindLabel}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white text-gray-500 hover:text-gray-700 flex items-center justify-center transition active:scale-95 sm:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-[#0F2A36]">{b.first_name} {b.last_name}</h2>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <p className="text-xs text-[#0F2A36]/60">Подана {fmtDateTime(b.created_at)}</p>
          {tgUsername && (
            <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
              className="text-xs text-[#3B5BFF] hover:underline flex items-center gap-1">
              @{tgUsername}
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Tabs — идентично админке виз */}
      <div className="flex border-b border-gray-200 shrink-0 sticky top-[110px] bg-white z-10">
        {(['info', 'form', 'files', 'payment'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'info' ? 'Основное' : tab === 'form' ? 'Анкета' : tab === 'files' ? 'Файлы' : 'Оплата'}
          </button>
        ))}
      </div>

      <div className="px-5 py-5">
        {/* ── Tab: Основное ── */}
        {activeTab === 'info' && (
          <div className="space-y-5">
            {/* Контактная сетка как у визы */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">ФИО / имя</p>
                <p className="text-sm font-medium">{[b.first_name, b.last_name].filter(Boolean).join(' ') || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Telegram</p>
                {tgUsername ? (
                  <a href={`https://t.me/${tgUsername}`} target="_blank" rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline">
                    @{tgUsername}
                  </a>
                ) : <p className="text-sm font-medium">—</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500">Телефон</p>
                <p className="text-sm font-medium">{b.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium break-all">{b.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Дата подачи</p>
                <p className="text-sm font-medium">{new Date(b.created_at).toLocaleDateString('ru-RU')}</p>
              </div>
            </div>

            {/* Итого к оплате — как у визы */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-gray-700">Итого к оплате</p>
              <p className="text-lg font-bold text-blue-600">
                {b.price != null ? `${b.price.toLocaleString('ru-RU')} ₽` : '—'}
              </p>
            </div>

            {/* Финансы — без курса USD (бронь всегда в рублях, конвертация
                не нужна). Налог можно при желании добавить позже, пока скрыт. */}

            {/* Статус заявки + повторная отправка */}
            <StatusSelector status={b.status} onChange={onStatusChange} onResend={onResendNotification} />
          </div>
        )}

        {/* ── Tab: Анкета (детали поездки + extra_fields) ── */}
        {activeTab === 'form' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Детали поездки</p>
              <div className="grid grid-cols-2 gap-3">
                {TripFields}
              </div>
            </div>
            {b.extra_fields && Object.keys(b.extra_fields).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Доп. поля</p>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  {Object.entries(b.extra_fields).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-xs text-gray-500">{k}</p>
                      {/^https?:\/\//.test(String(v)) ? (
                        <a href={String(v)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                          Открыть файл ↗
                        </a>
                      ) : (
                        <p className="text-sm font-medium whitespace-pre-wrap">{String(v) || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Файлы (passport + confirmation) ── */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Загранпаспорт клиента</p>
              {b.passport_url ? (
                <a href={b.passport_url} target="_blank" rel="noreferrer"
                  className="bg-gray-50 hover:bg-gray-100 transition rounded-xl p-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-sm text-blue-600 font-medium flex-1">Открыть скан</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </a>
              ) : (
                <p className="text-sm text-gray-400">Не загружен</p>
              )}
            </div>
            <ConfirmationUploader
              url={b.confirmation_url}
              status={b.status}
              table={table}
              id={b.id}
              onUploaded={onConfirmationUploaded}
            />
          </div>
        )}

        {/* ── Tab: Оплата ── */}
        {activeTab === 'payment' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Стоимость</p>
                <p className="text-lg font-bold text-blue-600 mt-0.5">
                  {b.price != null ? `${b.price.toLocaleString('ru-RU')} ₽` : '—'}
                </p>
              </div>
              {b.payment_screenshot_url && (
                <a href={b.payment_screenshot_url} target="_blank" rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-blue-600 hover:bg-blue-50 transition flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Скриншот оплаты
                </a>
              )}
            </div>
            {!b.payment_screenshot_url && (
              <p className="text-sm text-gray-400 text-center py-2">Скриншот оплаты не приложен</p>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function HotelDetail({ b, onClose, onStatusChange, onResendNotification, onConfirmationUploaded }: {
  b: HotelBooking; onClose: () => void; onStatusChange: (s: string) => void;
  onResendNotification: () => Promise<void> | void;
  onConfirmationUploaded: (url: string) => void;
}) {
  return (
    <BookingDetailModal
      b={b}
      kind="hotel"
      onClose={onClose}
      onStatusChange={onStatusChange}
      onResendNotification={onResendNotification}
      onConfirmationUploaded={onConfirmationUploaded}
      TripFields={
        <>
          <DetailItem label="Страна" value={b.country} />
          <DetailItem label="Город" value={b.city} />
          <DetailItem label="Заезд" value={fmtDate(b.check_in)} />
          <DetailItem label="Выезд" value={fmtDate(b.check_out)} />
          <DetailItem label="Гостей" value={String(b.guests)} />
          {b.children_ages.length > 0 && (
            <DetailItem label="Дети" value={`${b.children_ages.length} (${b.children_ages.join(', ')} лет)`} />
          )}
        </>
      }
    />
  );
}

function FlightDetail({ b, onClose, onStatusChange, onResendNotification, onConfirmationUploaded }: {
  b: FlightBooking; onClose: () => void; onStatusChange: (s: string) => void;
  onResendNotification: () => Promise<void> | void;
  onConfirmationUploaded: (url: string) => void;
}) {
  return (
    <BookingDetailModal
      b={b}
      kind="flight"
      onClose={onClose}
      onStatusChange={onStatusChange}
      onResendNotification={onResendNotification}
      onConfirmationUploaded={onConfirmationUploaded}
      TripFields={
        <>
          <DetailItem label="Откуда" value={b.from_city} />
          <DetailItem label="Куда" value={b.to_city} />
          <DetailItem label="Дата брони" value={fmtDate(b.booking_date)} />
        </>
      }
    />
  );
}

// Стиль ячейки идентичен Applications.tsx — text-xs gray-500 для лейбла,
// text-sm font-medium для значения. Никаких больше unique-bookings цветов.
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  );
}
