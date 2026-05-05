import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ChevronRight, ChevronDown, Calculator, Check, Loader2 } from 'lucide-react';
import type { VisaOption } from '../App';
import logo from '../../assets/logo2.png';
import {
  getReferralStats, getVisaProducts, getAdditionalServices,
  type VisaProduct, type AdditionalService,
} from '../lib/db';

interface HomeProps {
  onVisaSelect: (visa: VisaOption, urgent?: boolean, addons?: AddonsState) => void;
  onOpenProfile: () => void;
  onOpenReferrals?: () => void;
  onOpenExtension: (visa: VisaOption) => void;
  onOpenPartnerApplication?: () => void;
  onOpenAdmin?: () => void;
}

interface Country {
  name: string;
  flag: string;
  visaOptions: VisaOption[];
  urgentOptions?: VisaOption[];
  extensionOptions?: VisaOption[];
}

// Try to extract human-readable duration from visa name
// e.g. "E-VISA на 30 дней" → "30 дней", "K-ETA на 3 года" → "3 года"
function extractDuration(name: string): string {
  const m = name.match(/(\d+)\s*(дней|дня|день|года|год|лет|месяц[а-я]*|часа?|часов)/i);
  return m ? `${m[1]} ${m[2]}` : '';
}

// Map DB visa products → grouped country structure with urgent/extension classification
function productsToCountries(products: VisaProduct[]): Country[] {
  const enabled = products.filter(p => p.enabled);
  const groups = new Map<string, { flag: string; minSort: number; products: VisaProduct[] }>();
  for (const p of enabled) {
    const g = groups.get(p.country);
    if (g) {
      g.products.push(p);
      if (p.sort_order < g.minSort) g.minSort = p.sort_order;
    } else {
      groups.set(p.country, { flag: p.flag ?? '🌍', minSort: p.sort_order, products: [p] });
    }
  }
  const ordered = Array.from(groups.entries()).sort((a, b) => a[1].minSort - b[1].minSort);

  return ordered.map(([name, { flag, products: items }]) => {
    const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
    const visaOptions: VisaOption[] = [];
    const urgentOptions: VisaOption[] = [];
    const extensionOptions: VisaOption[] = [];
    for (const p of sorted) {
      const opt: VisaOption = {
        id: p.id,
        country: p.country,
        type: p.name,
        duration: extractDuration(p.name),
        price: p.price,
        readinessTime: p.processing_time ?? '',
        description: p.description ?? undefined,
      };
      if (/продлен/i.test(p.name)) extensionOptions.push(opt);
      else if (p.country === 'Вьетнам' && /срочн/i.test(p.name)) urgentOptions.push(opt);
      else visaOptions.push(opt);
    }
    return {
      name, flag, visaOptions,
      urgentOptions: urgentOptions.length ? urgentOptions : undefined,
      extensionOptions: extensionOptions.length ? extensionOptions : undefined,
    };
  });
}

// ─── Unified Card Component ───────────────────────────────────────────────────
export interface AddonsState {
  urgent: boolean;
  hotel: boolean;
  ticket: boolean;
}

interface AddonPrices {
  urgent: number;
  hotel: number;
  ticket: number;
}

const DEFAULT_ADDON_PRICES: AddonPrices = { urgent: 1000, hotel: 1000, ticket: 2000 };

interface VisaCardProps {
  visa: VisaOption;
  addonPrices: AddonPrices;
  onSelect: (addons: AddonsState) => void;
  isUrgent?: boolean;
  hideCalculator?: boolean;
}

