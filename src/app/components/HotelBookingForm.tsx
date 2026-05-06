import { useState } from 'react';
import { ChevronLeft, User, Plane, Mail, Phone, Send, Upload, Check, Loader2, FileText, Plus, Minus, X } from 'lucide-react';
import { uploadFile } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface HotelBookingFormProps {
  onBack: () => void;
  onComplete: () => void;
}

interface ChildEntry { id: string; age: string; }

export default function HotelBookingForm({ onBack, onComplete }: HotelBookingFormProps) {
  // Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Trip
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [hasChildren, setHasChildren] = useState<'no' | 'yes'>('no');
  const [children, setChildren] = useState<ChildEntry[]>([]);

  // Contacts (same shape as visa forms)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramLogin, setTelegramLogin] = useState('');

  // Passport file
  const [passport, setPassport] = useState<File | null>(null);

  // UX state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addChild = () => setChildren([...children, { id: Math.random().toString(36).slice(2), age: '' }]);
  const removeChild = (id: string) => setChildren(children.filter(c => c.id !== id));
  const updateChildAge = (id: string, age: string) => setChildren(children.map(c => c.id === id ? { ...c, age } : c));

  const validate = (): string | null => {
    if (!firstName.trim() || !lastName.trim()) return 'Заполните имя и фамилию (как в загранпаспорте)';
    if (!country.trim() || !city.trim()) return 'Укажите страну и город назначения';
    if (!checkIn || !checkOut) return 'Укажите даты заезда и выезда';
    if (new Date(checkOut) <= new Date(checkIn)) return 'Дата выезда должна быть позже даты заезда';
    if (guests < 1) return 'Должен быть хотя бы один гость';
    if (hasChildren === 'yes' && children.some(c => !c.age.trim())) return 'Укажите возраст всех детей';
    if (!email.trim() || !phone.trim() || !telegramLogin.trim()) return 'Заполните все контактные данные';
    if (!passport) return 'Прикрепите скан загранпаспорта';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);

    try {
      // 1. Upload passport
      const passportUrl = passport ? await uploadFile(passport, 'photos') : null;

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
        status: 'new',
      };

      if (isSupabaseConfigured()) {
        await supabase.from('hotel_bookings').insert(row).then(r => {
          if (r.error) console.warn('hotel_bookings insert failed (table may not exist yet):', r.error.message);
        });
      }

      // 3. Notify admin (best effort)
      try {
        await fetch('/api/notify-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'hotel_booking',
            customer_name: `${firstName.trim()} ${lastName.trim()}`,
            details: row,
          }),
        });
      } catch { /* no-op */ }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
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
            className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
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
          Заполни 5 минут — пришлём подтверждение для посольства
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
            <Field label="Имя (как в загранпаспорте)" required>
              <input
                type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="IVAN"
                className="vd-input"
              />
            </Field>
            <Field label="Фамилия (как в загранпаспорте)" required>
              <input
                type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="IVANOV"
                className="vd-input"
              />
            </Field>
          </div>
        </section>

        {/* ── ✈️ Данные поездки ─────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Plane className="w-5 h-5 text-[#3B5BFF]" />
            <h3 className="text-sm font-bold text-[#0F2A36]">Данные поездки</h3>
          </div>
          <div className="space-y-3">
            <Field label="Страна назначения" required>
              <input type="text" value={country} onChange={e => setCountry(e.target.value)} placeholder="Турция" className="vd-input" />
            </Field>
            <Field label="Город" required>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Стамбул" className="vd-input" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Дата заезда" required>
                <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="vd-input" />
              </Field>
              <Field label="Дата выезда" required>
                <input type="date" value={checkOut} min={checkIn || undefined} onChange={e => setCheckOut(e.target.value)} className="vd-input" />
              </Field>
            </div>
            <Field label="Количество гостей" required>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setGuests(g => Math.max(1, g - 1))}
                  className="w-10 h-10 rounded-xl bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center active:scale-95 transition">
                  <Minus size={16} strokeWidth={2.5} />
                </button>
                <div className="flex-1 vd-input text-center font-semibold text-base">{guests}</div>
                <button type="button" onClick={() => setGuests(g => Math.min(20, g + 1))}
                  className="w-10 h-10 rounded-xl bg-[#EAF1FF] text-[#3B5BFF] flex items-center justify-center active:scale-95 transition">
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </Field>

            {/* Children radio + dynamic ages */}
            <Field label="Есть ли дети?">
              <div className="grid grid-cols-2 gap-2">
                <RadioCard label="Нет" active={hasChildren === 'no'} onClick={() => { setHasChildren('no'); setChildren([]); }} />
                <RadioCard label="Да (указать возраст)" active={hasChildren === 'yes'} onClick={() => { setHasChildren('yes'); if (children.length === 0) addChild(); }} />
              </div>
            </Field>

            {hasChildren === 'yes' && (
              <div className="space-y-2 pl-1">
                {children.map((ch, i) => (
                  <div key={ch.id} className="flex items-center gap-2">
                    <span className="text-xs text-[#0F2A36]/60 w-20">Ребёнок {i + 1}</span>
                    <input
                      type="number" min={0} max={17}
                      value={ch.age} onChange={e => updateChildAge(ch.id, e.target.value)}
                      placeholder="Возраст"
                      className="vd-input flex-1"
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
            <Field label="E-mail" required icon={<Mail className="w-3.5 h-3.5" />}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@mail.com" className="vd-input" />
            </Field>
            <Field label="Номер телефона" required icon={<Phone className="w-3.5 h-3.5" />}>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className="vd-input" />
            </Field>
            <Field label="Логин в Telegram" required icon={<Send className="w-3.5 h-3.5" />}>
              <input type="text" value={telegramLogin} onChange={e => setTelegramLogin(e.target.value)} placeholder="@username" className="vd-input" />
            </Field>
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
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправляем…</> : 'Отправить заявку'}
        </button>

        <style>{`
          .vd-input {
            width: 100%;
            padding: 0.75rem 0.875rem;
            border-radius: 0.75rem;
            border: 1px solid #E1E5EC;
            font-size: 0.875rem;
            color: #0F2A36;
            background: #fff;
            outline: none;
            transition: border-color .15s, box-shadow .15s;
          }
          .vd-input:focus { border-color: #5C7BFF; box-shadow: 0 0 0 3px rgba(92,123,255,0.15); }
          .vd-input::placeholder { color: #9ca3af; }
        `}</style>
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
