// Форма заявки на партнёрство. Дизайн в стиле мини-аппа (PartnerDashboard,
// ApplicationForm) — sticky brand-header, white-cards с rounded-2xl,
// vd-grad для CTA, иконки lucide для каждого поля.
//
// Flow:
//   1. Юзер заполняет форму
//   2. INSERT в partner_applications (anon RLS-policy открыта)
//   3. POST /api/notify-admin event=partner_application — Telegram-бот
//      шлёт всем founder/admin кнопку «Открыть админку»
//   4. Юзер видит экран статуса (pending) — данные подтягиваются из БД
//      по telegram_id, не из localStorage (был старый паттерн)
//
// Approve/reject делает админ в админке → /admin/partner-applications.
// При approve: users.is_influencer=true → юзер сразу попадает в
// Партнёрский кабинет.

import { useEffect, useState } from 'react';
import {
  ChevronLeft, Send, CheckCircle2, XCircle, Clock, Crown,
  User as UserIcon, AtSign, Mail, Phone, LinkIcon, Tags, Users,
  MessageSquare, Loader2, AlertCircle,
} from 'lucide-react';
import { useTelegram } from '../App';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/apiFetch';
import { HeaderActions } from './HeaderActions';

interface PartnerApplicationFormProps {
  onBack: () => void;
  onSubmit: () => void;
}

interface Application {
  id: string;
  telegram_id: number | null;
  full_name: string;
  telegram_username: string;
  email: string;
  phone: string | null;
  platform_url: string;
  audience_theme: string | null;
  subscribers_count: number | null;
  comment: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string;
}

