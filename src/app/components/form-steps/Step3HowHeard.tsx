import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Users, RefreshCw } from 'lucide-react';
import { useDialog } from '../shared/BrandDialog';
import { Button } from '../ui/brand';

interface Step3Props {
  data: string[];
  onChange: (data: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ── Official brand SVG logos ──────────────────────────────────────────────────

const TelegramIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#26A5E4"/>
    <path
      d="M5.5 11.5 27.5 10"
      fill="none"
    />
    {/* Official Telegram paper-plane path */}
    <path
      d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      fill="#26A5E4"
    />
    {/* Cleaner render: use rect+path on white */}
    <rect width="24" height="24" rx="12" fill="#26A5E4"/>
    <path
      d="M10.2 16.3l-.4 2.8c.6 0 .8-.3 1.1-.5l2.7-2.5 5.6 4c1 .5 1.7.3 2-.9l3.6-16.4c.3-1.5-.6-2-1.5-1.7L1.1 9.3C-.3 9.8-.2 10.7.9 11l4.9 1.5 11.4-7c.5-.3 1-.1.6.2z"
      fill="white"
    />
  </svg>
);

const YouTubeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5" fill="#FF0000"/>
    <path
      d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088C19.35 3.6 12 3.6 12 3.6s-7.35 0-9.407.517A3.007 3.007 0 0 0 .505 6.205 31.247 31.247 0 0 0 0 12a31.247 31.247 0 0 0 .505 5.795 3.007 3.007 0 0 0 2.088 2.088C4.65 20.4 12 20.4 12 20.4s7.35 0 9.407-.517a3.007 3.007 0 0 0 2.088-2.088A31.247 31.247 0 0 0 24 12a31.247 31.247 0 0 0-.505-5.795zM9.609 15.601V8.399L15.873 12z"
      fill="white"
    />
  </svg>
);

const InstagramIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <defs>
      <radialGradient id="ig1" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497"/>
        <stop offset="10%" stopColor="#fdf497"/>
        <stop offset="50%" stopColor="#fd5949"/>
        <stop offset="68%" stopColor="#d6249f"/>
        <stop offset="100%" stopColor="#285AEB"/>
      </radialGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig1)"/>
    <rect x="4.5" y="4.5" width="15" height="15" rx="4.5" stroke="white" strokeWidth="1.6" fill="none"/>
    <circle cx="12" cy="12" r="3.7" stroke="white" strokeWidth="1.6" fill="none"/>
    <circle cx="17" cy="7" r="1.1" fill="white"/>
  </svg>
);

const TikTokIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5" fill="#010101"/>
    {/* Cyan shadow copy */}
    <path
      d="M14.3 2.5h2.5a4.8 4.8 0 0 0 4.7 4.2v2.5a7.3 7.3 0 0 1-4.2-1.3v6.1a5.5 5.5 0 1 1-5.5-5.5h.7v2.5a3 3 0 1 0 3 3V2.5h-1.2z"
      fill="#69C9D0"
      transform="translate(0.5 0)"
    />
    {/* Red shadow copy */}
    <path
      d="M14.3 2.5h2.5a4.8 4.8 0 0 0 4.7 4.2v2.5a7.3 7.3 0 0 1-4.2-1.3v6.1a5.5 5.5 0 1 1-5.5-5.5h.7v2.5a3 3 0 1 0 3 3V2.5h-1.2z"
      fill="#EE1D52"
      transform="translate(-0.5 0)"
    />
    {/* White main shape */}
    <path
      d="M14.3 2.5h2.5a4.8 4.8 0 0 0 4.7 4.2v2.5a7.3 7.3 0 0 1-4.2-1.3v6.1a5.5 5.5 0 1 1-5.5-5.5h.7v2.5a3 3 0 1 0 3 3V2.5h-1.2z"
      fill="white"
    />
  </svg>
);

const VKIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5.5" fill="#0077FF"/>
    <path
      d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.523-2.049-1.713-1.033-1-1.49-.9-1.746-.9-.356 0-.458.103-.458.6v1.563c0 .43-.136.687-1.27.687-1.87 0-3.947-1.135-5.406-3.24C4.716 11.668 4 9.563 4 9.11c0-.254.1-.492.597-.492h1.744c.444 0 .613.203.785.677.866 2.495 2.318 4.68 2.917 4.68.223 0 .326-.103.326-.668V10.16c-.066-1.2-.703-1.3-.703-1.727 0-.203.168-.407.44-.407h2.743c.376 0 .51.203.51.643v3.473c0 .378.168.51.274.51.223 0 .407-.132.814-.54 1.256-1.406 2.154-3.573 2.154-3.573.119-.254.324-.49.768-.49h1.744c.526 0 .641.27.526.643-.22 1.017-2.367 4.052-2.367 4.052-.187.306-.255.44 0 .78.187.254.8.78 1.21 1.253.75.847 1.32 1.558 1.473 2.049.135.485-.1.733-.585.733z"
      fill="white"
    />
  </svg>
);

const RuTubeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="5" fill="#FF4200"/>
    {/* RT logo: stylized letters RU */}
    <text x="3.5" y="16.5" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="11" fill="white" letterSpacing="-0.5">Ru</text>
    <rect x="3" y="17.5" width="18" height="2.5" rx="1.2" fill="white" opacity="0.8"/>
    {/* Play triangle */}
    <path d="M15 10.5l4.5 2.5-4.5 2.5V10.5z" fill="white"/>
  </svg>
);

const FriendsIcon = () => (
  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
    <Users className="w-4 h-4 text-white" strokeWidth={2.5} />
  </div>
);

const RepeatCustomerIcon = () => (
  <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center">
    <RefreshCw className="w-4 h-4 text-white" strokeWidth={2.5} />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────

const OPTIONS = [
  { value: 'telegram',  label: 'Telegram',               icon: <TelegramIcon />,        color: 'bg-sky-50   border-sky-200'    },
  { value: 'youtube',   label: 'YouTube',                 icon: <YouTubeIcon />,         color: 'bg-red-50   border-red-200'    },
  { value: 'instagram', label: 'Instagram',               icon: <InstagramIcon />,       color: 'bg-pink-50  border-pink-200'   },
  { value: 'tiktok',    label: 'TikTok',                  icon: <TikTokIcon />,          color: 'bg-gray-100 border-gray-300'   },
  { value: 'vk',        label: 'VK',                      icon: <VKIcon />,              color: 'bg-blue-50  border-blue-200'   },
  { value: 'rutube',    label: 'RuTube',                  icon: <RuTubeIcon />,          color: 'bg-orange-50 border-orange-200'},
  { value: 'friends',   label: 'Посоветовали друзья',     icon: <FriendsIcon />,         color: 'bg-green-50 border-green-200'  },
  { value: 'repeat',    label: 'Оформлял(-а) визу ранее', icon: <RepeatCustomerIcon />,  color: 'bg-slate-50 border-slate-200'  },
];

export default function Step3HowHeard({ data, onChange, onNext, onPrev }: Step3Props) {
  const dialog = useDialog();
  const [selected, setSelected] = useState<string[]>(data);

  useEffect(() => { onChange(selected); }, [selected]);

  const toggle = (value: string) =>
    setSelected(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);

  const handleNext = async () => {
    if (selected.length === 0) {
      await dialog.warning('Выберите хотя бы один вариант');
      return;
    }
    onNext();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-2 text-gray-800">Как вы о нас узнали?</h2>
        <p className="text-gray-600 text-sm">Выберите один или несколько вариантов</p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-6">
        {OPTIONS.map(option => {
          const active = selected.includes(option.value);
          return (
            <div
              key={option.value}
              onClick={() => toggle(option.value)}
              className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                active
                  ? `${option.color} border-[#3B5BFF] shadow-md`
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  active ? 'border-[#3B5BFF] bg-[#3B5BFF]' : 'border-gray-300'
                }`}>
                  {active && (
                    <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </div>
                {/* Logo */}
                <div className="flex-shrink-0">{option.icon}</div>
                {/* Label */}
                <span className="text-gray-800 font-medium">{option.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="!py-4"
          onClick={onPrev}
          leftIcon={<ChevronLeft className="w-5 h-5" />}
        >
          Назад
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="!py-4 !rounded-2xl"
          onClick={handleNext}
          rightIcon={<ChevronRight className="w-5 h-5" />}
        >
          Далее
        </Button>
      </div>
    </div>
  );
}
