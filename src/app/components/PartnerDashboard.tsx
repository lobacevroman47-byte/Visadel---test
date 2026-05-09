// Premium-партнёрский кабинет (отдельный экран для is_influencer=true).
// Доступен через CTA «Открыть кабинет» из ReferralsTab.
//
// Что показывает:
//   1. Hero — текущий partner_balance (₽ к выплате)
//   2. Period chip-selector + 3 карточки (HOLD, за период, выплачено)
//   3. Начисления — список с флагами стран и кликабельным modal-detail
//   4. История выплат
//   5. Реквизиты партнёра (ФИО, карта, ИНН, статус)
//   6. Vanity-код (короткая брендовая ссылка)
//
// Data flow: всё через supabase anon-key (миграции 017+018+019 открыли).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, Wallet, Clock, Check, CreditCard, FileText, Loader2,
  Save, AlertCircle, Crown, X, Copy, Link as LinkIcon, Sparkles,
  Phone, Building2, Banknote, Hash,
} from 'lucide-react';
import { useTelegram } from '../App';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PartnerDashboardProps {
  onBack: () => void;
}

const HOLD_DAYS = 30;

// Зарезервированные слова — не дать партнёру vanity, ломающий deeplinks
// или конфликтующий с системными коммандами / маршрутами мини-аппа.
const RESERVED_VANITY = new Set([
  'admin', 'partner', 'partners', 'referrals', 'applications',
  'booking', 'booking_hotel', 'booking_flight', 'partner_dashboard',
  'profile', 'home', 'settings', 'help', 'support', 'visadel',
  'visa', 'hotel', 'flight', 'bot', 'app', 'login', 'logout', 'auth',
  'api', 'admin_panel', 'dashboard', 'reviews', 'about', 'contact',
  'terms', 'privacy', 'official', 'verified', 'staff', 'moderator',
  'ceo', 'founder', 'owner', 'root', 'user', 'guest', 'test',
]);

// Страны → флаги (для отображения в начислениях). Расширяемо.
const COUNTRY_FLAGS: Record<string, string> = {
  'Турция':           '🇹🇷',
  'Шри-Ланка':        '🇱🇰',
  'Индия':            '🇮🇳',
  'Япония':           '🇯🇵',
  'Вьетнам':          '🇻🇳',
  'Таиланд':          '🇹🇭',
  'Камбоджа':         '🇰🇭',
  'Кения':            '🇰🇪',
  'Пакистан':         '🇵🇰',
  'Филиппины':        '🇵🇭',
  'Израиль':          '🇮🇱',
  'Южная Корея':      '🇰🇷',
  'ОАЭ':              '🇦🇪',
  'Китай':            '🇨🇳',
};
function countryFlag(country?: string | null): string {
  if (!country) return '🌍';
  return COUNTRY_FLAGS[country] ?? '🌍';
}

// Парсим dedupe_key → { service, sourceId }. Реальный формат от api/grant-bonus.js:
//   "<bonus_type>:partner_<service>_<id>"  — например "partner_pending:partner_visa_<uuid>"
// Старые/легаси записи могут идти без префикса <type>: → поддерживаем оба варианта.
type ServiceType = 'visa' | 'hotel_bookings' | 'flight_bookings';
function parseDedupe(key: string | null | undefined): { service: ServiceType; sourceId: string } | null {
  if (!key) return null;
  // Убираем опциональный префикс "<bonus_type>:" который добавляет grant-bonus.js
  const stripped = key.replace(/^partner_[a-z]+:/i, '');
  const m = stripped.match(/^partner_(visa|hotel_bookings|flight_bookings)_(.+)$/);
  if (!m) return null;
  return { service: m[1] as ServiceType, sourceId: m[2] };
}

// Enrichment — данные заявки/брони, привязанные к bonus_log.id для отображения в строке.
// Намеренно НЕ включаем PII клиента (имя, фамилию, @username, telegram_id) —
// партнёру их видеть не нужно, чтобы:
//   • не уводить клиента «мимо» сервиса при повторном заказе
//   • соблюсти приватность (юзер не давал согласия на передачу)
interface Enrichment {
  service: ServiceType;
  country?: string;
  visa_type?: string;
  city?: string;
  from_city?: string;
  to_city?: string;
  booking_date?: string;
  check_in?: string;
  check_out?: string;
  price?: number;
  pct?: number;
}

function serviceLabel(service: ServiceType): string {
  if (service === 'visa') return 'Виза';
  if (service === 'hotel_bookings') return 'Бронь отеля';
  return 'Авиабилет';
}

// Заголовок строки (главная): "Южная Корея", "Бали", "Москва → Бали"
// Подзаголовок (серый): "K-ETA на 3 года …", "12-19 мая, 2 гостя", "14 мая 2026"
function buildEarningTitle(e: Enrichment | undefined, fallbackService?: ServiceType): string {
  if (!e) return fallbackService ? serviceLabel(fallbackService) : 'Партнёрское начисление';
  if (e.service === 'visa') return e.country || serviceLabel('visa');
  if (e.service === 'hotel_bookings') {
    return e.city || e.country || serviceLabel('hotel_bookings');
  }
  if (e.from_city && e.to_city) return `${e.from_city} → ${e.to_city}`;
  return serviceLabel('flight_bookings');
}

