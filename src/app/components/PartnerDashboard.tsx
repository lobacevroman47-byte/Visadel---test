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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, Wallet, Clock, Check, CreditCard, FileText, Loader2,
  Save, AlertCircle, Crown, X, Copy, Link as LinkIcon, Sparkles,
} from 'lucide-react';
import { useTelegram } from '../App';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PartnerDashboardProps {
  onBack: () => void;
}

const HOLD_DAYS = 30;

// Зарезервированные слова — не дать партнёру vanity, ломающий deeplinks
const RESERVED_VANITY = new Set([
  'admin', 'partner', 'referrals', 'applications',
  'booking_hotel', 'booking_flight', 'partner_dashboard',
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

// Выпарсить страну из description: «Партнёрская комиссия 15% × 2490₽ за визу Шри-Ланки»
function parseCountryFromDescription(d: string): string | null {
  // Ищем "за визу <Страна>" или "за бронь <отеля> в <Страна>"
  const visa = d.match(/за визу\s+([А-ЯЁA-Z][^.,)]*)/i);
  if (visa) return visa[1].trim().replace(/[.,;]+$/, '');
  return null;
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

interface PartnerSettings {
  full_name: string;
  inn: string;
  card_number_last4: string;
  card_bank: string;
  entity_type: 'individual' | 'self_employed' | 'ip' | '';
  agreement_accepted_at: string | null;
}

const DEFAULT_SETTINGS: PartnerSettings = {
  full_name: '', inn: '', card_number_last4: '', card_bank: '', entity_type: '',
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
  const [payouts, setPayouts] = useState<PayoutEntry[]>([]);
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_SETTINGS);
  const [vanity, setVanity] = useState(appUser?.vanity_code ?? '');
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
        const [logsRes, payoutsRes, settingsRes] = await Promise.all([
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
        ]);
        if (cancelled) return;
        setLogs((logsRes.data ?? []) as BonusLogEntry[]);
        setPayouts((payoutsRes.data ?? []) as PayoutEntry[]);
        if (settingsRes.data) {
          const s = settingsRes.data as Partial<PartnerSettings> & { entity_type: string | null };
          setSettings({
            full_name: s.full_name ?? '',
            inn: s.inn ?? '',
            card_number_last4: s.card_number_last4 ?? '',
            card_bank: s.card_bank ?? '',
            entity_type: (s.entity_type as PartnerSettings['entity_type']) ?? '',
            agreement_accepted_at: s.agreement_accepted_at ?? null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [telegramId]);

  // Статистика
  const pendingHold = useMemo(
    () => logs.filter(l => l.type === 'partner_pending').reduce((s, l) => s + l.amount, 0),
    [logs],
  );
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

  // Все начисления (pending + approved), не выплаты — сортировка по дате
  const earnings = useMemo(
    () => logs.filter(l => l.type === 'partner_pending' || l.type === 'partner_approved'),
    [logs],
  );

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
      const payload = {
        telegram_id: telegramId,
        full_name: settings.full_name.trim() || null,
        inn: settings.inn.trim() || null,
        card_number_last4: settings.card_number_last4.trim() || null,
        card_bank: settings.card_bank.trim() || null,
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
                <EarningRow key={l.id} log={l} onClick={() => setSelectedLog(l)} />
              ))}
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
            <Input label="ФИО полностью" placeholder="Иванов Иван Иванович"
              value={settings.full_name}
              onChange={v => setSettings(s => ({ ...s, full_name: v }))}
              icon={<FileText className="w-3.5 h-3.5 text-gray-400" />} />

            <div className="grid grid-cols-2 gap-2">
              <Input label="Карта (последние 4)" placeholder="6411"
                value={settings.card_number_last4}
                onChange={v => setSettings(s => ({ ...s, card_number_last4: v.replace(/\D/g, '').slice(0, 4) }))}
                icon={<CreditCard className="w-3.5 h-3.5 text-gray-400" />}
                inputMode="numeric" />
              <Input label="Банк" placeholder="Тинькофф"
                value={settings.card_bank}
                onChange={v => setSettings(s => ({ ...s, card_bank: v }))} />
            </div>

            <Input label="ИНН (для самозанятых)" placeholder="770000000000"
              value={settings.inn}
              onChange={v => setSettings(s => ({ ...s, inn: v.replace(/\D/g, '').slice(0, 12) }))}
              inputMode="numeric" />

            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                Налоговый статус
              </label>
              <select
                value={settings.entity_type}
                onChange={e => setSettings(s => ({ ...s, entity_type: e.target.value as PartnerSettings['entity_type'] }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#3B5BFF]"
              >
                <option value="">— не указан —</option>
                <option value="individual">Физлицо (без статуса)</option>
                <option value="self_employed">Самозанятый</option>
                <option value="ip">ИП</option>
              </select>
              {settings.entity_type === 'self_employed' && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
                  💡 Чек самозанятого после выплаты пришлёшь нам через приложение «Мой налог» — это твоя обязанность по 422-ФЗ.
                </p>
              )}
            </div>
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
      {selectedLog && <EarningDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
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

function EarningRow({ log, onClick }: { log: BonusLogEntry; onClick: () => void }) {
  const isPending = log.type === 'partner_pending';
  const created = new Date(log.created_at);
  const dateStr = created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const country = parseCountryFromDescription(log.description ?? '');
  const flag = countryFlag(country);

  const daysLeft = isPending
    ? Math.max(0, HOLD_DAYS - Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-gray-50/50 active:bg-gray-100/50 -mx-2 px-2 rounded-lg transition text-left"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <span className="text-2xl mt-0.5 leading-none shrink-0" aria-hidden>{flag}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#0F2A36] truncate">
            {country ?? 'Партнёрское начисление'}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {log.description?.replace(/^.*?за\s+(виз[уаы]|бронь)\s+/i, '').trim() || dateStr}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-gray-400">{dateStr}</span>
            {isPending ? (
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {daysLeft === 0 ? 'почти готово' : `${daysLeft}д до approve`}
              </span>
            ) : (
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                К выплате
              </span>
            )}
          </div>
        </div>
      </div>
      <p className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${isPending ? 'text-amber-600' : 'text-emerald-600'}`}>
        +{log.amount.toLocaleString('ru-RU')}₽
      </p>
    </button>
  );
}

function EarningDetailModal({
  log, onClose,
}: { log: BonusLogEntry; onClose: () => void }) {
  // Парсим dedupe_key: partner_visa_<uuid> | partner_hotel_bookings_<uuid> | partner_flight_bookings_<uuid>
  const sourceMatch = (log.dedupe_key ?? '').match(/^partner_(visa|hotel_bookings|flight_bookings)_(.+)$/);
  const sourceType = sourceMatch?.[1] ?? null;
  const sourceId = sourceMatch?.[2] ?? null;

  const [details, setDetails] = useState<{
    customer_name?: string;
    customer_username?: string | null;
    country?: string;
    visa_type?: string;
    city?: string;
    from_city?: string;
    to_city?: string;
    booking_date?: string;
    price?: number;
    pct?: number;
    status?: string;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const dataLoadedRef = useRef(false);
  useEffect(() => {
    if (dataLoadedRef.current || !sourceType || !sourceId) return;
    dataLoadedRef.current = true;
    (async () => {
      try {
        if (sourceType === 'visa') {
          const { data: app } = await supabase
            .from('applications')
            .select('country, visa_type, price, status, user_telegram_id')
            .eq('id', sourceId)
            .maybeSingle();
          if (app) {
            const a = app as { country: string; visa_type: string; price: number; status: string; user_telegram_id: number };
            // Получим имя клиента
            const { data: user } = await supabase
              .from('users')
              .select('first_name, last_name, username')
              .eq('telegram_id', a.user_telegram_id)
              .maybeSingle();
            const u = user as { first_name?: string; last_name?: string; username?: string | null } | null;
            const initials = [u?.first_name, u?.last_name?.[0] ? `${u.last_name[0]}.` : ''].filter(Boolean).join(' ');
            setDetails({
              customer_name: initials || 'Аноним',
              customer_username: u?.username ?? null,
              country: a.country,
              visa_type: a.visa_type,
              price: a.price,
              status: a.status,
            });
          }
        } else if (sourceType === 'hotel_bookings' || sourceType === 'flight_bookings') {
          const { data: b } = await supabase
            .from(sourceType)
            .select('*')
            .eq('id', sourceId)
            .maybeSingle();
          if (b) {
            const row = b as Record<string, unknown>;
            setDetails({
              customer_name: [row.first_name, (row.last_name as string)?.[0] ? `${(row.last_name as string)[0]}.` : '']
                .filter(Boolean).join(' ') || 'Аноним',
              customer_username: (row.username as string | null) ?? null,
              country: row.country as string | undefined,
              city: row.city as string | undefined,
              from_city: row.from_city as string | undefined,
              to_city: row.to_city as string | undefined,
              booking_date: row.booking_date as string | undefined,
              price: row.price as number | undefined,
              pct: row.partner_commission_pct as number | undefined,
              status: row.status as string | undefined,
            });
          }
        }
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [sourceType, sourceId]);

  const isPending = log.type === 'partner_pending';
  const created = new Date(log.created_at);
  const willApproveAt = new Date(created.getTime() + HOLD_DAYS * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, HOLD_DAYS - Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)));

  const flag = countryFlag(details?.country);
  const sourceLabel = sourceType === 'visa' ? 'Виза'
                    : sourceType === 'hotel_bookings' ? 'Бронь отеля'
                    : sourceType === 'flight_bookings' ? 'Бронь авиабилета'
                    : 'Начисление';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{sourceLabel}</p>
            <p className="text-base font-bold text-[#0F2A36] truncate mt-0.5 flex items-center gap-2">
              <span className="text-xl">{flag}</span>
              {details?.country ?? 'Партнёрское начисление'}
            </p>
            {details?.visa_type && <p className="text-xs text-gray-500 mt-0.5">{details.visa_type}</p>}
            {details?.city && <p className="text-xs text-gray-500 mt-0.5">📍 {details.city}</p>}
            {details?.from_city && details?.to_city && (
              <p className="text-xs text-gray-500 mt-0.5">✈️ {details.from_city} → {details.to_city}</p>
            )}
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
          {details?.price && (
            <p className="text-xs text-gray-500 mt-2">
              {Math.round((log.amount / details.price) * 100)}% от стоимости заказа{' '}
              {details.price.toLocaleString('ru-RU')}₽
            </p>
          )}
        </div>

        {/* Details */}
        <div className="px-5 py-4 space-y-3">
          {detailLoading ? (
            <div className="flex items-center justify-center py-4 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Загружаем детали…
            </div>
          ) : (
            <>
              {details?.customer_name && (
                <DetailRow label="Клиент" value={
                  <>
                    {details.customer_name}
                    {details.customer_username && (
                      <span className="text-[#3B5BFF] ml-1">@{details.customer_username}</span>
                    )}
                  </>
                } />
              )}
              {details?.price !== undefined && (
                <DetailRow label="Стоимость заказа" value={`${details.price.toLocaleString('ru-RU')}₽`} />
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
            </>
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
