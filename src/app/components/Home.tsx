import { useState } from 'react';
import { motion } from 'motion/react';
import { User, ChevronRight, Settings } from 'lucide-react';
import type { VisaOption } from '../App';
import logo from '../../assets/logo2.png';

interface HomeProps {
  onVisaSelect: (visa: VisaOption, urgent?: boolean) => void;
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
      { id: 'india-5y', country: 'Индия', type: 'E-VISA на 5 лет', duration: '5 лет', price: 11490, readinessTime: '1-3 дня (Возможны задержки до 10 дней)', description: 'Пребывание - максимум 90 дней за раз, 180 дней в год' },
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
      { id: 'pakistan', country: 'Пакистан', type: 'E-VISA до 90 дней', duration: '90 дней', price: 2490, readinessTime: '1-3 дня' },
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
];

// Unified Card Component
interface VisaCardProps {
  visa: VisaOption;
  onSelect: () => void;
  isUrgent?: boolean;
}

function VisaCard({ visa, onSelect, isUrgent = false }: VisaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-md border border-gray-100"
    >
      <div className="mb-3">
        <h3 className="text-[#212121] mb-1">{visa.type}</h3>
        {visa.description && (
          <p className="text-sm text-[#616161] mb-1">({visa.description})</p>
        )}
        <p className="text-sm text-[#616161]">Готовность: {visa.readinessTime}</p>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <span className="text-[#616161] text-sm">Стоимость:</span>
        <span className="text-2xl text-[#2196F3]">{visa.price}₽</span>
      </div>

      <button
        onClick={onSelect}
        className={`w-full py-3.5 rounded-[16px] transition ${
          isUrgent
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-[#2196F3] hover:bg-[#1E88E5] text-white'
        }`}
      >
        Оформить
      </button>
    </motion.div>
  );
}

export default function Home({ onVisaSelect, onOpenProfile, onOpenExtension, onOpenPartnerApplication, onOpenAdmin }: HomeProps) {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showUrgentVietnam, setShowUrgentVietnam] = useState(false);
  const [showExtensions, setShowExtensions] = useState(false);

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
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 shadow-md border-b border-gray-100">
        <div className="relative px-3 py-1">
          <img
            src={logo}
            alt="Visadel Agency"
            style={{ width: '100%', height: 'auto', maxHeight: '52px', display: 'block', objectFit: 'contain' }}
          />
          <button
            onClick={onOpenProfile}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow transition"
          >
            <User className="w-3.5 h-3.5" />
            Войти
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Country Selection */}
        {!selectedCountry && (
          <>
            <h2 className="text-xl mb-4 text-gray-800">Выберите страну</h2>
            <div className="grid grid-cols-2 gap-4">
              {COUNTRIES.map((country, index) => (
                <motion.button
                  key={country.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleCountryClick(country)}
                  className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all border border-gray-100 flex flex-col items-center gap-3"
                >
                  <span className="text-5xl">{country.flag}</span>
                  <span className="text-gray-800 text-center">{country.name}</span>
                </motion.button>
              ))}
            </div>
          </>
        )}

        {/* Visa Type Selection */}
        {selectedCountry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
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
                    onSelect={() => onVisaSelect(visa)}
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
                    onSelect={() => onVisaSelect(visa, true)}
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
                    onSelect={() => onVisaSelect(visa)}
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
          </motion.div>
        )}
      </div>
    </div>
  );
}