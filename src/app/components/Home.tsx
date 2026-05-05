import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, ChevronRight, ChevronDown, Calculator, Check } from 'lucide-react';
import type { VisaOption } from '../App';
import logo from '../../assets/logo2.png';
import { getReferralCount } from '../lib/db';

interface HomeProps {
  onVisaSelect: (visa: VisaOption, urgent?: boolean, addons?: AddonsState) => void;
  onOpenProfile: () => void;
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

const COUNTRIES: Country[] = [
  {
    name: 'Индия',
    flag: '🇮🇳',
    visaOptions: [
      { id: 'india-30', country: 'Индия', type: 'E-VISA на 30 дней', duration: '30 дней', price: 5490, readinessTime: '1-3 дня (Возможны задержки до 10 дней)' },
      { id: 'india-1y', country: 'Индия', type: 'E-VISA на 1 год', duration: '1 год', price: 7490, readinessTime: '1-3 дня (Возможны задержки до 10 дней)', description: 'Пребывание - максимум 90 дней за раз, 180 дней в год' },
      { id: 'india-5y-rf', country: 'Индия', type: 'E-VISA на 5 лет (граждане РФ)', duration: '5 лет', price: 14990, readinessTime: '1-3 дня (Возможны задержки до 10 дней)', description: 'Пребывание - максимум 90 дней за раз, 180 дней в год' },
      { id: 'india-5y-other', country: 'Индия', type: 'E-VISA на 5 лет (остальные страны)', duration: '5 лет', price: 19990, readinessTime: '1-3 дня (Возможны задержки до 10 дней)', description: 'Пребывание - максимум 90 дней за раз, 180 дней в год' },
    ]
  },
  {
    name: 'Вьетнам',
    flag: '🇻🇳',
    visaOptions: [
      { id: 'vietnam-90-single', country: 'Вьетнам', type: 'E-VISA на 90 дней однократная', duration: '90 дней', price: 5490, readinessTime: 'до 5 рабочих дней' },
      { id: 'vietnam-90-multi', country: 'Вьетнам', type: 'E-VISA на 90 дней многократная', duration: '90 дней', price: 8490, readinessTime: 'до 5 рабочих дней' },
    ],
    urgentOptions: [
      { id: 'vietnam-3d-single', country: 'Вьетнам', type: '3 дня - однократная', duration: '90 дней', price: 6990, readinessTime: '3 дня' },
      { id: 'vietnam-3d-multi', country: 'Вьетнам', type: '3 дня - многократная', duration: '90 дней', price: 9990, readinessTime: '3 дня' },
      { id: 'vietnam-2d-single', country: 'Вьетнам', type: '2 дня - однократная', duration: '90 дней', price: 7990, readinessTime: '2 дня' },
      { id: 'vietnam-2d-multi', country: 'Вьетнам', type: '2 дня - многократная', duration: '90 дней', price: 10990, readinessTime: '2 дня' },
      { id: 'vietnam-1d-single', country: 'Вьетнам', type: '1 день - однократная', duration: '90 дней', price: 8990, readinessTime: '1 день' },
      { id: 'vietnam-1d-multi', country: 'Вьетнам', type: '1 день - многократная', duration: '90 дней', price: 11990, readinessTime: '1 день' },
      { id: 'vietnam-4h-single', country: 'Вьетнам', type: '4 часа - однократная', duration: '90 дней', price: 9990, readinessTime: '4 часа' },
      { id: 'vietnam-4h-multi', country: 'Вьетнам', type: '4 часа - многократная', duration: '90 дней', price: 12990, readinessTime: '4 часа' },
      { id: 'vietnam-2h-single', country: 'Вьетнам', type: '2 часа - однократная', duration: '90 дней', price: 11990, readinessTime: '2 часа' },
      { id: 'vietnam-2h-multi', country: 'Вьетнам', type: '2 часа - многократная', duration: '90 дней', price: 13990, readinessTime: '2 часа' },
    ]
  },
  {
    name: 'Шри-Ланка',
    flag: '🇱🇰',
    visaOptions: [
      { id: 'srilanka-rf', country: 'Шри-Ланка', type: 'ETA на 30 дней (гражданам РФ)', duration: '30 дней', price: 2490, readinessTime: '1-3 дня' },
      { id: 'srilanka-other', country: 'Шри-Ланка', type: 'ETA на 30 дней (остальные страны)', duration: '30 дней', price: 8490, readinessTime: '1-3 дня' },
    ],
    extensionOptions: [
      { id: 'srilanka-ext1', country: 'Шри-Ланка', type: 'Первое продление на 60 дней', duration: '60 дней', price: 8990, readinessTime: '1-3 дня' },
      { id: 'srilanka-ext2', country: 'Шри-Ланка', type: 'Второе продление до 90 дней', duration: '90 дней', price: 18990, readinessTime: '1-3 дня' },
      { id: 'srilanka-ext3', country: 'Шри-Ланка', type: 'Третье продление до 90 дней', duration: '90 дней', price: 23990, readinessTime: '1-3 дня' },
    ]
  },
  {
    name: 'Южная Корея',
    flag: '🇰🇷',
    visaOptions: [
      { id: 'korea', country: 'Южная Корея', type: 'K-ETA на 3 года', duration: '3 года', price: 3490, readinessTime: 'до 3-х дней', description: 'Пребывание 60+30 дней за полгода' },
    ]
  },
  {
    name: 'Израиль',
    flag: '🇮🇱',
    visaOptions: [
      { id: 'israel', country: 'Израиль', type: 'ETA на 2 года', duration: '2 года', price: 3490, readinessTime: 'до 3-х дней', description: 'Пребывание 90 дней за полгода' },
    ]
  },
  {
    name: 'Пакистан',
    flag: '🇵🇰',
    visaOptions: [
      { id: 'pakistan', country: 'Пакистан', type: 'E-VISA до 90 дней', duration: '90 дней', price: 6490, readinessTime: '1-3 дня', description: '⚠️ Подача онлайн, получение в посольстве' },
    ]
  },
  {
    name: 'Камбоджа',
    flag: '🇰🇭',
    visaOptions: [
      { id: 'cambodia', country: 'Камбоджа', type: 'E-VISA на 30 дней', duration: '30 дней', price: 6490, readinessTime: '3-5 дней' },
    ]
  },
  {
    name: 'Кения',
    flag: '🇰🇪',
    visaOptions: [
      { id: 'kenya', country: 'Кения', type: 'ETA на 90 дней', duration: '90 дней', price: 6490, readinessTime: '1-3 дня' },
    ]
  },
  {
    name: 'Филиппины',
    flag: '🇵🇭',
    visaOptions: [
      { id: 'philippines-etravel', country: 'Филиппины', type: 'E-Travel на 30 дней', duration: '30 дней', price: 1990, readinessTime: '1-3 дня', description: 'Электронная регистрация для въезда' },
    ]
  },
];

// ─── Documents per country ────────────────────────────────────────────────────

interface DocItem { icon: string; text: string }

const COUNTRY_DOCS: Record<string, DocItem[]> = {
  'Индия': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '🪪', text: 'Серия и № внутреннего паспорта' },
    { icon: '👨‍👩‍👧', text: 'Данные отца и матери — имя, гражданство, город рождения' },
    { icon: '🏠', text: 'Адрес регистрации и фактического проживания' },
    { icon: '💼', text: 'Место работы — название, адрес, телефон' },
  ],
  'Вьетнам': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '🏠', text: 'Адрес регистрации / прописки' },
    { icon: '💼', text: 'Место работы или учёбы — название, адрес, телефон' },
    { icon: '📞', text: 'Контакт на экстренный случай — имя, адрес, телефон' },
  ],
  'Шри-Ланка': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '🏠', text: 'Адрес регистрации / прописки' },
  ],
  'Южная Корея': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '💼', text: 'Место работы — название, телефон, примерная зарплата' },
  ],
  'Израиль': [
    { icon: '🛂', text: 'Биометрический загранпаспорт' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '👨‍👩‍👧', text: 'Имена отца и матери (фамилия и имя)' },
    { icon: '🏠', text: 'Домашний адрес — страна и город' },
  ],
  'Пакистан': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '👨‍👩‍👧', text: 'Имена и гражданство отца и матери' },
    { icon: '💼', text: 'Место работы — дата трудоустройства, должность, телефон' },
  ],
  'Камбоджа': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '🏨', text: 'Название и адрес отеля в Камбодже' },
  ],
  'Кения': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '✈️', text: 'Авиабилеты — туда и обратно (номер рейса, авиакомпания)' },
    { icon: '🏨', text: 'Адрес проживания в Кении' },
  ],
  'Филиппины': [
    { icon: '🛂', text: 'Загранпаспорт — не менее 6 мес до окончания' },
    { icon: '📸', text: 'Фото лица — светлый фон, 80% лица' },
    { icon: '✈️', text: 'Авиабилет — номер рейса и авиакомпания' },
    { icon: '🏨', text: 'Адрес отеля на Филиппинах' },
    { icon: '💼', text: 'Место работы (если работаете)' },
  ],
};

