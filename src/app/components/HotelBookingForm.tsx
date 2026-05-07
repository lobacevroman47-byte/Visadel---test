import { useState, useEffect } from 'react';
import { ChevronLeft, User, Plane, Mail, Phone, Send, Upload, Check, Loader2, FileText, Plus, Minus, X, CreditCard, Copy, Sparkles } from 'lucide-react';
import { uploadFile } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import BookingExtraField from './booking/BookingExtraField';
import DateInput from './shared/DateInput';
import { apiFetch } from '../lib/apiFetch';
import {
  showBackButton, hideBackButton,
  enableClosingConfirmation, disableClosingConfirmation,
  haptic,
} from '../lib/telegram';
import { useBookingProduct, resolveFieldOverride } from '../hooks/useBookingProduct';

interface HotelBookingFormProps {
  onBack: () => void;
  onComplete: () => void;
}

interface ChildEntry { id: string; age: string; }

export default function HotelBookingForm({ onBack, onComplete }: HotelBookingFormProps) {
  // Restore draft from localStorage (if any) on first render
  const draft = (() => {
    try {
      const raw = localStorage.getItem('hotel_booking_draft');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  // Personal
  const [firstName, setFirstName] = useState<string>(draft?.firstName ?? '');
  const [lastName, setLastName] = useState<string>(draft?.lastName ?? '');

  // Trip
  const [country, setCountry] = useState<string>(draft?.country ?? '');
  const [city, setCity] = useState<string>(draft?.city ?? '');
  const [checkIn, setCheckIn] = useState<string>(draft?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState<string>(draft?.checkOut ?? '');
  const [guests, setGuests] = useState<number>(draft?.guests ?? 1);
  const [hasChildren, setHasChildren] = useState<'no' | 'yes'>(draft?.hasChildren ?? 'no');
  const [children, setChildren] = useState<ChildEntry[]>(draft?.children ?? []);

  // Contacts (same shape as visa forms)
  const [email, setEmail] = useState<string>(draft?.email ?? '');
  const [phone, setPhone] = useState<string>(draft?.phone ?? '');
  const [telegramLogin, setTelegramLogin] = useState<string>(draft?.telegramLogin ?? '');

  // Passport file
  const [passport, setPassport] = useState<File | null>(null);

  // Payment
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [cardCopied, setCardCopied] = useState(false);

  // Все настройки бронь-аддона (цена, карта, поля анкеты, overrides) из
  // единого источника — useBookingProduct. См. hooks/useBookingProduct.ts.
  const product = useBookingProduct('hotel');
  const price = product.price;
  const cardNumber = product.cardNumber;
  const extraFields = product.extraFields;
  const overrides = product.overrides;
  const ov = (key: string, fallbackLabel: string, fallbackRequired: boolean) =>
    resolveFieldOverride(overrides, key, fallbackLabel, fallbackRequired);
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});

  // Telegram BackButton + closing confirmation: главный сценарий потери черновика.
  useEffect(() => {
    enableClosingConfirmation();
    showBackButton(onBack);
    return () => {
      hideBackButton(onBack);
      disableClosingConfirmation();
    };
  }, [onBack]);

  // Auto-save draft to localStorage on every change.
  // Only files (passport, paymentScreenshot) are excluded — they can't be serialised.
  useEffect(() => {
    const anyContent = !!(firstName || lastName || country || city || checkIn || checkOut ||
      hasChildren === 'yes' || email || phone || telegramLogin);
    if (!anyContent) return;
    try {
      localStorage.setItem('hotel_booking_draft', JSON.stringify({
        firstName, lastName, country, city, checkIn, checkOut,
        guests, hasChildren, children,
        email, phone, telegramLogin, extraValues,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* quota or json error — ignore */ }
  }, [firstName, lastName, country, city, checkIn, checkOut, guests, hasChildren, children, email, phone, telegramLogin, extraValues]);

  // UX state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyCard = async () => {
    try { await navigator.clipboard.writeText(cardNumber.replace(/\s/g, '')); } catch { /* no-op */ }
    setCardCopied(true);
    setTimeout(() => setCardCopied(false), 2000);
  };

  const addChild = () => setChildren([...children, { id: Math.random().toString(36).slice(2), age: '' }]);
  const removeChild = (id: string) => setChildren(children.filter(c => c.id !== id));
  const updateChildAge = (id: string, age: string) => setChildren(children.map(c => c.id === id ? { ...c, age } : c));

  const validate = (): string | null => {
    // Required-checks respect admin overrides — if a field was explicitly
    // marked optional or hidden in app_settings, we skip it here.
    const reqFirstName = ov('firstName', '', true).required && ov('firstName', '', true).visible;
    const reqLastName  = ov('lastName',  '', true).required && ov('lastName',  '', true).visible;
    const reqCountry   = ov('country',   '', true).required && ov('country',   '', true).visible;
    const reqCity      = ov('city',      '', true).required && ov('city',      '', true).visible;
    const reqCheckIn   = ov('checkIn',   '', true).required && ov('checkIn',   '', true).visible;
    const reqCheckOut  = ov('checkOut',  '', true).required && ov('checkOut',  '', true).visible;

    if (reqFirstName && !firstName.trim()) return 'Заполните имя (как в загранпаспорте)';
    if (reqLastName && !lastName.trim()) return 'Заполните фамилию (как в загранпаспорте)';
    if ((reqCountry && !country.trim()) || (reqCity && !city.trim())) return 'Укажите страну и город назначения';
    if ((reqCheckIn && !checkIn) || (reqCheckOut && !checkOut)) return 'Укажите даты заезда и выезда';
    if (new Date(checkOut) <= new Date(checkIn)) return 'Дата выезда должна быть позже даты заезда';
    if (guests < 1) return 'Должен быть хотя бы один гость';
    if (hasChildren === 'yes' && children.some(c => !c.age.trim())) return 'Укажите возраст всех детей';
    if (!email.trim() || !phone.trim() || !telegramLogin.trim()) return 'Заполните все контактные данные';
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
      // 1. Upload passport + payment screenshot
      const [passportUrl, paymentUrl] = await Promise.all([
        passport ? uploadFile(passport, 'photos') : Promise.resolve(null),
        paymentScreenshot ? uploadFile(paymentScreenshot, 'payments') : Promise.resolve(null),
      ]);

      // 2. Save row (best effort — no DB table is fine; admin still gets notification)
      const userData = (() => {
        try { return JSON.parse(localStorage.getItem('userData') ?? '{}'); } catch { return {}; }
      })();

      const row = {
        telegram_id: userData.telegramId ?? null,
        username: userData.username ?? null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        country: country.trim(),
        city: city.trim(),
        check_in: checkIn,
        check_out: checkOut,
        guests,
        children_ages: hasChildren === 'yes' ? children.map(c => c.age.trim()).filter(Boolean) : [],
        email: email.trim(),
        phone: phone.trim(),
        telegram_login: telegramLogin.trim(),
        passport_url: passportUrl,
        price,
        payment_screenshot_url: paymentUrl,
        extra_fields: Object.keys(extraValues).length > 0 ? extraValues : null,
        // Юзер прикрепил скриншот оплаты при сабмите → сразу
        // pending_confirmation. Админ видит в инбоксе как «ожидает
        // подтверждения», не как «новая без оплаты».
        status: 'pending_confirmation',
      };

      if (isSupabaseConfigured()) {
        await supabase.from('hotel_bookings').insert(row).then(r => {
          if (r.error) console.warn('hotel_bookings insert failed (table may not exist yet):', r.error.message);
        });
      }

      // 3. Notify admin (best effort)
      try {
        await apiFetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'hotel_booking',
            customer_name: `${firstName.trim()} ${lastName.trim()}`,
            details: row,
          }),
        });
      } catch { /* no-op */ }

      // Clear draft now that the booking is successfully submitted
      try { localStorage.removeItem('hotel_booking_draft'); } catch { /* no-op */ }

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
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center px-5">
        <div className="w-20 h-20 rounded-full vd-grad flex items-center justify-center text-white shadow-lg vd-shadow-cta mb-5">
          <Check className="w-10 h-10" strokeWidth={3} />
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight text-[#0F2A36]">Заявка отправлена!</h1>
        <p className="text-center text-sm text-[#0F2A36]/65 mt-3 max-w-xs">
          Мы получили вашу заявку на бронь отеля и свяжемся в Telegram в течение нескольких часов.
        </p>
        <button
          onClick={onComplete}
          className="mt-8 px-6 py-3 rounded-xl vd-grad text-white font-semibold shadow-md vd-shadow-cta active:scale-[0.98] transition"
        >
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">
      {/* Header — matches Home/UserProfile */}
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
          <span className="w-9" />
        </div>
      </div>

      {/* Hero */}
      <div className="vd-grad-soft px-5 pt-7 pb-6 max-w-2xl mx-auto">
        <p className="text-center text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">
          🧾 Анкета
        </p>
        <h1 className="text-center text-[26px] leading-[1.1] tracking-tight font-extrabold text-[#0F2A36] mt-1">
          Бронирование отеля <br/>
          <span className="vd-grad-text">для визы</span>
        </h1>
        <p className="text-center text-[12px] text-[#0F2A36]/60 mt-3">
          Заполни 5 минут — пришлём подтверждение <br/>для посольства и пограничного контроля
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* ── 👤 Личные данные ──────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Личные данные</h3>
          </div>
          <div className="space-y-3">
            {(() => { const f = ov('firstName', 'Имя (как в загранпаспорте)', true); return f.visible && (
              <Field label={f.label} required={f.required}>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="IVAN" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('lastName', 'Фамилия (как в загранпаспорте)', true); return f.visible && (
              <Field label={f.label} required={f.required}>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="IVANOV" className="form-input" />
              </Field>
            ); })()}
          </div>
        </section>

        {/* ── ✈️ Данные поездки ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Plane className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Данные поездки</h3>
          </div>
          <div className="space-y-3">
            {(() => { const f = ov('country', 'Страна назначения', true); return f.visible && (
              <Field label={f.label} required={f.required}>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Турция" className="form-input" />
              </Field>
            ); })()}
            {(() => { const f = ov('city', 'Город', true); return f.visible && (
              <Field label={f.label} required={f.required}>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Стамбул" className="form-input" />
              </Field>
            ); })()}
            {/* Даты ─ на mobile stack-ом (как в визовых анкетах), на desktop ─ в две колонки.
               Узкие date-инпуты на iPhone выглядели зажато и обрезались системным пикером. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(() => { const f = ov('checkIn', 'Дата заезда', true); return f.visible && (
                <Field label={f.label} required={f.required}>
                  <DateInput value={checkIn} onChange={setCheckIn} />
                </Field>
              ); })()}
              {(() => { const f = ov('checkOut', 'Дата выезда', true); return f.visible && (
                <Field label={f.label} required={f.required}>
                  <DateInput value={checkOut} min={checkIn || undefined} onChange={setCheckOut} />
                </Field>
              ); })()}
            </div>
            {(() => { const f = ov('guests', 'Количество гостей', true); return f.visible && (
            <Field label={f.label} required={f.required}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setGuests(g => Math.max(1, g - 1))}
                  className="w-10 h-10 rounded-xl bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center active:scale-95 transition">
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <div className="flex-1 form-input text-center font-semibold text-base">{guests}</div>
                <button type="button" onClick={() => setGuests(g => Math.min(20, g + 1))}
                  className="w-10 h-10 rounded-xl bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center active:scale-95 transition">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </Field>
            ); })()}

            {/* Children radio + dynamic ages */}
            {(() => { const f = ov('children', 'Есть ли дети?', false); return f.visible && (
            <Field label={f.label} required={f.required}>
              <div className="grid grid-cols-2 gap-2">
                <RadioCard label="Нет" active={hasChildren === 'no'} onClick={() => { setHasChildren('no'); setChildren([]); }} />
                <RadioCard label="Да (указать возраст)" active={hasChildren === 'yes'} onClick={() => { setHasChildren('yes'); if (children.length === 0) addChild(); }} />
              </div>
            </Field>
            ); })()}

            {hasChildren === 'yes' && (ov('children', '', false).visible) && (
              <div className="space-y-2 pl-1">
                {children.map((ch, i) => (
                  <div key={ch.id} className="flex items-center gap-2">
                    <span className="text-xs text-[#0F2A36]/60 w-20">Ребёнок {i + 1}</span>
                    <input
                      type="number" min={0} max={17}
                      value={ch.age} onChange={e => updateChildAge(ch.id, e.target.value)}
                      placeholder="Возраст"
                      className="form-input flex-1"
                    />
                    <button type="button" onClick={() => removeChild(ch.id)}
                      className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-95 transition">
                      <X size={15} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addChild}
                  className="w-full py-2 text-xs font-semibold text-[#3B5BFF] hover:bg-[#EAF1FF] rounded-lg transition flex items-center justify-center gap-1">
                  <Plus size={14} strokeWidth={2.5} /> Ещё ребёнок
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Контактные данные (как в визах) ───────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Контактные данные</h3>
          </div>
          <p className="text-xs text-[#0F2A36]/60 mb-4">Свяжемся для уточнения деталей и отправки подтверждения</p>
          <div className="space-y-3">
            {(() => { const f = ov('email', 'E-mail', true); return f.visible && (
            <Field label={f.label} required={f.required} icon={<Mail className="w-3.5 h-3.5" />}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@mail.com" className="form-input" />
            </Field>
            ); })()}
            {(() => { const f = ov('phone', 'Номер телефона', true); return f.visible && (
            <Field label={f.label} required={f.required} icon={<Phone className="w-3.5 h-3.5" />}>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className="form-input" />
            </Field>
            ); })()}
            {(() => { const f = ov('telegramLogin', 'Логин в Telegram', true); return f.visible && (
            <Field label={f.label} required={f.required} icon={<Send className="w-3.5 h-3.5" />}>
              <input type="text" value={telegramLogin} onChange={e => setTelegramLogin(e.target.value)} placeholder="@username" className="form-input" />
            </Field>
            ); })()}
          </div>
          <div className="mt-3 vd-grad-soft border border-blue-100 rounded-lg px-3 py-2">
            <p className="text-xs text-[#0F2A36]/75">🔒 Данные в безопасности и не передаются третьим лицам</p>
          </div>
        </section>

        {/* ── Файл: только загранпаспорт ────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Загранпаспорт</h3>
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
                  if (f) setPassport(f);
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

          {/* Price */}
          <div className="vd-grad rounded-xl p-4 text-white shadow-md vd-shadow-cta mb-3">
            <p className="text-[11px] uppercase tracking-widest text-white/80 font-bold">К оплате</p>
            <p className="text-[28px] font-extrabold tracking-tight mt-0.5">{price.toLocaleString('ru-RU')} ₽</p>
          </div>

          {/* Card */}
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
          </div>

          {/* Screenshot upload */}
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
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-2xl vd-grad text-white font-bold shadow-md vd-shadow-cta active:scale-[0.99] transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправляем…</> : `Оплатил — отправить заявку`}
        </button>

        {/* .vd-input now lives globally in src/styles/globals.css */}
      </form>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

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

function RadioCard({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-3 rounded-xl border text-sm font-semibold transition active:scale-[0.98] ${
        active
          ? 'border-[#3B5BFF] bg-[#EAF1FF] text-[#3B5BFF]'
          : 'border-gray-200 bg-white text-[#0F2A36]/65 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