function AddonToggle({ icon, label, hint, price, active, onToggle }: {
  icon: string;
  label: string;
  hint?: string;
  price: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
        active
          ? 'bg-blue-50 border-[#2196F3] shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 text-left min-w-0">
        <div className={`text-sm font-medium ${active ? 'text-[#1976D2]' : 'text-gray-800'}`}>
          {label}
        </div>
        {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-semibold ${active ? 'text-[#2196F3]' : 'text-gray-600'}`}>
          +{price.toLocaleString('ru-RU')}₽
        </div>
      </div>
      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
        active ? 'bg-[#2196F3] border-[#2196F3]' : 'border-gray-300 bg-white'
      }`}>
        {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>
    </button>
  );
}

function VisaCard({ visa, addonPrices, onSelect, isUrgent = false, hideCalculator = false }: VisaCardProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [hotel, setHotel] = useState(false);
  const [ticket, setTicket] = useState(false);

  // Vietnam already has dedicated urgent options, so no urgent toggle there
  const isVietnam = visa.country === 'Вьетнам';
  const urgentApplied = urgent && !isVietnam;

  const addons = (urgentApplied ? addonPrices.urgent : 0) + (hotel ? addonPrices.hotel : 0) + (ticket ? addonPrices.ticket : 0);
  const total = visa.price + addons;
  const hasAddons = urgentApplied || hotel || ticket;

  const handleSubmit = () => {
    onSelect({ urgent: urgentApplied, hotel, ticket });
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-[#0F2A36] font-bold tracking-tight mb-1">{visa.type}</h3>
        {visa.description && (
          <p className="text-sm text-[#0F2A36]/60 mb-1">{visa.description}</p>
        )}
        <p className="text-xs text-[#0F2A36]/60 uppercase tracking-wider font-semibold">{visa.readinessTime}</p>
      </div>

      {/* Price Block */}
      <div className="vd-grad-soft rounded-xl p-4 mb-3 border border-blue-100/60">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] text-[#0F2A36]/60 mb-0.5 uppercase tracking-wider font-semibold">
              {hasAddons ? 'Базовая цена' : 'Стоимость'}
            </div>
            <div className={`leading-none font-extrabold tracking-tight ${hasAddons ? 'text-xl text-gray-400 line-through' : 'text-3xl vd-grad-text'}`}>
              {visa.price.toLocaleString('ru-RU')}<span className={hasAddons ? 'text-base' : 'text-xl'}>₽</span>
            </div>
          </div>
          <AnimatePresence>
            {hasAddons && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-right"
              >
                <div className="text-[10px] text-[#0F2A36]/60 mb-0.5 uppercase tracking-wider font-semibold">Итого</div>
                <div className="text-3xl text-[#00C853] font-extrabold leading-none tracking-tight">
                  {total.toLocaleString('ru-RU')}<span className="text-xl">₽</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Calculator Toggle */}
      {!hideCalculator && (
        <button
          onClick={() => setShowCalc(!showCalc)}
          className="w-full flex items-center justify-between py-2.5 px-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-sm mb-3 transition"
        >
          <span className="flex items-center gap-2 font-medium text-[#1976D2]">
            <Calculator className="w-4 h-4" />
            <span>{showCalc ? 'Свернуть калькулятор' : 'Калькулятор стоимости'}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-[#1976D2] transition-transform ${showCalc ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Calculator Panel */}
      <AnimatePresence initial={false}>
        {showCalc && !hideCalculator && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 mb-3">
              <p className="text-xs text-[#616161] px-1 mb-1">
                Дополнительные услуги для усиления заявки:
              </p>
              {!isVietnam && (
                <AddonToggle
                  icon="⚡"
                  label="Срочное оформление"
                  hint="Приоритетная обработка заявки"
                  price={addonPrices.urgent}
                  active={urgent}
                  onToggle={() => setUrgent(!urgent)}
                />
              )}
              <AddonToggle
                icon="🏨"
                label="Подтверждение проживания"
                hint="Бронь отеля для визы"
                price={addonPrices.hotel}
                active={hotel}
                onToggle={() => setHotel(!hotel)}
              />
              <AddonToggle
                icon="✈️"
                label="Обратный билет"
                hint="Подтверждение возвратного рейса"
                price={addonPrices.ticket}
                active={ticket}
                onToggle={() => setTicket(!ticket)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-2xl transition font-bold tracking-wide active:scale-[0.98] vd-shadow-cta ${
          isUrgent
            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white'
            : 'vd-grad text-white'
        }`}
      >
        Оформить{hasAddons ? ` за ${total.toLocaleString('ru-RU')}₽` : ''} →
      </button>
    </div>
  );
}

function ReferralBanner({ onOpen }: { onOpen?: () => void }) {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const referralCode = userData.referralCode ?? '';
  const telegramId = userData.telegramId ?? 0;
  const [earnings, setEarnings] = useState(0);

  useEffect(() => {
    if (referralCode && telegramId) {
      getReferralStats(referralCode, telegramId).then(s => setEarnings(s.totalEarnings));
    }
  }, [referralCode, telegramId]);

  if (!referralCode) return null;

  const hasEarnings = earnings > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full vd-grad rounded-2xl px-4 py-3 text-left text-white shadow-md vd-shadow-cta active:scale-[0.99] transition flex items-center gap-3"
    >
      <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-xl shrink-0">
        {hasEarnings ? '💰' : '🎁'}
      </div>
      <div className="flex-1 min-w-0">
        {hasEarnings ? (
          <>
            <p className="text-[13px] font-bold leading-tight truncate">
              Вы заработали {earnings.toLocaleString('ru-RU')}₽
            </p>
            <p className="text-[11px] text-white/80 mt-0.5 truncate">Пригласите ещё друзей и заработайте больше</p>
          </>
        ) : (
          <>
            <p className="text-[13px] font-bold leading-tight truncate">Пригласи друга — получи 500₽</p>
            <p className="text-[11px] text-white/80 mt-0.5 truncate">Другу +200₽ при регистрации</p>
          </>
        )}
      </div>
      <span className="text-white/90 text-base shrink-0">→</span>
    </button>
  );
}

export default function Home({ onVisaSelect, onOpenProfile, onOpenReferrals, onOpenExtension, onOpenPartnerApplication, onOpenAdmin }: HomeProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showUrgentVietnam, setShowUrgentVietnam] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [addonPrices, setAddonPrices] = useState<AddonPrices>(DEFAULT_ADDON_PRICES);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [products, services] = await Promise.all([
          getVisaProducts(),
          getAdditionalServices(),
        ]);
        if (!alive) return;
        setCountries(productsToCountries(products));
        // Map standard addon IDs to prices; fall back to defaults if service is missing/disabled
        const enabled = services.filter(s => s.enabled);
        const byId = new Map(enabled.map(s => [s.id, s.price] as const));
        setAddonPrices({
          urgent: byId.get('urgent-processing') ?? DEFAULT_ADDON_PRICES.urgent,
          hotel:  byId.get('hotel-booking')     ?? DEFAULT_ADDON_PRICES.hotel,
          ticket: byId.get('flight-booking')    ?? DEFAULT_ADDON_PRICES.ticket,
        });
      } catch (e) {
        console.warn('Failed to load visa catalog:', e);
      } finally {
        if (alive) setCatalogLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Scroll to top after any screen transition
  useEffect(() => {
    // setTimeout pushes after browser's own focus-scroll handling
    const t = setTimeout(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, 0);
    return () => clearTimeout(t);
  }, [selectedCountry, showUrgentVietnam, showExtensions]);

  const handleCountryClick = (country: Country) => {
    setSelectedCountry(country);
    setShowUrgentVietnam(false);
    setShowExtensions(false);
  };

  const handleBackFromCountry = () => {
    if (showExtensions) {
      setShowExtensions(false);
    } else if (showUrgentVietnam) {
      setShowUrgentVietnam(false);
    } else {
      setSelectedCountry(null);
    }
  };

  return (
    <div ref={scrollRef} className="min-h-screen bg-[#F5F7FA] pb-20" style={{ overflowAnchor: 'none' }}>
      {/* ─── Brand Header (compact, premium) ─── */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="px-5 pt-3 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[#0F2A36] font-extrabold text-[18px] tracking-tight">VISADEL</span>
          </div>
          <button
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition"
            aria-label="Профиль"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* ─── Hero (визы) — только на главном экране списка стран ─── */}
        {!selectedCountry && (
          <div className="vd-grad-soft px-5 pt-7 pb-8">
            <h1 className="text-center text-[28px] leading-[1.05] tracking-tight font-extrabold text-[#0F2A36]">
              Простой способ
              <br/>
              <span className="vd-grad-text">оформить визу</span>
            </h1>
            <p className="text-center text-[13px] text-[#0F2A36]/65 mt-3 max-w-sm mx-auto leading-snug">
              Заполни анкету за 5 минут — <span className="text-[#0F2A36] font-semibold">мы сделаем остальное</span>
            </p>
          </div>
        )}

        <div className="p-4">
        {/* Country Selection */}
        {!selectedCountry && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[20px] font-extrabold tracking-tight text-[#0F2A36]">Все направления</h2>
              <span className="text-[12px] text-gray-400">{countries.length} стран</span>
            </div>
            {catalogLoading && countries.length === 0 && (
              <div className="flex justify-center items-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}
            {!catalogLoading && countries.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                <p className="text-gray-600">Каталог пока пуст</p>
                <p className="text-sm text-gray-400 mt-1">Загляните позже</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {countries.map((country) => {
                const minPrice = Math.min(
                  ...country.visaOptions.map(v => v.price),
                  ...(country.urgentOptions ?? []).map(v => v.price),
                  ...(country.extensionOptions ?? []).map(v => v.price),
                );
                return (
                  <button
                    key={country.name}
                    onClick={() => handleCountryClick(country)}
                    className="bg-white rounded-2xl p-4 border border-gray-100 hover:shadow-md active:scale-[0.98] transition-all text-left"
                  >
                    <span className="text-3xl block leading-none">{country.flag}</span>
                    <p className="text-[#0F2A36] font-bold text-[14px] mt-2">{country.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">от {minPrice.toLocaleString('ru-RU')} ₽</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              <ReferralBanner onOpen={onOpenReferrals} />
            </div>
          </div>
        )}

        {/* Visa Type Selection */}
        {selectedCountry && (
          <div>
            <button
              onClick={handleBackFromCountry}
              className="mb-4 text-[#3B5BFF] hover:text-[#4F2FE6] flex items-center gap-1 text-sm font-medium"
            >
              ← Назад
            </button>

            <div className="vd-grad-soft rounded-2xl p-6 mb-6 border border-blue-100/50">
              <div className="flex items-center gap-4">
                <span className="text-6xl leading-none">{selectedCountry.flag}</span>
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-[#0F2A36]">{selectedCountry.name}</h2>
                  <p className="text-[#0F2A36]/60 text-sm mt-0.5">
                    {showExtensions ? 'Продление визы' : showUrgentVietnam ? 'Срочное оформление' : 'Выберите тип визы'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 text-[11px] text-[#0F2A36]/70 uppercase tracking-wider font-semibold">
                <span>1–3 дня</span>
                <span className="text-[#5C7BFF]">·</span>
                <span>99% одобрений</span>
                <span className="text-[#5C7BFF]">·</span>
                <span>SSL</span>
              </div>
            </div>

            {/* Extensions for Sri Lanka */}
            {showExtensions && selectedCountry.extensionOptions && (
              <div className="space-y-4">
                {selectedCountry.extensionOptions.map((visa) => (
                  <VisaCard
                    key={visa.id}
                    visa={visa}
                    addonPrices={addonPrices}
                    hideCalculator
                    onSelect={() => onOpenExtension && onOpenExtension(visa)}
                  />
                ))}
              </div>
            )}

            {/* Regular Vietnam Visas */}
            {selectedCountry.name === 'Вьетнам' && !showUrgentVietnam && !showExtensions && (
              <div className="space-y-4">
                {selectedCountry.visaOptions.map((visa) => (
                  <VisaCard
                    key={visa.id}
                    visa={visa}
                    addonPrices={addonPrices}
                    onSelect={(addons) => onVisaSelect(visa, false, addons)}
                  />
                ))}

                {selectedCountry.urgentOptions && selectedCountry.urgentOptions.length > 0 && (
                  <button
                    onClick={() => setShowUrgentVietnam(true)}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white py-4 rounded-[16px] hover:shadow-lg transition flex items-center justify-center gap-2"
                  >
                    ⚡ Срочные визы
                  </button>
                )}
              </div>
            )}

            {/* Urgent Vietnam Visas */}
            {selectedCountry.name === 'Вьетнам' && showUrgentVietnam && selectedCountry.urgentOptions && (
              <div className="space-y-4">
                {selectedCountry.urgentOptions.map((visa) => (
                  <VisaCard
                    key={visa.id}
                    visa={visa}
                    addonPrices={addonPrices}
                    onSelect={(addons) => onVisaSelect(visa, true, addons)}
                    isUrgent
                  />
                ))}
              </div>
            )}

            {/* Other Countries */}
            {!showExtensions && !showUrgentVietnam && selectedCountry.name !== 'Вьетнам' && (
              <div className="space-y-4">
                {selectedCountry.visaOptions.map((visa) => (
                  <VisaCard
                    key={visa.id}
                    visa={visa}
                    addonPrices={addonPrices}
                    onSelect={(addons) => onVisaSelect(visa, false, addons)}
                  />
                ))}

                {/* Extension Button for Sri Lanka */}
                {selectedCountry.extensionOptions && (
                  <button
                    onClick={() => setShowExtensions(true)}
                    className="w-full bg-gradient-to-r from-[#00C853] to-[#00E676] text-white py-4 rounded-[16px] hover:shadow-lg transition flex items-center justify-center gap-2"
                  >
                    Продление визы
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}