export default function PartnerApplicationForm({ onBack, onSubmit }: PartnerApplicationFormProps) {
  const { appUser } = useTelegram();
  const telegramId = appUser?.telegram_id ?? 0;

  const [existingApp, setExistingApp] = useState<Application | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const [formData, setFormData] = useState({
    full_name: '',
    telegram_username: appUser?.username ?? '',
    email: '',
    phone: '',
    platform_url: '',
    audience_theme: '',
    subscribers_count: '',
    comment: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Подгружаем последнюю заявку юзера из БД (если она есть)
  useEffect(() => {
    if (!telegramId || !isSupabaseConfigured()) { setLoadingExisting(false); return; }
    (async () => {
      const { data } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExistingApp(data as Application);
      setLoadingExisting(false);
    })();
  }, [telegramId]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Укажите ФИО';
    if (!formData.telegram_username.trim()) newErrors.telegram_username = 'Укажите Telegram @username';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Укажите корректный email';
    if (!formData.platform_url.trim() || !/^https?:\/\//.test(formData.platform_url)) {
      newErrors.platform_url = 'Укажите полную ссылку (https://…)';
    }
    if (!formData.agreeToTerms) newErrors.agreeToTerms = 'Необходимо согласие с условиями';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!isSupabaseConfigured()) {
      alert('Supabase не настроен — невозможно отправить заявку.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        telegram_id: telegramId || null,
        full_name: formData.full_name.trim(),
        telegram_username: formData.telegram_username.replace(/^@/, '').trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        platform_url: formData.platform_url.trim(),
        audience_theme: formData.audience_theme.trim() || null,
        subscribers_count: formData.subscribers_count ? parseInt(formData.subscribers_count, 10) : null,
        comment: formData.comment.trim() || null,
        status: 'pending' as const,
      };

      const { data, error } = await supabase
        .from('partner_applications')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // Notify admin via Telegram bot (best-effort)
      apiFetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'partner_application',
          full_name: payload.full_name,
          telegram_username: payload.telegram_username,
          email: payload.email,
          phone: payload.phone,
          platform_url: payload.platform_url,
          audience_theme: payload.audience_theme,
          subscribers_count: payload.subscribers_count,
          comment: payload.comment,
        }),
      }).catch(e => console.warn('notify-admin (partner_application) error:', e));

      setExistingApp(data as Application);
    } catch (e) {
      console.error('partner_applications insert:', e);
      alert(`Не удалось отправить заявку: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#3B5BFF]" />
      </div>
    );
  }

  // ── Если уже есть заявка — показываем статус ─────────────────────────────
  if (existingApp) {
    return <ApplicationStatusView app={existingApp} onBack={onBack} onResubmit={() => setExistingApp(null)} />;
  }

  // ── Форма ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      {/* Sticky brand header */}
      <div className="bg-white sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95 shrink-0" aria-label="Назад">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 min-w-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[#0F2A36] font-extrabold text-[16px] tracking-tight truncate">VISADEL</span>
            </div>
          </div>
          <HeaderActions />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Hero — что даёт партнёрство */}
        <div className="vd-grad rounded-2xl p-6 text-white shadow-lg vd-shadow-cta">
          <p className="text-[11px] font-medium text-white/70 uppercase tracking-wider mb-2">
            Партнёрская программа
          </p>
          <p className="text-xl font-bold leading-tight">
            До 20% с каждого заказа реферала
          </p>
          <p className="text-sm text-white/80 mt-3 leading-relaxed">
            Реальные ₽ на карту, без скидочных бонусов. Hold 30 дней — защита от refund.
            Минимума выплат нет.
          </p>
        </div>

        {/* Форма */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Заполни данные
          </p>

          <Field
            label="ФИО"
            required
            icon={<UserIcon className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="Иванов Иван Иванович"
            value={formData.full_name}
            onChange={v => setFormData(s => ({ ...s, full_name: v }))}
            error={errors.full_name}
          />

          <Field
            label="Telegram @username"
            required
            icon={<AtSign className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="username"
            value={formData.telegram_username}
            onChange={v => setFormData(s => ({ ...s, telegram_username: v.replace(/^@/, '') }))}
            error={errors.telegram_username}
          />

          <Field
            label="Email"
            required
            type="email"
            icon={<Mail className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="example@mail.com"
            value={formData.email}
            onChange={v => setFormData(s => ({ ...s, email: v }))}
            error={errors.email}
          />

          <Field
            label="Номер телефона"
            hint="желательно"
            type="tel"
            icon={<Phone className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="+7 (999) 123-45-67"
            value={formData.phone}
            onChange={v => setFormData(s => ({ ...s, phone: v }))}
          />

          <Field
            label="Ссылка на основную площадку"
            required
            type="url"
            icon={<LinkIcon className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="https://instagram.com/username"
            value={formData.platform_url}
            onChange={v => setFormData(s => ({ ...s, platform_url: v }))}
            error={errors.platform_url}
          />

          <Field
            label="Тематика аудитории"
            icon={<Tags className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="Путешествия, лайфстайл, образование…"
            value={formData.audience_theme}
            onChange={v => setFormData(s => ({ ...s, audience_theme: v }))}
          />

          <Field
            label="Примерное количество подписчиков"
            inputMode="numeric"
            icon={<Users className="w-3.5 h-3.5 text-gray-400" />}
            placeholder="10000"
            value={formData.subscribers_count}
            onChange={v => setFormData(s => ({ ...s, subscribers_count: v.replace(/\D/g, '') }))}
          />

          <div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Комментарий
              <span className="text-gray-400 normal-case font-normal text-[10px]">опционально</span>
            </label>
            <textarea
              rows={3}
              value={formData.comment}
              onChange={e => setFormData(s => ({ ...s, comment: e.target.value }))}
              placeholder="Расскажи о себе и почему хочешь стать партнёром…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#3B5BFF] resize-none"
            />
          </div>

          {/* Agreement */}
          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={formData.agreeToTerms}
              onChange={e => setFormData(s => ({ ...s, agreeToTerms: e.target.checked }))}
              className="mt-0.5 w-4 h-4 text-[#3B5BFF] rounded focus:ring-[#3B5BFF]"
            />
            <span className={`text-xs leading-relaxed ${errors.agreeToTerms ? 'text-rose-600' : 'text-gray-700'}`}>
              Согласен с условиями партнёрской программы и обязуюсь соблюдать правила сотрудничества.
              <span className="text-rose-500 ml-1">*</span>
            </span>
          </label>

          {/* CTA */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full vd-grad text-white py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition vd-shadow-cta disabled:opacity-60 mt-3"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Отправить заявку
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-[#3B5BFF] shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700 leading-relaxed">
            <p className="font-medium text-[#0F2A36] mb-1">Что дальше</p>
            <p>
              Мы получим уведомление, посмотрим аудиторию и в течение 1–3 дней свяжемся с тобой
              в Telegram. После одобрения откроется Партнёрский кабинет с твоей реф-ссылкой и реквизитами для выплат.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status view (после отправки) ────────────────────────────────────────────

function ApplicationStatusView({
  app, onBack, onResubmit,
}: { app: Application; onBack: () => void; onResubmit: () => void }) {
  const config = {
    pending:  { Icon: Clock,         color: 'amber',   title: 'На рассмотрении', message: 'Заявка получена. Мы посмотрим аудиторию и свяжемся в Telegram в течение 1–3 дней.' },
    approved: { Icon: CheckCircle2,  color: 'emerald', title: 'Одобрено',        message: 'Поздравляем! Ты теперь партнёр Visadel. Закрой это окно и зайди в Профиль → Партнёрский кабинет.' },
    rejected: { Icon: XCircle,       color: 'rose',    title: 'Отклонено',       message: app.reject_reason ?? 'К сожалению, мы не одобрили твою заявку. Можешь подать новую через 7 дней.' },
  }[app.status];
  const { Icon } = config;
  const colorClasses = {
    amber:   'text-amber-600 bg-amber-50 border-amber-200',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    rose:    'text-rose-600 bg-rose-50 border-rose-200',
  }[config.color] ?? '';

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-10">
      <div className="bg-white sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 pt-3 pb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={onBack} className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95 shrink-0" aria-label="Назад">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 min-w-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[#0F2A36] font-extrabold text-[16px] tracking-tight truncate">VISADEL</span>
            </div>
          </div>
          <HeaderActions />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div className={`rounded-2xl border p-6 ${colorClasses}`}>
          <Icon className="w-10 h-10" />
          <h2 className="text-xl font-bold mt-3">{config.title}</h2>
          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{config.message}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">
            Детали заявки
          </p>
          <DetailLine label="ФИО" value={app.full_name} />
          <DetailLine label="Telegram" value={`@${app.telegram_username}`} />
          <DetailLine label="Email" value={app.email} />
          {app.phone && <DetailLine label="Телефон" value={app.phone} />}
          <DetailLine label="Площадка" value={
            <a href={app.platform_url} target="_blank" rel="noopener noreferrer" className="text-[#3B5BFF] underline truncate">
              {app.platform_url}
            </a>
          } />
          {app.audience_theme && <DetailLine label="Тематика" value={app.audience_theme} />}
          {app.subscribers_count !== null && <DetailLine label="Подписчики" value={app.subscribers_count.toLocaleString('ru-RU')} />}
          <DetailLine label="Дата подачи" value={new Date(app.created_at).toLocaleDateString('ru-RU')} />
        </div>

        {app.status === 'rejected' && (
          <button
            onClick={onResubmit}
            className="w-full vd-grad text-white py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition vd-shadow-cta"
          >
            <Send className="w-4 h-4" /> Подать новую заявку
          </button>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function Field({
  label, required, hint, type, inputMode, icon, placeholder, value, onChange, error,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  inputMode?: 'numeric' | 'text';
  icon?: React.ReactNode;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {hint && <span className="text-gray-400 normal-case font-normal text-[10px] ml-1">{hint}</span>}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</div>}
        <input
          type={type ?? 'text'}
          inputMode={inputMode}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 border rounded-xl text-sm focus:outline-none ${
            error ? 'border-rose-400 focus:border-rose-500' : 'border-gray-200 focus:border-[#3B5BFF]'
          }`}
        />
      </div>
      {error && <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" /> {error}
      </p>}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-[#0F2A36] text-right break-all">{value}</span>
    </div>
  );
}