// ─── Unified Card Component ───────────────────────────────────────────────────
export interface AddonsState {
  urgent: boolean;
  hotel: boolean;
  ticket: boolean;
}

interface VisaCardProps {
  visa: VisaOption;
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

function VisaCard({ visa, onSelect, isUrgent = false, hideCalculator = false }: VisaCardProps) {
  const [showCalc, setShowCalc] = useState(false);
  const [showDocs, setShowDocs] = useState(true);
  const [urgent, setUrgent] = useState(false);
  const [hotel, setHotel] = useState(false);
  const [ticket, setTicket] = useState(false);

  const docs = COUNTRY_DOCS[visa.country] ?? [];

  // Vietnam already has dedicated urgent options, so no urgent toggle there
  const isVietnam = visa.country === 'Вьетнам';
  const urgentApplied = urgent && !isVietnam;

  const addons = (urgentApplied ? 1000 : 0) + (hotel ? 1000 : 0) + (ticket ? 2000 : 0);
  const total = visa.price + addons;
  const hasAddons = urgentApplied || hotel || ticket;

  const handleSubmit = () => {
    onSelect({ urgent: urgentApplied, hotel, ticket });
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-[#212121] mb-1">{visa.type}</h3>
        {visa.description && (
          <p className="text-sm text-[#616161] mb-1">{visa.description}</p>
        )}
        <p className="text-sm text-[#616161]">Готовность: {visa.readinessTime}</p>
      </div>

      {/* Documents Section */}
      {docs.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowDocs(!showDocs)}
            className="w-full flex items-center justify-between mb-2"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <span className="text-base">📋</span>
              Что понадобится
              <span className="text-xs font-normal text-gray-400 ml-1">
                {docs.length} {docs.length === 1 ? 'пункт' : docs.length < 5 ? 'пункта' : 'пунктов'}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${showDocs ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence initial={false}>
            {showDocs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100">
                  {docs.map((doc, i) => (
                    <div key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                      <span className="text-base shrink-0 mt-0.5">{doc.icon}</span>
                      <span className="text-sm text-gray-700 leading-snug">{doc.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Price Block */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 mb-3 border border-blue-100">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-[#616161] mb-0.5">
              {hasAddons ? 'Базовая цена' : 'Стоимость'}
            </div>
            <div className={`leading-none font-bold ${hasAddons ? 'text-xl text-gray-400 line-through' : 'text-3xl text-[#1976D2]'}`}>
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
                <div className="text-xs text-[#616161] mb-0.5">Итого</div>
                <div className="text-3xl text-[#00C853] font-bold leading-none">
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
                  price={1000}
                  active={urgent}
                  onToggle={() => setUrgent(!urgent)}
                />
              )}
              <AddonToggle
                icon="🏨"
                label="Подтверждение проживания"
                hint="Бронь отеля для визы"
                price={1000}
                active={hotel}
                onToggle={() => setHotel(!hotel)}
              />
              <AddonToggle
                icon="✈️"
                label="Обратный билет"
                hint="Подтверждение возвратного рейса"
                price={2000}
                active={ticket}
                onToggle={() => setTicket(!ticket)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleSubmit}
        className={`w-full py-3.5 rounded-[16px] transition font-medium ${
          isUrgent
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-[#2196F3] hover:bg-[#1E88E5] text-white'
        }`}
      >
        Оформить{hasAddons ? ` за ${total.toLocaleString('ru-RU')}₽` : ''}
      </button>
    </div>
  );
}

function ReferralBanner() {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const referralCode = userData.referralCode ?? '';
  const botUsername = 'Visadel_test_bot';
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (referralCode) {
      getReferralCount(referralCode).then(setFriendCount);
    }
  }, [referralCode]);

  const referralUrl = `https://t.me/${botUsername}?start=${referralCode}`;

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `✈️ Слушай, нашёл где делать визы — всё чётко, без беготни и нервов. Бонус дают новым пользователям 🎁`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink(shareUrl);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!referralCode) return null;

  return (
    <div
      className="mx-4 mb-4 rounded-2xl p-4"
      style={{ background: 'linear-gradient(135deg, #1565C0 0%, #0288D1 50%, #00ACC1 100%)' }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🎁</span>
            <p className="text-white font-bold text-base">Приведи друга — получи 500₽</p>
          </div>
          <p className="text-blue-100 text-xs mb-3">Бонус придёт автоматически, когда друг оформит визу</p>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy link button */}
            <button
              onClick={handleCopy}
              className="bg-white/20 hover:bg-white/30 active:scale-95 transition-all rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5"
            >
              <span className="text-white text-xs">{copied ? '✓' : '🔗'}</span>
              <span className="text-white text-xs font-medium">{copied ? 'Скопировано!' : 'Скопировать ссылку'}</span>
            </button>
            {friendCount !== null && friendCount > 0 && (
              <div className="bg-white/20 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <span className="text-white text-xs">👥</span>
                <span className="text-white text-xs font-semibold">{friendCount}</span>
                <span className="text-blue-200 text-xs">{friendCount === 1 ? 'друг' : friendCount >= 2 && friendCount <= 4 ? 'друга' : 'друзей'}</span>
              </div>
            )}
          </div>
        </div>
        {/* Share arrow — only this triggers forward */}
        <button
          onClick={handleShare}
          className="w-10 h-10 bg-white/20 hover:bg-white/30 active:scale-95 transition-all rounded-full flex items-center justify-center shrink-0"
        >
          <span className="text-lg">→</span>
        </button>
      </div>
    </div>
  );
}

export default function Home({ onVisaSelect, onOpenProfile, onOpenExtension, onOpenPartnerApplication, onOpenAdmin }: HomeProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showUrgentVietnam, setShowUrgentVietnam] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 shadow-md border-b border-gray-100">
        <div className="relative px-3 overflow-hidden" style={{ height: '110px' }}>
          <img
            src={logo}
            alt="Visadel Agency"
            style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', objectPosition: 'top' }}
          />
          <button
            onClick={onOpenProfile}
            className="absolute right-2 top-2 w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md transition"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!selectedCountry && <ReferralBanner />}

      <div className="max-w-2xl mx-auto p-4">
        {/* Country Selection */}
        {!selectedCountry && (
          <div>
            <h2 className="text-xl mb-4 text-gray-800">Выберите страну</h2>
            <div className="grid grid-cols-2 gap-4">
              {COUNTRIES.map((country) => (
                <button
                  key={country.name}
                  onClick={() => handleCountryClick(country)}
                  className="bg-white rounded-2xl p-6 shadow-md active:shadow-inner active:scale-95 transition-all border border-gray-100 flex flex-col items-center gap-3"
                >
                  <span className="text-5xl">{country.flag}</span>
                  <span className="text-gray-800 text-center">{country.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visa Type Selection */}
        {selectedCountry && (
          <div>
            <button
              onClick={handleBackFromCountry}
              className="mb-4 text-[#1976D2] hover:text-[#0D47A1] flex items-center gap-1"
            >
              ← Назад
            </button>

            <div className="bg-white rounded-2xl p-6 shadow-md mb-6">
              <div className="flex items-center gap-4">
                <span className="text-6xl">{selectedCountry.flag}</span>
                <div>
                  <h2 className="text-2xl text-gray-800">{selectedCountry.name}</h2>
                  <p className="text-gray-600 text-sm">
                    {showExtensions ? 'Продление визы' : showUrgentVietnam ? 'Срочное оформление' : 'Выберите тип визы'}
                  </p>
                </div>
              </div>
            </div>

            {/* Extensions for Sri Lanka */}
            {showExtensions && selectedCountry.extensionOptions && (
              <div className="space-y-4">
                {selectedCountry.extensionOptions.map((visa) => (
                  <VisaCard
                    key={visa.id}
                    visa={visa}
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
                    onSelect={(addons) => onVisaSelect(visa, false, addons)}
                  />
                ))}

                <button
                  onClick={() => setShowUrgentVietnam(true)}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white py-4 rounded-[16px] hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  ⚡ Срочные визы
                </button>
              </div>
            )}

            {/* Urgent Vietnam Visas */}
            {selectedCountry.name === 'Вьетнам' && showUrgentVietnam && selectedCountry.urgentOptions && (
              <div className="space-y-4">
                {selectedCountry.urgentOptions.map((visa) => (
                  <VisaCard
                    key={visa.id}
                    visa={visa}
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
  );
}