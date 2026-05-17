import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, User, Plane, Mail, Phone, Send, Upload, Loader2, FileText, X, MapPin, Calendar, CreditCard, Copy, Sparkles, Check, Save } from 'lucide-react';
import { uploadFile } from '../lib/db';
import { isSupabaseConfigured } from '../lib/supabase';
import BookingExtraField from './booking/BookingExtraField';
import DateInput from './shared/DateInput';
import SuccessScreen from './shared/SuccessScreen';
import LatinNotice from './shared/LatinNotice';
import { apiFetch } from '../lib/apiFetch';
import { secureStorage } from '../lib/secureStorage';
import {
  showBackButton, hideBackButton,
  enableClosingConfirmation, disableClosingConfirmation,
  haptic,
} from '../lib/telegram';
import { useBookingProduct, resolveFieldOverride } from '../hooks/useBookingProduct';
import { Button } from './ui/brand';

interface FlightBookingFormProps {
  onBack: () => void;
  onComplete: () => void;
  onGoToProfile?: () => void;
}

export default function FlightBookingForm({ onBack, onComplete, onGoToProfile }: FlightBookingFormProps) {
  // Restore draft on first render. SYNC через localStorage (для быстрого UX —
  // ничего не показываем пустым, потом async upgrade из TG CloudStorage если
  // там более свежие данные).
  // P1-5: secureStorage предпочитает TG CloudStorage — там данные не достанет
  // Stored XSS через localStorage.getItem('flight_booking_draft').
  const localDraft = (() => {
    try {
      const raw = localStorage.getItem('flight_booking_draft');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  // Passenger (Latin, as in passport)
  const [firstName, setFirstName] = useState<string>(localDraft?.firstName ?? '');
  const [lastName, setLastName] = useState<string>(localDraft?.lastName ?? '');

  // Trip
  const [fromCity, setFromCity] = useState<string>(localDraft?.fromCity ?? '');
  const [toCity, setToCity] = useState<string>(localDraft?.toCity ?? '');
  const [bookingDate, setBookingDate] = useState<string>(localDraft?.bookingDate ?? '');

  // Contacts (mirror visa form)
  const [email, setEmail] = useState<string>(localDraft?.email ?? '');
  const [phone, setPhone] = useState<string>(localDraft?.phone ?? '');
  const [telegramLogin, setTelegramLogin] = useState<string>(localDraft?.telegramLogin ?? '');

  // Passport file
  const [passport, setPassport] = useState<File | null>(null);

  // Payment
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [cardCopied, setCardCopied] = useState(false);

  // Все настройки бронь-аддона из единого источника
  // Scope='standalone' — отдельная сущность от visa-аддона (миграция 027).
  const product = useBookingProduct('flight', 'standalone');
  const price = product.price;
  const cardNumber = product.cardNumber;
  const cardHolder = product.cardHolder;
  const extraFields = product.extraFields;
  const overrides = product.overrides;
  const ov = (key: string, fallbackLabel: string, fallbackRequired: boolean) =>
    resolveFieldOverride(overrides, key, fallbackLabel, fallbackRequired);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});

  // Telegram BackButton + closing confirmation
  useEffect(() => {
    enableClosingConfirmation();
    showBackButton(onBack);
    return () => {
      hideBackButton(onBack);
      disableClosingConfirmation();
    };
  }, [onBack]);

  // P1-5: на mount пробуем подтянуть свежий draft из TG CloudStorage.
  // Если localDraft уже есть (из localStorage) — используется как initial,
  // потом TG-версия может его перезаписать. Если TG-версия идентична — no-op.
  // Если TG нет — fallback на localStorage уже сработал в init выше.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await secureStorage.getItem('flight_booking_draft');
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        // Применяем только если поля заполнены чем-то — не затираем то что юзер
        // уже начал вводить пока шла async загрузка.
        if (parsed.firstName && !firstName) setFirstName(parsed.firstName);
        if (parsed.lastName && !lastName) setLastName(parsed.lastName);
        if (parsed.fromCity && !fromCity) setFromCity(parsed.fromCity);
        if (parsed.toCity && !toCity) setToCity(parsed.toCity);
        if (parsed.bookingDate && !bookingDate) setBookingDate(parsed.bookingDate);
        if (parsed.email && !email) setEmail(parsed.email);
        if (parsed.phone && !phone) setPhone(parsed.phone);
        if (parsed.telegramLogin && !telegramLogin) setTelegramLogin(parsed.telegramLogin);
        if (parsed.extraValues && Object.keys(parsed.extraValues).length > 0) {
          setExtraValues(prev => ({ ...parsed.extraValues, ...prev }));
        }
      } catch (e) {
        console.warn('[flight-draft] secureStorage load failed:', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft с debounce 1s + lastSavedAt трекинг.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // Cron-напоминания расписываем один раз за сессию (как у отеля).
  const remindersScheduled = useRef(false);

  // Собирает JSON черновика из текущего состояния формы.
  const buildDraftJson = useCallback((): string => JSON.stringify({
    firstName, lastName, fromCity, toCity, bookingDate,
    email, phone, telegramLogin, extraValues,
    savedAt: new Date().toISOString(),
  }), [firstName, lastName, fromCity, toCity, bookingDate, email, phone,
       telegramLogin, extraValues]);

  // Ручное сохранение по кнопке Save в шапке.
  const handleManualSave = useCallback(() => {
    void secureStorage.setItem('flight_booking_draft', buildDraftJson())
      .catch(e => console.warn('[flight-draft] manual save failed:', e));
    setLastSavedAt(Date.now());
    haptic('success');
  }, [buildDraftJson]);

  useEffect(() => {
    const anyContent = !!(firstName || lastName || fromCity || toCity || bookingDate ||
      email || phone || telegramLogin);
    if (!anyContent) return;
    const timer = setTimeout(() => {
      // P1-5: пишем через secureStorage (TG CloudStorage если доступен,
      // localStorage fallback). PII не утечёт через Stored XSS на TG-клиенте.
      void secureStorage.setItem('flight_booking_draft', buildDraftJson())
        .catch(e => console.warn('[flight-draft] save failed:', e));
      try {
        setLastSavedAt(Date.now());
        if (!remindersScheduled.current) {
          remindersScheduled.current = true;
          apiFetch('/api/schedule-reminders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              draft_key: 'flight_booking_draft',
              country: '',
              visa_type: '',
              type: 'draft',
            }),
          }).catch(console.error);
        }
      } catch { /* no-op */ }
    }, 1000);
    return () => clearTimeout(timer);
  }, [firstName, lastName, fromCity, toCity, bookingDate, email, phone, telegramLogin, extraValues, buildDraftJson]);

  // UX state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyCard = async () => {
    try { await navigator.clipboard.writeText(cardNumber.replace(/\s/g, '')); } catch { /* no-op */ }
    setCardCopied(true);
    setTimeout(() => setCardCopied(false), 2000);
  };

  const validate = (): string | null => {
    if (!firstName.trim() || !lastName.trim()) return 'Заполните имя и фамилию (как в загранпаспорте)';
    if (!fromCity.trim()) return 'Укажите город вылета';
    if (!toCity.trim()) return 'Укажите город прилёта';
    if (!bookingDate) return 'Укажите дату брони';
    // Защита от прошедших дат — DateInput позволяет ввести вручную, native min только для picker.
    {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(bookingDate) < today) return 'Дата брони не может быть в прошлом';
    }
    if (!email.trim() || !phone.trim() || !telegramLogin.trim()) return 'Заполните все контактные данные';
    // Валидация формата.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'Укажите корректный email';
    if (phone.replace(/\D/g, '').length < 10) return 'Укажите корректный номер телефона (минимум 10 цифр)';
    for (const f of extraFields) {
      if (f.required && !((extraValues[f.id] ?? '').trim())) return `Заполните поле «${f.label}»`;
    }
    if (!passport) return 'Прикрепите скан загранпаспорта';
    if (!paymentScreenshot) return 'Прикрепите скриншот оплаты';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);

    try {
      const [passportUrl, paymentUrl] = await Promise.all([
        passport ? uploadFile(passport, 'photos') : Promise.resolve(null),
        paymentScreenshot ? uploadFile(paymentScreenshot, 'payments') : Promise.resolve(null),
      ]);

      const userData = (() => {
        try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; }
      })();

      // P0-1: save через /api/save-flight-booking — service_key + verified auth.
      // telegram_id / auth_id / referrer_code / status — FORCED на сервере.
      const apiPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        from_city: fromCity.trim(),
        to_city: toCity.trim(),
        booking_date: bookingDate,
        email: email.trim(),
        phone: phone.trim(),
        telegram_login: telegramLogin.trim(),
        passport_url: passportUrl,
        payment_screenshot_url: paymentUrl,
        price,
        extra_fields: Object.keys(extraValues).length > 0 ? extraValues : null,
        username: userData.username ?? null,
      };

      // Для notify-admin сохраним old-style row (для красивого письма админу).
      const row = {
        ...apiPayload,
        telegram_id: userData.telegramId ?? null,
        status: 'pending_confirmation' as const,
      };

      if (isSupabaseConfigured()) {
        try {
          const r = await apiFetch('/api/save-flight-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload),
          });
          if (!r.ok) {
            const txt = await r.text().catch(() => '');
            console.warn('[flight-booking] /api/save-flight-booking failed:', r.status, txt);
          }
        } catch (e) {
          console.warn('[flight-booking] /api/save-flight-booking error:', e);
        }
      }

      try {
        await apiFetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'flight_booking',
            customer_name: `${firstName.trim()} ${lastName.trim()}`,
            details: row,
          }),
        });
      } catch { /* no-op */ }

      // P1-5: чистим обе локации (TG CloudStorage + localStorage)
      void secureStorage.removeItem('flight_booking_draft');

      // Cancel any pending cron-reminders — юзер успешно оплатил.
      apiFetch('/api/cancel-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_key: 'flight_booking_draft' }),
      }).catch(console.error);

      haptic('success');
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      haptic('error');
      setError('Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <SuccessScreen
        title="Заявка отправлена!"
        description="Мы получили вашу заявку на бронь авиабилета и свяжемся в Telegram в течение нескольких часов."
        primaryAction={{ label: 'На главную', onClick: onComplete }}
        secondaryAction={onGoToProfile ? { label: 'Мои брони', onClick: onGoToProfile } : undefined}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight">VISADEL</span>
          </div>
          {/* Индикатор автосохранения + кнопка ручного сохранения черновика */}
          <div className="flex items-center gap-2">
            {lastSavedAt && Date.now() - lastSavedAt < 2500 && (
              <span className="text-[10px] text-emerald-600/80 font-semibold animate-pulse">
                ✓ Сохранено
              </span>
            )}
            <button
              onClick={handleManualSave}
              className="w-11 h-11 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
              title="Сохранить черновик"
              aria-label="Сохранить черновик"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="vd-grad-soft px-5 pt-7 pb-6 max-w-2xl mx-auto">
        <p className="text-center text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">
          ✈️ Анкета
        </p>
        <h1 className="text-center text-[26px] leading-[1.1] tracking-tight font-extrabold text-[#0F2A36] mt-1">
          Бронь авиабилета <br/>
          <span className="vd-grad-text">для визы</span>
        </h1>
        <p className="text-center text-[12px] text-[#0F2A36]/60 mt-3 leading-relaxed">
          Подтверждение, принимаемое посольствами и пограничными службами.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* ── 👤 Пассажир ───────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <User className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Пассажир</h3>
          </div>
          <LatinNotice className="mb-4" />
          <div className="space-y-3">
            {/* firstName/lastName — критичные, всегда отображаются. */}
            {(() => { const f = ov('firstName', 'Имя', true); return (
              <Field label={f.label} required={f.required}>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value.toUpperCase())} placeholder="IVAN" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('lastName', 'Фамилия', true); return (
              <Field label={f.label} required={f.required}>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value.toUpperCase())} placeholder="IVANOV" className="form-input" />
              </Field>
            ); })()}
          </div>
        </section>

        {/* ── ✈️ Маршрут ───────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Plane className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Маршрут</h3>
          </div>
          <div className="space-y-3">
            {(() => { const f = ov('fromCity', 'Из какого города', true); return f.visible && (
              <Field label={f.label} required={f.required} icon={<MapPin className="w-3.5 h-3.5" />}>
                <input type="text" value={fromCity} onChange={e => setFromCity(e.target.value)} placeholder="Москва" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('toCity', 'В какой город', true); return f.visible && (
              <Field label={f.label} required={f.required} icon={<MapPin className="w-3.5 h-3.5" />}>
                <input type="text" value={toCity} onChange={e => setToCity(e.target.value)} placeholder="Стамбул" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('bookingDate', 'Дата брони', true); return f.visible && (
              <Field label={f.label} required={f.required} icon={<Calendar className="w-3.5 h-3.5" />}>
                <DateInput value={bookingDate} min={new Date().toISOString().slice(0, 10)} onChange={setBookingDate} />
              </Field>
            ); })()}
          </div>
        </section>

        {/* ── 📞 Контактные данные (как в визах) ───────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Контактные данные</h3>
          </div>
          <p className="text-xs text-[#0F2A36]/60 mb-4">Свяжемся для уточнения деталей и отправки подтверждения</p>
          <div className="space-y-3">
            {/* email/phone/telegramLogin — критичные контакты, всегда отображаются. */}
            {(() => { const f = ov('email', 'E-mail', true); return (
              <Field label={f.label} required={f.required} icon={<Mail className="w-3.5 h-3.5" />}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@mail.com" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('phone', 'Номер телефона', true); return (
              <Field label={f.label} required={f.required} icon={<Phone className="w-3.5 h-3.5" />}>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('telegramLogin', 'Логин в Telegram', true); return (
              <Field label={f.label} required={f.required} icon={<Send className="w-3.5 h-3.5" />}>
                <input type="text" value={telegramLogin} onChange={e => setTelegramLogin(e.target.value)} placeholder="@username" className="form-input" />
              </Field>
            ); })()}
          </div>
          <div className="mt-3 vd-grad-soft border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-xs text-[#0F2A36]/75">🔒 Данные в безопасности и не передаются третьим лицам</p>
          </div>
        </section>

        {/* ── 📎 Загранпаспорт ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">
              Загранпаспорт <span className="text-red-500">*</span>
            </h3>
          </div>
          {!passport ? (
            <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition text-center">
              <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-[#0F2A36]">Прикрепить скан загранпаспорта</p>
              <p className="text-xs text-[#0F2A36]/55 mt-1">JPG, PNG или PDF · до 10 МБ</p>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) {
                    setError('Файл паспорта больше 10 МБ. Сожми или уменьши скан.');
                    e.target.value = '';
                    return;
                  }
                  setError(null);
                  setPassport(f);
                }}
              />
            </label>
          ) : (
            <div className="vd-grad-soft border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Check className="w-5 h-5 text-[#3B5BFF]" strokeWidth={3} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F2A36] truncate">{passport.name}</p>
                <p className="text-[11px] text-[#0F2A36]/55">{(passport.size / 1024).toFixed(1)} КБ</p>
              </div>
              <button type="button" onClick={() => setPassport(null)}
                className="w-8 h-8 rounded-lg bg-white text-red-500 flex items-center justify-center active:scale-95 transition">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </section>

        {/* ── ✨ Доп. поля от админа ────────────────────────── */}
        {extraFields.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#3B5BFF]" />
              <h3 className="text-sm font-bold text-[#0F2A36]">Дополнительно</h3>
            </div>
            <div className="space-y-3">
              {extraFields.map(f => (
                <Field key={f.id} label={f.label} required={f.required}>
                  <BookingExtraField
                    field={f}
                    value={extraValues[f.id] ?? ''}
                    onChange={v => setExtraValues({ ...extraValues, [f.id]: v })}
                  />
                </Field>
              ))}
            </div>
          </section>
        )}

        {/* ── 💳 Оплата ─────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Оплата</h3>
          </div>

          <div className="vd-grad rounded-xl p-4 text-white shadow-md vd-shadow-cta mb-3">
            <p className="text-[11px] uppercase tracking-widest text-white/80 font-bold">К оплате</p>
            <p className="text-[28px] font-extrabold tracking-tight mt-0.5">{price.toLocaleString('ru-RU')} ₽</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 mb-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2A36]/55 mb-1">Перевод по карте</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-mono font-bold text-[#0F2A36] tracking-wider">{cardNumber}</p>
              <button type="button" onClick={copyCard}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-[#3B5BFF] hover:bg-[#EAF1FF] transition active:scale-95 flex items-center gap-1 shrink-0">
                {cardCopied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2.5} />}
                {cardCopied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            {cardHolder && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2A36]/55 mb-0.5">Получатель</p>
                <p className="text-sm font-semibold text-[#0F2A36]">{cardHolder}</p>
              </div>
            )}
          </div>

          <p className="text-xs font-semibold text-[#0F2A36]/70 mb-2">Скриншот оплаты <span className="text-red-500">*</span></p>
          {!paymentScreenshot ? (
            <label className="block border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-[#5C7BFF] hover:bg-[#EAF1FF] transition text-center">
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-[#0F2A36]">Загрузить скриншот платежа</p>
              <p className="text-xs text-[#0F2A36]/55 mt-1">JPG или PNG · до 5 МБ</p>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 5 * 1024 * 1024) { setError('Файл больше 5 МБ'); return; }
                  if (f) setPaymentScreenshot(f);
                }}
              />
            </label>
          ) : (
            <div className="vd-grad-soft border border-blue-100 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                <Check className="w-5 h-5 text-[#3B5BFF]" strokeWidth={3} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F2A36] truncate">{paymentScreenshot.name}</p>
                <p className="text-[11px] text-[#0F2A36]/55">{(paymentScreenshot.size / 1024).toFixed(1)} КБ</p>
              </div>
              <button type="button" onClick={() => setPaymentScreenshot(null)}
                className="w-8 h-8 rounded-lg bg-white text-red-500 flex items-center justify-center active:scale-95 transition">
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          shape="rounded"
          className="!py-4 !rounded-2xl !font-bold"
          disabled={submitting}
          loading={submitting}
        >
          {submitting ? 'Отправляем…' : 'Оплатил — отправить заявку'}
        </Button>

        {/* .vd-input now lives globally in src/styles/globals.css */}
      </form>
    </div>
  );
}

function Field({ label, required, icon, children }: {
  label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-semibold text-[#0F2A36]/70 mb-1.5">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