function buildEarningSubtitle(e: Enrichment | undefined): string | null {
  if (!e) return null;
  if (e.service === 'visa') return e.visa_type ?? null;
  if (e.service === 'hotel_bookings') {
    if (e.check_in && e.check_out) {
      const ci = new Date(e.check_in);
      const co = new Date(e.check_out);
      const day = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      return `${day(ci)} – ${day(co)}`;
    }
    return e.country ?? null;
  }
  if (e.booking_date) {
    return new Date(e.booking_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return null;
}

// Парсинг разбивки из description вида:
//   "+724₽ партнёру (виза 3490₽×15%=524₽ + срочно 1000₽×20%=200₽) — hold 30д"
// Возвращает массив { label, price, pct, amount } для отображения в модалке.
interface CommissionPart { label: string; price: number; pct: number; amount: number }
function parseCommissionBreakdown(description: string | null | undefined): CommissionPart[] {
  if (!description) return [];
  const inside = description.match(/\(([^)]+)\)/)?.[1];
  if (!inside) return [];
  const parts: CommissionPart[] = [];
  const labelMap: Record<string, string> = {
    'виза':   'Виза',
    'срочно': 'Срочное оформление',
    'отель':  'Бронь отеля',
    'авиа':   'Бронь авиабилета',
  };
  for (const segment of inside.split('+').map(s => s.trim())) {
    const m = segment.match(/^(\S+)\s+(\d+)₽×(\d+(?:\.\d+)?)%=(\d+)₽$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    parts.push({
      label: labelMap[key] ?? m[1],
      price: parseInt(m[2], 10),
      pct:   parseFloat(m[3]),
      amount: parseInt(m[4], 10),
    });
  }
  return parts;
}

// Форматтеры реквизитов для отображения в форме
function formatCardNumber(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  // +7 (XXX) XXX-XX-XX — типовой РФ формат
  let out = '+7';
  if (d.length > 1) out += ' (' + d.slice(1, 4);
  if (d.length >= 4) out += ') ';
  if (d.length >= 5) out += d.slice(4, 7);
  if (d.length >= 8) out += '-' + d.slice(7, 9);
  if (d.length >= 10) out += '-' + d.slice(9, 11);
  return out;
}
function normalizePhone(raw: string): string {
  // Храним в БД как +7XXXXXXXXXX (11 цифр с +7 префиксом)
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  // Если ввели начиная с 8 — заменяем на 7
  const normalized = d.startsWith('8') ? '7' + d.slice(1) : (d.startsWith('7') ? d : '7' + d);
  return '+' + normalized.slice(0, 11);
}

// Period selector
type Period = '1d' | '1w' | '1m' | '1y';
const PERIOD_LABELS: Record<Period, string> = {
  '1d': '1 день', '1w': '1 неделя', '1m': '1 месяц', '1y': '1 год',
};
const PERIOD_MS: Record<Period, number> = {
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
};

interface BonusLogEntry {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  dedupe_key: string | null;
  created_at: string;
}

interface PayoutEntry {
  id: string;
  amount_rub: number;
  status: string;
  card_last4: string | null;
  note: string | null;
  processed_at: string | null;
  created_at: string;
}

type EntityType = 'self_employed' | 'ip' | 'legal' | '';

interface PartnerSettings {
  full_name: string;
  inn: string;
  card_number: string;        // полный номер карты (для card-to-card)
  card_number_last4: string;  // last4 — авто-производное для быстрого отображения
  card_bank: string;
  phone_for_sbp: string;      // телефон СБП
  bank_account: string;       // расчётный счёт (для ИП/юрлица)
  bank_bic: string;           // БИК
  organization_name: string;  // название организации (для юрлица)
  kpp: string;                // КПП (для юрлица)
  entity_type: EntityType;
  agreement_accepted_at: string | null;
}

const DEFAULT_SETTINGS: PartnerSettings = {
  full_name: '', inn: '', card_number: '', card_number_last4: '', card_bank: '',
  phone_for_sbp: '', bank_account: '', bank_bic: '',
  organization_name: '', kpp: '',
  entity_type: 'self_employed', // по умолчанию самозанятый — единственный путь без налогового агентства
  agreement_accepted_at: null,
};

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'В обработке', cls: 'bg-amber-100 text-amber-700' },
  processed: { label: 'Выплачено',   cls: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Ошибка',      cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Отменена',    cls: 'bg-gray-100 text-gray-700' },
};

