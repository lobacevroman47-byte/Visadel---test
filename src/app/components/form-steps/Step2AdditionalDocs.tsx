import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Check, Hotel, Plane, Zap } from 'lucide-react';
import { getAppSettings, getAdditionalServices, type CoreFieldOverrides } from '../../lib/db';
import type { HotelAddonDetails, FlightAddonDetails } from '../ApplicationForm';

// Бронь-аддоны в визовой форме читают **те же** core overrides что и
// standalone HotelBookingForm/FlightBookingForm — admin меняет лейбл/required
// в Конструктор анкет → Брони → клиент видит то же тут и в нижнем меню.

// Только trip-specific подмножество core fields — контакты и паспорт
// уже собирает визовая форма, дублировать незачем.
const HOTEL_ADDON_FIELDS = [
  { key: 'country',  defaultLabel: 'Страна назначения',  defaultRequired: true,  defaultPlaceholder: 'Например, Индия' },
  { key: 'city',     defaultLabel: 'Город',              defaultRequired: true,  defaultPlaceholder: 'Например, Нью-Дели' },
  { key: 'checkIn',  defaultLabel: 'Дата заезда',        defaultRequired: true,  defaultPlaceholder: '' },
  { key: 'checkOut', defaultLabel: 'Дата выезда',        defaultRequired: true,  defaultPlaceholder: '' },
  { key: 'guests',   defaultLabel: 'Количество гостей',  defaultRequired: true,  defaultPlaceholder: '1' },
  { key: 'children', defaultLabel: 'Есть ли дети?',      defaultRequired: false, defaultPlaceholder: '' },
];

const FLIGHT_ADDON_FIELDS = [
  { key: 'fromCity',    defaultLabel: 'Из какого города', defaultRequired: true, defaultPlaceholder: 'Москва' },
  { key: 'toCity',      defaultLabel: 'В какой город',    defaultRequired: true, defaultPlaceholder: 'Дели' },
  { key: 'bookingDate', defaultLabel: 'Дата бронирования', defaultRequired: true, defaultPlaceholder: '' },
];

// Lookup утилита: применяет override (label/required/visible) если есть, иначе дефолт.
const resolveOverride = (overrides: CoreFieldOverrides, key: string, defaultLabel: string, defaultRequired: boolean) => {
  const o = overrides[key] ?? {};
  return {
    label: o.label ?? defaultLabel,
    required: o.required ?? defaultRequired,
    visible: o.visible !== false,
  };
};

interface Step2Data {
  hotelBooking: boolean;
  returnTicket: boolean;
  urgentProcessing: boolean;
  hotelDetails?: HotelAddonDetails;
  flightDetails?: FlightAddonDetails;
}

