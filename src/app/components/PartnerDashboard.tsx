// Premium-партнёрский кабинет (отдельный экран для is_influencer=true).
// Доступен через CTA «Открыть кабинет» из ReferralsTab.
//
// Что показывает:
//   1. Hero — текущий partner_balance (₽ к выплате)
//   2. 3 карточки — pending hold / approved за месяц / выплачено всего
//   3. Свежие начисления (mix pending + approved) с countdown до approve
//   4. История выплат
//   5. Реквизиты партнёра (форма редактирования)
//
// Data flow: всё через supabase anon-key (миграция 018 открыла anon-доступ
// к partner_payouts + partner_settings). Записи в bonus_logs тоже anon-read
// доступны (RLS на bonus_logs не закрывает self-чтение).

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, Wallet, Clock, Check, CreditCard, FileText, Loader2,
  Save, AlertCircle, Crown,
} from 'lucide-react';
import { useTelegram } from '../App';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface PartnerDashboardProps {
  onBack: () => void;
}

const HOLD_DAYS = 30;

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
  full_name: '',
  inn: '',
  card_number_last4: '',
  card_bank: '',
  entity_type: '',
  agreement_accepted_at: null,
};

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'В обработке', cls: 'bg-amber-100 text-amber-700' },
  processed: { label: 'Выплачено',   cls: 'bg-emerald-100 text-emerald-700' },
  failed:    { label: 'Ошибка',      cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Отменена',    cls: 'bg-gray-100 text-gray-700' },
};

const ENTITY_LABEL: Record<PartnerSettings['entity_type'], string> = {
  individual: 'Физлицо',
  self_employed: 'Самозанятый',
  ip: 'ИП',
  '': '',
};