export default function PartnerDashboard({ onBack }: PartnerDashboardProps) {
  const { appUser, refreshUser } = useTelegram();
  const telegramId = appUser?.telegram_id ?? 0;
  const partnerBalance = appUser?.partner_balance ?? 0;
  const referralCode = appUser?.referral_code ?? '';

  const [logs, setLogs] = useState<BonusLogEntry[]>([]);
  const [enrichments, setEnrichments] = useState<Map<string, Enrichment>>(new Map());
  const [payouts, setPayouts] = useState<PayoutEntry[]>([]);
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_SETTINGS);
  const [vanity, setVanity] = useState(appUser?.vanity_code ?? '');
  // Переходы по ссылке: clicks из referral_clicks + список зарегистрированных
  // юзеров (users.referred_by = canonical referral_code).
  const [clicksCount, setClicksCount] = useState(0);
  const [referredUsers, setReferredUsers] = useState<{ first_name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [savingVanity, setSavingVanity] = useState(false);
  const [vanityError, setVanityError] = useState<string | null>(null);
  const [vanitySaved, setVanitySaved] = useState(false);
  const [period, setPeriod] = useState<Period>('1m');
  const [selectedLog, setSelectedLog] = useState<BonusLogEntry | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!telegramId || !isSupabaseConfigured()) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const myReferralCode = appUser?.referral_code ?? '';
        const myVanityCode   = (appUser?.vanity_code ?? '').toUpperCase();
        // Коды по которым считаем клики — каноничный + vanity (если есть).
        // referral_clicks хранит код AS-TYPED (без resolve), поэтому матчить
        // нужно по обоим вариантам.
        const codesToMatch = [myReferralCode, myVanityCode].filter(Boolean);

        const [logsRes, payoutsRes, settingsRes, clicksRes, referredRes] = await Promise.all([
          supabase.from('bonus_logs')
            .select('id, type, amount, description, dedupe_key, created_at')
            .eq('telegram_id', telegramId)
            .like('type', 'partner_%')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('partner_payouts')
            .select('id, amount_rub, status, card_last4, note, processed_at, created_at')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase.from('partner_settings').select('*').eq('telegram_id', telegramId).maybeSingle(),
          // Клики: count через head=true + Prefer count=exact
          codesToMatch.length > 0
            ? supabase.from('referral_clicks')
                .select('id', { count: 'exact', head: true })
                .in('referral_code', codesToMatch)
            : Promise.resolve({ count: 0 } as { count: number }),
          // Зарегистрированные юзеры по канонической ссылке партнёра.
          // users.referred_by всегда canonical (resolveReferralCode на signup).
          myReferralCode
            ? supabase.from('users')
                .select('first_name, created_at')
                .eq('referred_by', myReferralCode)
                .order('created_at', { ascending: false })
                .limit(50)
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        setLogs((logsRes.data ?? []) as BonusLogEntry[]);
        setPayouts((payoutsRes.data ?? []) as PayoutEntry[]);
        setClicksCount((clicksRes as { count: number | null }).count ?? 0);
        setReferredUsers(((referredRes as { data: { first_name: string; created_at: string }[] | null }).data ?? []) as { first_name: string; created_at: string }[]);
        if (settingsRes.data) {
          const s = settingsRes.data as Partial<PartnerSettings> & { entity_type: string | null };
          setSettings({
            full_name: s.full_name ?? '',
            inn: s.inn ?? '',
            card_number: s.card_number ?? '',
            card_number_last4: s.card_number_last4 ?? '',
            card_bank: s.card_bank ?? '',
            phone_for_sbp: s.phone_for_sbp ?? '',
            bank_account: s.bank_account ?? '',
            bank_bic: s.bank_bic ?? '',
            organization_name: s.organization_name ?? '',
            kpp: s.kpp ?? '',
            entity_type: (s.entity_type as EntityType) ?? 'self_employed',
            agreement_accepted_at: s.agreement_accepted_at ?? null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [telegramId]);

  // Обогащение начислений данными из applications/hotel_bookings/flight_bookings.
  // После загрузки logs батч-фетчим связанные сущности и строим Map<log.id, Enrichment>.
  useEffect(() => {
    if (!isSupabaseConfigured() || logs.length === 0) return;
    let cancelled = false;
    (async () => {
      const visaPairs: { logId: string; sourceId: string }[] = [];
      const hotelPairs: { logId: string; sourceId: string }[] = [];
      const flightPairs: { logId: string; sourceId: string }[] = [];
      for (const log of logs) {
        const parsed = parseDedupe(log.dedupe_key);
        if (!parsed) continue;
        const target = parsed.service === 'visa' ? visaPairs
                     : parsed.service === 'hotel_bookings' ? hotelPairs
                     : flightPairs;
        target.push({ logId: log.id, sourceId: parsed.sourceId });
      }

      const map = new Map<string, Enrichment>();

      // Визы — только данные о заказе, без PII клиента
      // Используем .filter() (не .find()) потому что у одного sourceId может
      // быть несколько pair'ов: pending log + approved log с тем же application_id.
      // .find() возвращал бы только первый — второй pair оставался без enrichment.
      if (visaPairs.length) {
        const { data } = await supabase
          .from('applications')
          .select('id, country, visa_type, price')
          .in('id', visaPairs.map(x => x.sourceId));
        const rows = (data ?? []) as Array<{ id: string; country: string; visa_type: string; price: number }>;
        for (const row of rows) {
          const pairs = visaPairs.filter(x => x.sourceId === row.id);
          for (const pair of pairs) {
            map.set(pair.logId, {
              service: 'visa',
              country: row.country,
              visa_type: row.visa_type,
              price: row.price,
            });
          }
        }
      }

      // Отели — без PII
      if (hotelPairs.length) {
        const { data } = await supabase
          .from('hotel_bookings')
          .select('id, country, city, check_in, check_out, price, partner_commission_pct')
          .in('id', hotelPairs.map(x => x.sourceId));
        const rows = (data ?? []) as Array<Record<string, unknown> & { id: string }>;
        for (const row of rows) {
          const pairs = hotelPairs.filter(x => x.sourceId === row.id);
          for (const pair of pairs) {
            map.set(pair.logId, {
              service: 'hotel_bookings',
              country: row.country as string | undefined,
              city: row.city as string | undefined,
              check_in: row.check_in as string | undefined,
              check_out: row.check_out as string | undefined,
              price: row.price as number | undefined,
              pct: row.partner_commission_pct as number | undefined,
            });
          }
        }
      }

      // Авиа — без PII
      if (flightPairs.length) {
        const { data } = await supabase
          .from('flight_bookings')
          .select('id, from_city, to_city, booking_date, price, partner_commission_pct')
          .in('id', flightPairs.map(x => x.sourceId));
        const rows = (data ?? []) as Array<Record<string, unknown> & { id: string }>;
        for (const row of rows) {
          const pairs = flightPairs.filter(x => x.sourceId === row.id);
          for (const pair of pairs) {
            map.set(pair.logId, {
              service: 'flight_bookings',
              from_city: row.from_city as string | undefined,
              to_city: row.to_city as string | undefined,
              booking_date: row.booking_date as string | undefined,
              price: row.price as number | undefined,
              pct: row.partner_commission_pct as number | undefined,
            });
          }
        }
      }

      if (!cancelled) setEnrichments(map);
    })();
    return () => { cancelled = true; };
  }, [logs]);

  // Статистика. HOLD = pending - approved (без минусов): после того как cron
  // переводит pending → approved, запись pending остаётся (audit trail), но
  // деньги уже в partner_balance. Чтобы не показывать «2× деньги», вычитаем
  // approved из pending.
  const pendingHold = useMemo(() => {
    const pending = logs.filter(l => l.type === 'partner_pending').reduce((s, l) => s + l.amount, 0);
    const approved = logs.filter(l => l.type === 'partner_approved').reduce((s, l) => s + l.amount, 0);
    return Math.max(0, pending - approved);
  }, [logs]);
  const approvedInPeriod = useMemo(() => {
    const since = Date.now() - PERIOD_MS[period];
    return logs
      .filter(l => l.type === 'partner_approved' && new Date(l.created_at).getTime() >= since)
      .reduce((s, l) => s + l.amount, 0);
  }, [logs, period]);
  const totalPaid = useMemo(
    () => Math.abs(logs.filter(l => l.type === 'partner_paid').reduce((s, l) => s + l.amount, 0)),
    [logs],
  );

  // Все начисления — дедуплицируем по canonical dedupe_key, чтобы для одного
  // источника (визы/брони) показывалась ОДНА строка. Если для source есть и
  // partner_pending, и partner_approved — приоритет approved (это финальное
  // состояние, hold уже прошёл). Если только pending — показываем pending.
  const earnings = useMemo(() => {
    const filtered = logs.filter(l => l.type === 'partner_pending' || l.type === 'partner_approved');
    const bySource = new Map<string, BonusLogEntry>();
    for (const l of filtered) {
      const canonical = (l.dedupe_key ?? l.id).replace(/^partner_[a-z]+:/, '');
      const existing = bySource.get(canonical);
      // Approved побеждает pending; в остальных случаях — оставляем первое
      if (!existing) bySource.set(canonical, l);
      else if (l.type === 'partner_approved' && existing.type === 'partner_pending') {
        bySource.set(canonical, l);
      }
    }
    return Array.from(bySource.values()).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [logs]);

  // Уникальные source_id из всех partner_*-логов — сколько РАЗНЫХ заказов
  // (виза или бронь) реферал принёс партнёру.
  const ordersCount = useMemo(() => {
    const sources = new Set<string>();
    for (const l of logs) {
      if (l.type !== 'partner_pending' && l.type !== 'partner_approved') continue;
      const canonical = (l.dedupe_key ?? '').replace(/^partner_[a-z]+:/, '');
      if (canonical) sources.add(canonical);
    }
    return sources.size;
  }, [logs]);

  // Vanity / link
  const activeCode = (appUser?.vanity_code || referralCode || '').toUpperCase();
  const link = `https://t.me/Visadel_test_bot/app?startapp=${activeCode}`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch { alert('Скопируйте: ' + link); }
  }, [link]);

  const handleSaveSettings = async () => {
    if (!telegramId || !isSupabaseConfigured()) return;
    setSavingSettings(true); setSettingsSaved(false);
    try {
      const cardDigits = settings.card_number.replace(/\D/g, '');
      const last4 = cardDigits.length >= 4 ? cardDigits.slice(-4) : '';
      const payload = {
        telegram_id: telegramId,
        full_name: settings.full_name.trim() || null,
        inn: settings.inn.trim() || null,
        card_number: cardDigits || null,
        card_number_last4: last4 || null,
        card_bank: settings.card_bank.trim() || null,
        phone_for_sbp: settings.phone_for_sbp.trim() || null,
        bank_account: settings.bank_account.trim() || null,
        bank_bic: settings.bank_bic.trim() || null,
        organization_name: settings.organization_name.trim() || null,
        kpp: settings.kpp.trim() || null,
        entity_type: settings.entity_type || null,
      };
      const { error } = await supabase.from('partner_settings').upsert(payload, { onConflict: 'telegram_id' });
      if (error) throw error;
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (e) {
      console.error('save settings:', e);
      alert('Не удалось сохранить реквизиты.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveVanity = async () => {
    if (!telegramId || !isSupabaseConfigured()) return;
    const trimmed = vanity.trim().toUpperCase();
    setVanityError(null);

    // Валидация
    if (trimmed.length === 0) {
      // Очистка vanity = NULL
    } else if (trimmed.length < 3 || trimmed.length > 20) {
      setVanityError('Длина 3–20 символов'); return;
    } else if (!/^[A-Z0-9_-]+$/.test(trimmed)) {
      setVanityError('Только латиница A–Z, цифры, _ и -'); return;
    } else if (trimmed.startsWith('VIS')) {
      setVanityError('Не может начинаться с "VIS" (зарезервировано)'); return;
    } else if (RESERVED_VANITY.has(trimmed.toLowerCase())) {
      setVanityError('Это слово зарезервировано системой'); return;
    }

    setSavingVanity(true);
    try {
      const newValue = trimmed || null;
      const { error } = await supabase
        .from('users')
        .update({ vanity_code: newValue })
        .eq('telegram_id', telegramId);
      if (error) {
        if (error.code === '23505' || /unique/i.test(error.message)) {
          setVanityError('Этот код уже занят другим партнёром');
        } else {
          setVanityError(error.message);
        }
        return;
      }
      setVanitySaved(true);
      setTimeout(() => setVanitySaved(false), 2500);
      // Обновим контекст чтобы appUser.vanity_code обновился
      try { await refreshUser(); } catch {}
    } finally {
      setSavingVanity(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 flex items-center justify-between">
          <button onClick={onBack} className="w-11 h-11 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95" aria-label="Назад">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-[#0F2A36] font-bold text-[15px]">Партнёрский кабинет</span>
          </div>
          <span className="w-9" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Hero — partner_balance */}
        <div className="vd-grad rounded-2xl p-6 text-white shadow-lg vd-shadow-cta">
          <p className="text-[11px] font-medium text-white/70 uppercase tracking-wider">К выплате</p>
          <p className="text-[42px] font-bold tabular-nums leading-none mt-2">
            {partnerBalance.toLocaleString('ru-RU')}<span className="text-2xl">₽</span>
          </p>
          <p className="text-sm text-white/80 mt-3 leading-relaxed">
            Перевод вручную на карту 2 раза в месяц. Минимума нет.
          </p>
        </div>

        {/* Period chip-selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition active:scale-95 ${
                period === p
                  ? 'vd-grad text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* 3 stats cards */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Clock className="w-3.5 h-3.5 text-amber-600" />}
            label={`HOLD ${HOLD_DAYS}д`}
            value={`${pendingHold.toLocaleString('ru-RU')}₽`}
            loading={loading}
          />
          <StatCard
            icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
            label={`За ${PERIOD_LABELS[period].toLowerCase()}`}
            value={`${approvedInPeriod.toLocaleString('ru-RU')}₽`}
            loading={loading}
          />
          <StatCard
            icon={<Wallet className="w-3.5 h-3.5 text-[#3B5BFF]" />}
            label="Выплачено"
            value={`${totalPaid.toLocaleString('ru-RU')}₽`}
            loading={loading}
          />
        </div>

        {/* Earnings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">
            Начисления
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Загружаем…
            </div>
          ) : earnings.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              Пока нет начислений. Когда твой реферал оплатит первый заказ — увидишь здесь.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {earnings.map(l => (
                <EarningRow
                  key={l.id}
                  log={l}
                  enrichment={enrichments.get(l.id)}
                  onClick={() => setSelectedLog(l)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Переходы по ссылке: clicks + регистрации + оформленные заказы */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">
            Переходы по ссылке
          </p>

          {/* 3 stats: воронка клик → регистрация → заказ */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Кликов</p>
              <p className="text-xl font-bold tabular-nums text-[#0F2A36] mt-0.5">
                {clicksCount.toLocaleString('ru-RU')}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Регистраций</p>
              <p className="text-xl font-bold tabular-nums text-[#3B5BFF] mt-0.5">
                {referredUsers.length}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Оформили заказ</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600 mt-0.5">
                {ordersCount}
              </p>
            </div>
          </div>

          {/* Список имён */}
          {referredUsers.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              Когда кто-то перейдёт по твоей ссылке и зарегистрируется — увидишь здесь имена.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {referredUsers.slice(0, 30).map((u, i) => (
                <span
                  key={i}
                  className="text-xs bg-blue-50 text-[#3B5BFF] px-2.5 py-1 rounded-full font-medium"
                  title={`Присоединился ${new Date(u.created_at).toLocaleDateString('ru-RU')}`}
                >
                  {u.first_name || 'Аноним'}
                </span>
              ))}
              {referredUsers.length > 30 && (
                <span className="text-xs text-gray-400 px-2.5 py-1">
                  +{referredUsers.length - 30}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Payouts history */}
        {payouts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">
              История выплат
            </p>
            <div className="divide-y divide-gray-100">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F2A36]">
                      {p.amount_rub.toLocaleString('ru-RU')}₽
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(p.created_at).toLocaleDateString('ru-RU')}
                      {p.card_last4 ? ` · карта •• ${p.card_last4}` : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${PAYOUT_STATUS[p.status]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                    {PAYOUT_STATUS[p.status]?.label ?? p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vanity code form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Ваша реферальная ссылка
            </p>
            {vanitySaved && (
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                <Check className="w-3 h-3" /> Сохранено
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
            <LinkIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="flex-1 text-sm text-gray-700 truncate font-mono">
              t.me/.../app?startapp={activeCode}
            </span>
            <button onClick={copyLink} className="text-gray-500 hover:text-[#3B5BFF] active:scale-90 transition shrink-0">
              {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3 h-3 inline mr-1" /> Кастомный код (vanity)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              maxLength={20}
              placeholder={referralCode}
              value={vanity}
              onChange={e => { setVanity(e.target.value); setVanityError(null); }}
              className={`flex-1 px-3 py-2.5 border rounded-xl text-sm focus:outline-none uppercase ${
                vanityError ? 'border-rose-400 focus:border-rose-500' : 'border-gray-200 focus:border-[#3B5BFF]'
              }`}
              style={{ textTransform: 'uppercase' }}
            />
            <button
              onClick={handleSaveVanity}
              disabled={savingVanity}
              className="px-4 py-2.5 vd-grad text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
            >
              {savingVanity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить
            </button>
          </div>
          {vanityError ? (
            <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {vanityError}
            </p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              3–20 символов, латиница A–Z, цифры, <code>_</code> <code>-</code>. Например:{' '}
              <code className="bg-gray-100 px-1 rounded">ANYA_TRAVEL</code>. Пусто = system code{' '}
              <code className="bg-gray-100 px-1 rounded">{referralCode}</code>.
            </p>
          )}
        </div>

        {/* Settings form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Реквизиты для выплат
            </p>
            {settingsSaved && (
              <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                <Check className="w-3 h-3" /> Сохранено
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* Статус — первый, потому что определяет какие поля показывать ниже */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Налоговый статус
              </label>
              <select
                value={settings.entity_type}
                onChange={e => setSettings(s => ({ ...s, entity_type: e.target.value as EntityType }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#3B5BFF]"
              >
                <option value="self_employed">Самозанятый</option>
                <option value="ip">ИП</option>
                <option value="legal">Юрлицо (ООО)</option>
              </select>
              {settings.entity_type === 'self_employed' && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  💡 После каждой выплаты пришли чек из «Мой налог» — это твоя обязанность по 422-ФЗ.
                </p>
              )}
              {settings.entity_type === 'ip' && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  💡 Выплата на расчётный счёт. Налог платишь сам по своей системе (УСН/ОСНО/патент).
                </p>
              )}
              {settings.entity_type === 'legal' && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  💡 Выплата на расчётный счёт организации по договору-оферте.
                </p>
              )}
            </div>

            {/* ── Имя/название ─────────────────────────────────────────── */}
            {settings.entity_type === 'legal' ? (
              <Input label="Название организации" placeholder='ООО "Ромашка"'
                value={settings.organization_name}
                onChange={v => setSettings(s => ({ ...s, organization_name: v }))}
                icon={<Building2 className="w-3.5 h-3.5 text-gray-400" />} />
            ) : (
              <Input label="ФИО полностью" placeholder="Иванов Иван Иванович"
                value={settings.full_name}
                onChange={v => setSettings(s => ({ ...s, full_name: v }))}
                icon={<FileText className="w-3.5 h-3.5 text-gray-400" />} />
            )}

            {/* ── ИНН (всем) ────────────────────────────────────────── */}
            <Input
              label={settings.entity_type === 'legal' ? 'ИНН организации (10 цифр)' : 'ИНН (12 цифр)'}
              placeholder={settings.entity_type === 'legal' ? '7700000000' : '770000000000'}
              value={settings.inn}
              onChange={v => setSettings(s => ({ ...s, inn: v.replace(/\D/g, '').slice(0, settings.entity_type === 'legal' ? 10 : 12) }))}
              icon={<Hash className="w-3.5 h-3.5 text-gray-400" />}
              inputMode="numeric" />

            {/* ── КПП (только юрлицо) ─────────────────────────────── */}
            {settings.entity_type === 'legal' && (
              <Input label="КПП (9 цифр)" placeholder="770001001"
                value={settings.kpp}
                onChange={v => setSettings(s => ({ ...s, kpp: v.replace(/\D/g, '').slice(0, 9) }))}
                icon={<Hash className="w-3.5 h-3.5 text-gray-400" />}
                inputMode="numeric" />
            )}

            {/* ── Куда платить ─────────────────────────────────────── */}
            {settings.entity_type === 'self_employed' && (
              <>
                <div className="pt-2">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Куда платить — карта или СБП
                  </p>
                </div>
                <Input label="Номер карты"
                  placeholder="1234 5678 9012 3456"
                  value={formatCardNumber(settings.card_number)}
                  onChange={v => setSettings(s => ({ ...s, card_number: v.replace(/\D/g, '').slice(0, 19) }))}
                  icon={<CreditCard className="w-3.5 h-3.5 text-gray-400" />}
                  inputMode="numeric" />
                <Input label="или Телефон для СБП"
                  placeholder="+7 999 123 45 67"
                  value={formatPhone(settings.phone_for_sbp)}
                  onChange={v => setSettings(s => ({ ...s, phone_for_sbp: normalizePhone(v) }))}
                  icon={<Phone className="w-3.5 h-3.5 text-gray-400" />}
                  inputMode="numeric" />
                <Input label="Банк" placeholder="Тинькофф"
                  value={settings.card_bank}
                  onChange={v => setSettings(s => ({ ...s, card_bank: v }))}
                  icon={<Banknote className="w-3.5 h-3.5 text-gray-400" />} />
              </>
            )}

            {(settings.entity_type === 'ip' || settings.entity_type === 'legal') && (
              <>
                <div className="pt-2">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Реквизиты расчётного счёта
                  </p>
                </div>
                <Input label="Расчётный счёт (20 цифр)"
                  placeholder="40802810100001234567"
                  value={settings.bank_account}
                  onChange={v => setSettings(s => ({ ...s, bank_account: v.replace(/\D/g, '').slice(0, 20) }))}
                  icon={<Hash className="w-3.5 h-3.5 text-gray-400" />}
                  inputMode="numeric" />
                <Input label="БИК (9 цифр)"
                  placeholder="044525225"
                  value={settings.bank_bic}
                  onChange={v => setSettings(s => ({ ...s, bank_bic: v.replace(/\D/g, '').slice(0, 9) }))}
                  icon={<Hash className="w-3.5 h-3.5 text-gray-400" />}
                  inputMode="numeric" />
                <Input label="Банк" placeholder="Сбербанк"
                  value={settings.card_bank}
                  onChange={v => setSettings(s => ({ ...s, card_bank: v }))}
                  icon={<Banknote className="w-3.5 h-3.5 text-gray-400" />} />
              </>
            )}
          </div>

          <button onClick={handleSaveSettings} disabled={savingSettings}
            className="w-full mt-5 vd-grad text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition vd-shadow-cta disabled:opacity-50">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить реквизиты
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-[#3B5BFF] shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700 leading-relaxed">
            <p className="font-medium text-[#0F2A36] mb-1">Как происходит выплата</p>
            <p>
              Когда твой реферал оплачивает заказ — комиссия попадает в hold-период
              на <b>30 дней</b> (защита от refund). После — становится доступной к выплате.
              Founder переводит ₽ на твою карту вручную 2 раза в месяц. Минимума нет.
            </p>
          </div>
        </div>
      </div>

      {/* Earning detail modal */}
      {selectedLog && (
        <EarningDetailModal
          log={selectedLog}
          enrichment={enrichments.get(selectedLog.id)}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, loading,
}: {
  icon: React.ReactNode; label: string; value: string; loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500 uppercase tracking-wider leading-tight truncate">
          {label}
        </span>
      </div>
      <p className="text-base font-bold tabular-nums text-[#0F2A36]">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : value}
      </p>
    </div>
  );
}

function EarningRow({
  log, enrichment, onClick,
}: {
  log: BonusLogEntry;
  enrichment: Enrichment | undefined;
  onClick: () => void;
}) {
  const isPending = log.type === 'partner_pending';
  const parsed = parseDedupe(log.dedupe_key);
  const fallbackService = parsed?.service;
  const title = buildEarningTitle(enrichment, fallbackService);
  const subtitle = buildEarningSubtitle(enrichment);
  const flag = countryFlag(enrichment?.country);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-gray-50/50 active:bg-gray-100/50 -mx-2 px-2 rounded-lg transition text-left gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="text-xl leading-none shrink-0" aria-hidden>{flag}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#0F2A36] truncate">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <p className={`text-sm font-bold tabular-nums shrink-0 ${isPending ? 'text-amber-600' : 'text-emerald-600'}`}>
        +{log.amount.toLocaleString('ru-RU')}₽
      </p>
    </button>
  );
}

function EarningDetailModal({
  log, enrichment, onClose,
}: { log: BonusLogEntry; enrichment: Enrichment | undefined; onClose: () => void }) {
  // Используем enrichment как источник данных. Если его ещё нет (батч-фетч в parent
  // не успел) — модалка отрисуется с базовой инфой (сумма, статус, дата) без подгрузки.
  const parsed = parseDedupe(log.dedupe_key);
  const sourceType = parsed?.service ?? null;
  const sourceId = parsed?.sourceId ?? null;

  const isPending = log.type === 'partner_pending';
  const created = new Date(log.created_at);
  const willApproveAt = new Date(created.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, HOLD_DAYS - Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));

  const flag = countryFlag(enrichment?.country);
  const sourceLabel = sourceType ? serviceLabel(sourceType) : 'Начисление';
  const titleLine = buildEarningTitle(enrichment, sourceType ?? undefined);
  const subtitleLine = buildEarningSubtitle(enrichment);
  const breakdown = parseCommissionBreakdown(log.description);
  const avgPct = enrichment?.price && enrichment.price > 0
    ? +((log.amount / enrichment.price) * 100).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{sourceLabel}</p>
            <p className="text-base font-bold text-[#0F2A36] truncate mt-0.5 flex items-center gap-2">
              <span className="text-xl">{flag}</span>
              {titleLine}
            </p>
            {subtitleLine && <p className="text-xs text-gray-500 mt-0.5">{subtitleLine}</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition" aria-label="Закрыть">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Big amount */}
        <div className={`px-5 py-5 ${isPending ? 'bg-amber-50' : 'bg-emerald-50'} border-b border-gray-100`}>
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">Ваша комиссия</p>
          <p className={`text-[36px] font-bold tabular-nums leading-none mt-1 ${isPending ? 'text-amber-700' : 'text-emerald-700'}`}>
            +{log.amount.toLocaleString('ru-RU')}₽
          </p>
          {enrichment?.price !== undefined && avgPct !== null && (
            <p className="text-xs text-gray-500 mt-2">
              средний {avgPct}% от {enrichment.price.toLocaleString('ru-RU')}₽
            </p>
          )}
        </div>

        {/* Commission breakdown — если description содержит разбивку */}
        {breakdown.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Разбивка</p>
            <div className="space-y-1.5">
              {breakdown.map((p, i) => (
                <div key={i} className="flex items-baseline justify-between text-sm">
                  <span className="text-[#0F2A36]">{p.label}</span>
                  <span className="text-gray-500 tabular-nums text-xs">
                    {p.price.toLocaleString('ru-RU')}₽ × {p.pct}%
                    <span className="ml-2 text-emerald-700 font-medium">= {p.amount}₽</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {enrichment?.price !== undefined && (
            <DetailRow label="Стоимость заказа" value={`${enrichment.price.toLocaleString('ru-RU')}₽`} />
          )}
          <DetailRow
            label="Статус"
            value={isPending
              ? <span className="text-amber-700">В hold-периоде</span>
              : <span className="text-emerald-700">Доступно к выплате</span>}
          />
          <DetailRow
            label="Дата начисления"
            value={created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
          {isPending && (
            <DetailRow
              label="Approved будет"
              value={`${willApproveAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} (через ${daysLeft}д)`}
            />
          )}
          {sourceId && (
            <DetailRow
              label="ID заявки"
              value={<code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{sourceId.slice(0, 8)}…</code>}
            />
          )}
        </div>

        {/* Bottom info */}
        {isPending && (
          <div className="px-5 py-3 bg-blue-50/50 border-t border-blue-100 text-[11px] text-gray-700 leading-relaxed">
            💡 Hold-период — это защита от refund. Если клиент отменит заказ в течение 30 дней,
            комиссия будет аннулирована. После 30 дней — деньги ваши.
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-[#0F2A36] text-right">{value}</span>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, icon, inputMode,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ReactNode;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</div>}
        <input
          type="text" inputMode={inputMode}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF]`}
        />
      </div>
    </div>
  );
}