interface Step2Props {
  country: string;
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step2AdditionalDocs({ country, data, onChange, onNext, onPrev }: Step2Props) {
  const [formData, setFormData] = useState<Step2Data>(data);
  const [hotelOverrides, setHotelOverrides] = useState<CoreFieldOverrides>({});
  const [flightOverrides, setFlightOverrides] = useState<CoreFieldOverrides>({});
  const [prices, setPrices] = useState({ urgent: 1000, hotel: 1000, ticket: 2000 });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Подтягиваем overrides + цены — единый source of truth с конструктором
  useEffect(() => {
    let alive = true;
    Promise.all([getAppSettings(), getAdditionalServices()]).then(([s, services]) => {
      if (!alive) return;
      setHotelOverrides(s.hotel_core_overrides ?? {});
      setFlightOverrides(s.flight_core_overrides ?? {});
      const enabled = services.filter(x => x.enabled);
      const byId = new Map(enabled.map(x => [x.id, x.price] as const));
      setPrices({
        urgent: byId.get('urgent-processing') ?? 1000,
        hotel:  byId.get('hotel-booking')     ?? 1000,
        ticket: byId.get('flight-booking')    ?? 2000,
      });
    }).catch(() => { /* defaults stay */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => { onChange(formData); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [formData]);

  const toggleAddon = (key: 'hotelBooking' | 'returnTicket' | 'urgentProcessing') => {
    setFormData(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // При включении инициализируем sub-форму чтобы было куда писать
      if (key === 'hotelBooking' && next.hotelBooking && !next.hotelDetails) {
        next.hotelDetails = { guests: 1, hasChildren: 'no' };
      }
      if (key === 'returnTicket' && next.returnTicket && !next.flightDetails) {
        next.flightDetails = {};
      }
      return next;
    });
  };

  const updateHotel = <K extends keyof HotelAddonDetails>(k: K, v: HotelAddonDetails[K]) => {
    setFormData(prev => ({ ...prev, hotelDetails: { ...(prev.hotelDetails ?? {}), [k]: v } }));
  };
  const updateFlight = <K extends keyof FlightAddonDetails>(k: K, v: FlightAddonDetails[K]) => {
    setFormData(prev => ({ ...prev, flightDetails: { ...(prev.flightDetails ?? {}), [k]: v } }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (formData.hotelBooking) {
      const h = formData.hotelDetails ?? {};
      for (const f of HOTEL_ADDON_FIELDS) {
        const ov = resolveOverride(hotelOverrides, f.key, f.defaultLabel, f.defaultRequired);
        if (!ov.visible || !ov.required) continue;
        if (f.key === 'children') continue; // дети — необязательны
        if (f.key === 'guests') {
          if (!h.guests || h.guests < 1) next[`hotel.${f.key}`] = 'Укажите хотя бы одного гостя';
          continue;
        }
        const val = (h as any)[f.key];
        if (!val || (typeof val === 'string' && !val.trim())) next[`hotel.${f.key}`] = 'Заполните поле';
      }
      if (h.checkIn && h.checkOut && new Date(h.checkOut) <= new Date(h.checkIn)) {
        next['hotel.checkOut'] = 'Дата выезда позже даты заезда';
      }
      if (h.hasChildren === 'yes' && (!h.childrenCount || h.childrenCount < 1)) {
        next['hotel.childrenCount'] = 'Укажите количество детей';
      }
    }

    if (formData.returnTicket) {
      const fl = formData.flightDetails ?? {};
      for (const f of FLIGHT_ADDON_FIELDS) {
        const ov = resolveOverride(flightOverrides, f.key, f.defaultLabel, f.defaultRequired);
        if (!ov.visible || !ov.required) continue;
        const val = (fl as any)[f.key];
        if (!val || (typeof val === 'string' && !val.trim())) next[`flight.${f.key}`] = 'Заполните поле';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (validate()) onNext();
  };

  const showOptions = country !== 'Вьетнам';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="mb-5">
        <h2 className="text-[20px] font-extrabold tracking-tight text-[#0F2A36] mb-1">Усиление заявки</h2>
        <p className="text-sm text-[#0F2A36]/60">
          {showOptions
            ? 'Опционально — добавь услуги, которые увеличат шанс одобрения визы'
            : 'Для Вьетнама дополнительные опции уже включены в стоимость'}
        </p>
      </div>

      {showOptions && (
        <div className="space-y-3 mb-5">
          <AddonCard
            icon={<Zap className="w-5 h-5" />}
            emoji="⚡"
            title="Срочное оформление"
            description="Приоритетная обработка в течение 2 рабочих дней"
            price={prices.urgent}
            checked={formData.urgentProcessing}
            onToggle={() => toggleAddon('urgentProcessing')}
          />

          <AddonCard
            icon={<Hotel className="w-5 h-5" />}
            emoji="🏨"
            title="Бронь отеля для визы"
            description="Подтверждение проживания, которое принимают посольства"
            price={prices.hotel}
            checked={formData.hotelBooking}
            onToggle={() => toggleAddon('hotelBooking')}
          >
            <AnimatePresence initial={false}>
              {formData.hotelBooking && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-3">
                    {HOTEL_ADDON_FIELDS.map(f => {
                      const ov = resolveOverride(hotelOverrides, f.key, f.defaultLabel, f.defaultRequired);
                      if (!ov.visible) return null;
                      const errKey = `hotel.${f.key}`;
                      const h = formData.hotelDetails ?? {};

                      if (f.key === 'children') {
                        return (
                          <div key={f.key}>
                            <FieldLabel label={ov.label} required={ov.required} />
                            <div className="grid grid-cols-2 gap-2">
                              <SegmentedToggle
                                active={h.hasChildren === 'no' || !h.hasChildren}
                                onClick={() => updateHotel('hasChildren', 'no')}
                                label="Нет"
                              />
                              <SegmentedToggle
                                active={h.hasChildren === 'yes'}
                                onClick={() => updateHotel('hasChildren', 'yes')}
                                label="Да"
                              />
                            </div>
                            <AnimatePresence initial={false}>
                              {h.hasChildren === 'yes' && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                  animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <FieldLabel label="Количество детей" required />
                                  <input
                                    type="number"
                                    min={1}
                                    value={h.childrenCount ?? ''}
                                    onChange={e => updateHotel('childrenCount', parseInt(e.target.value, 10) || 0)}
                                    placeholder="1"
                                    className="form-input"
                                  />
                                  {errors['hotel.childrenCount'] && <ErrorLine text={errors['hotel.childrenCount']} />}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      }

                      if (f.key === 'guests') {
                        return (
                          <div key={f.key}>
                            <FieldLabel label={ov.label} required={ov.required} />
                            <input
                              type="number"
                              min={1}
                              value={h.guests ?? 1}
                              onChange={e => updateHotel('guests', parseInt(e.target.value, 10) || 0)}
                              placeholder={f.defaultPlaceholder}
                              className="form-input"
                            />
                            {errors[errKey] && <ErrorLine text={errors[errKey]} />}
                          </div>
                        );
                      }

                      const inputType = f.key === 'checkIn' || f.key === 'checkOut' ? 'date' : 'text';
                      return (
                        <div key={f.key}>
                          <FieldLabel label={ov.label} required={ov.required} />
                          <input
                            type={inputType}
                            value={(h as any)[f.key] ?? ''}
                            onChange={e => updateHotel(f.key as keyof HotelAddonDetails, e.target.value as any)}
                            placeholder={f.defaultPlaceholder}
                            className="form-input"
                          />
                          {errors[errKey] && <ErrorLine text={errors[errKey]} />}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </AddonCard>

          <AddonCard
            icon={<Plane className="w-5 h-5" />}
            emoji="✈️"
            title="Бронь обратного билета"
            description="Показывает намерение покинуть страну вовремя"
            price={prices.ticket}
            checked={formData.returnTicket}
            onToggle={() => toggleAddon('returnTicket')}
          >
            <AnimatePresence initial={false}>
              {formData.returnTicket && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-3">
                    {FLIGHT_ADDON_FIELDS.map(f => {
                      const ov = resolveOverride(flightOverrides, f.key, f.defaultLabel, f.defaultRequired);
                      if (!ov.visible) return null;
                      const errKey = `flight.${f.key}`;
                      const fl = formData.flightDetails ?? {};
                      const inputType = f.key === 'bookingDate' ? 'date' : 'text';
                      return (
                        <div key={f.key}>
                          <FieldLabel label={ov.label} required={ov.required} />
                          <input
                            type={inputType}
                            value={(fl as any)[f.key] ?? ''}
                            onChange={e => updateFlight(f.key as keyof FlightAddonDetails, e.target.value as any)}
                            placeholder={f.defaultPlaceholder}
                            className="form-input"
                          />
                          {errors[errKey] && <ErrorLine text={errors[errKey]} />}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </AddonCard>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2 font-semibold"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
        <button
          onClick={handleNext}
          className="flex-1 vd-grad text-white py-3.5 rounded-xl shadow-md vd-shadow-cta active:scale-[0.98] transition flex items-center justify-center gap-2 font-bold"
        >
          Далее
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface AddonCardProps {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  description: string;
  price: number;
  checked: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function AddonCard({ emoji, title, description, price, checked, onToggle, children }: AddonCardProps) {
  return (
    <div
      className={`rounded-2xl border transition-all ${
        checked
          ? 'border-[#3B5BFF] bg-[#EAF1FF]/40 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
          checked ? 'vd-grad shadow-md' : 'vd-grad-soft border border-blue-100'
        }`}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#0F2A36]">{title}</p>
          <p className="text-xs text-[#0F2A36]/60 mt-0.5">{description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[#3B5BFF] font-bold text-sm whitespace-nowrap">+{price.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
            checked ? 'bg-[#3B5BFF] border-[#3B5BFF]' : 'border-gray-300 bg-white'
          }`}
        >
          {checked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
        </div>
      </button>
      {children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <label className="block text-xs font-semibold text-[#0F2A36] mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <p className="text-[11px] text-red-500 mt-1">{text}</p>;
}

function SegmentedToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 ${
        active
          ? 'vd-grad text-white shadow-sm'
          : 'bg-gray-50 text-[#0F2A36]/70 hover:bg-gray-100 border border-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