export default function PartnerDashboard({ onBack }: PartnerDashboardProps) {
  const { appUser } = useTelegram();
  const telegramId = appUser?.telegram_id ?? 0;
  const partnerBalance = appUser?.partner_balance ?? 0;

  const [logs, setLogs] = useState<BonusLogEntry[]>([]);
  const [payouts, setPayouts] = useState<PayoutEntry[]>([]);
  const [settings, setSettings] = useState<PartnerSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!telegramId || !isSupabaseConfigured()) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [logsRes, payoutsRes, settingsRes] = await Promise.all([
          supabase
            .from('bonus_logs')
            .select('id, type, amount, description, dedupe_key, created_at')
            .eq('telegram_id', telegramId)
            .like('type', 'partner_%')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('partner_payouts')
            .select('id, amount_rub, status, card_last4, note, processed_at, created_at')
            .eq('telegram_id', telegramId)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('partner_settings')
            .select('*')
            .eq('telegram_id', telegramId)
            .maybeSingle(),
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

  // Computed аналитика
  const pendingHold = useMemo(
    () => logs.filter(l => l.type === 'partner_pending').reduce((s, l) => s + l.amount, 0),
    [logs],
  );
  const approvedThisMonth = useMemo(() => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs
      .filter(l => l.type === 'partner_approved' && new Date(l.created_at).getTime() >= monthAgo)
      .reduce((s, l) => s + l.amount, 0);
  }, [logs]);
  const totalPaid = useMemo(
    () => Math.abs(logs.filter(l => l.type === 'partner_paid').reduce((s, l) => s + l.amount, 0)),
    [logs],
  );

  // Свежие начисления — pending + approved в одном списке, отсортированы по дате
  const recentEarnings = useMemo(
    () => logs.filter(l => l.type === 'partner_pending' || l.type === 'partner_approved').slice(0, 10),
    [logs],
  );

  const handleSaveSettings = async () => {
    if (!telegramId || !isSupabaseConfigured()) return;
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const payload = {
        telegram_id: telegramId,
        full_name: settings.full_name.trim() || null,
        inn: settings.inn.trim() || null,
        card_number_last4: settings.card_number_last4.trim() || null,
        card_bank: settings.card_bank.trim() || null,
        entity_type: settings.entity_type || null,
      };
      // upsert — INSERT при первом сохранении, UPDATE дальше
      const { error } = await supabase.from('partner_settings').upsert(payload, { onConflict: 'telegram_id' });
      if (error) throw error;
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (e) {
      console.error('save settings:', e);
      alert('Не удалось сохранить реквизиты. Попробуй ещё раз.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      {/* Header */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
            aria-label="Назад"
          >
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

        {/* 3-card stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Clock className="w-3.5 h-3.5 text-amber-600" />}
            label="В hold-периоде"
            value={`${pendingHold.toLocaleString('ru-RU')}₽`}
            loading={loading}
          />
          <StatCard
            icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
            label="За 30 дней"
            value={`${approvedThisMonth.toLocaleString('ru-RU')}₽`}
            loading={loading}
          />
          <StatCard
            icon={<Wallet className="w-3.5 h-3.5 text-[#3B5BFF]" />}
            label="Выплачено"
            value={`${totalPaid.toLocaleString('ru-RU')}₽`}
            loading={loading}
          />
        </div>

        {/* Recent earnings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3">
            Свежие начисления
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Загружаем…
            </div>
          ) : recentEarnings.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              Пока нет начислений. Когда твой реферал оплатит первый заказ —
              увидишь его здесь.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentEarnings.map(l => <EarningRow key={l.id} log={l} />)}
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
            <Input
              label="ФИО полностью"
              placeholder="Иванов Иван Иванович"
              value={settings.full_name}
              onChange={v => setSettings(s => ({ ...s, full_name: v }))}
              icon={<FileText className="w-3.5 h-3.5 text-gray-400" />}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Карта (последние 4)"
                placeholder="6411"
                value={settings.card_number_last4}
                onChange={v => setSettings(s => ({ ...s, card_number_last4: v.replace(/\D/g, '').slice(0, 4) }))}
                icon={<CreditCard className="w-3.5 h-3.5 text-gray-400" />}
                inputMode="numeric"
              />
              <Input
                label="Банк"
                placeholder="Тинькофф"
                value={settings.card_bank}
                onChange={v => setSettings(s => ({ ...s, card_bank: v }))}
              />
            </div>

            <Input
              label="ИНН (для самозанятых)"
              placeholder="770000000000"
              value={settings.inn}
              onChange={v => setSettings(s => ({ ...s, inn: v.replace(/\D/g, '').slice(0, 12) }))}
              inputMode="numeric"
            />

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
                  💡 Чек самозанятого после выплаты пришлёшь нам через приложение
                  «Мой налог» — это твоя обязанность по 422-ФЗ.
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="w-full mt-5 vd-grad text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition vd-shadow-cta disabled:opacity-50"
          >
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить реквизиты
          </button>
        </div>

        {/* Info block */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-[#3B5BFF] shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700 leading-relaxed">
            <p className="font-medium text-[#0F2A36] mb-1">Как происходит выплата</p>
            <p>
              Когда твой реферал оплачивает заказ — комиссия попадает в hold-период
              на <b>30 дней</b> (защита от refund). После — становится доступной
              к выплате. Founder переводит ₽ на твою карту вручную 2 раза в месяц.
              Минимума нет — выводим даже 100₽ если попросишь.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
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

function EarningRow({ log }: { log: BonusLogEntry }) {
  const isPending = log.type === 'partner_pending';
  const created = new Date(log.created_at);
  const dateStr = created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  // Computed: сколько дней осталось до approve (если pending)
  const daysLeft = isPending
    ? Math.max(0, HOLD_DAYS - Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#0F2A36] truncate">
          {log.description || (isPending ? 'Начисление в hold' : 'Approved')}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">{dateStr}</span>
          {isPending && (
            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {daysLeft === 0 ? 'почти готово' : `${daysLeft} дн до approve`}
            </span>
          )}
          {!isPending && (
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              К выплате
            </span>
          )}
        </div>
      </div>
      <div className="text-right ml-3 shrink-0">
        <p className={`text-sm font-bold tabular-nums ${isPending ? 'text-amber-600' : 'text-emerald-600'}`}>
          +{log.amount.toLocaleString('ru-RU')}₽
        </p>
      </div>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, icon, inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</div>
        )}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF]`}
        />
      </div>
    </div>
  );
}

