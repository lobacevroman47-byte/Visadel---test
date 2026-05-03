import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Users, RefreshCw } from 'lucide-react';

interface Step3Props {
  data: string[];
  onChange: (data: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
    <circle cx="12" cy="12" r="12" fill="#29B6F6"/>
    <path d="M5.5 12l2.8 2.8L17.5 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M4.5 11.5l4.5 1.5 1.5 4.5 2-3 3-1-11-2z" fill="white" opacity="0.9"/>
    <path d="M4 11.2l15-5.7-5.5 14.3-2.8-5.2-6.7-3.4z" fill="white"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
    <rect width="24" height="24" rx="5" fill="#FF0000"/>
    <path d="M19.6 8.2a2 2 0 00-1.4-1.4C16.8 6.5 12 6.5 12 6.5s-4.8 0-6.2.3a2 2 0 00-1.4 1.4C4.1 9.6 4.1 12 4.1 12s0 2.4.3 3.8a2 2 0 001.4 1.4c1.4.3 6.2.3 6.2.3s4.8 0 6.2-.3a2 2 0 001.4-1.4c.3-1.4.3-3.8.3-3.8s0-2.4-.3-3.8z" fill="white"/>
    <path d="M10 14.5V9.5l5 2.5-5 2.5z" fill="#FF0000"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7">
    <defs>
      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497"/>
        <stop offset="5%" stopColor="#fdf497"/>
        <stop offset="45%" stopColor="#fd5949"/>
        <stop offset="60%" stopColor="#d6249f"/>
        <stop offset="90%" stopColor="#285AEB"/>
      </radialGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig-grad)"/>
    <rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="white" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3.5" fill="none" stroke="white" strokeWidth="1.5"/>
    <circle cx="16.8" cy="7.2" r="1" fill="white"/>
  </svg>
);

const VKIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
    <rect width="24" height="24" rx="5" fill="#0077FF"/>
    <path d="M4 8h2.5s.2 3.5 1.5 4.5c0 0 .5.5 1-.5V8h2.5v4s.5 2 2 2.5c0 0 1 .3 1-1.5V8H17v5.5s0 2.5-2.5 2.5c-2 0-3-1.5-3-1.5s-1 1.5-3 1.5c-2.5 0-4.5-3-4.5-3V8z" fill="white"/>
  </svg>
);

const RuTubeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
    <rect width="24" height="24" rx="5" fill="#FF4200"/>
    <path d="M8 7h4.5a3 3 0 010 6H10v4H8V7z" fill="white"/>
    <path d="M10 11h2.5a1 1 0 000-2H10v2z" fill="#FF4200"/>
    <path d="M12.5 13L15 17h-2.5l-2-4h2z" fill="white"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
    <rect width="24" height="24" rx="5" fill="#010101"/>
    <path d="M16 5.5a4 4 0 01-4-4v8.5a2.5 2.5 0 10-2.5-2.5V5.5a6 6 0 106 6V8a6.5 6.5 0 003.5 1V6.5A4 4 0 0116 5.5z" fill="white" opacity="0"/>
    <path d="M14.5 4.5c.3 1.5 1.3 2.7 2.5 3v2a5.5 5.5 0 01-2.5-.7v5.2a4 4 0 11-4-4c.2 0 .3 0 .5.1v2.1a2 2 0 100 0V4.5h3.5z" fill="white"/>
    <path d="M14.5 4.5c.3 1.5 1.3 2.7 2.5 3v2a5.5 5.5 0 01-2.5-.7v5.2a4 4 0 11-4-4v2.1a2 2 0 100 0V4.5h4z" fill="#EE1D52" opacity="0.5"/>
    <path d="M14 4.5c.3 1.5 1.3 2.7 2.5 3v2a5.5 5.5 0 01-2.5-.7v5.2a4 4 0 11-4-4v2.1a2 2 0 100 0V4.5h4z" fill="white"/>
    <path d="M10.5 14.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" fill="#010101"/>
    <path d="M17.5 7.5a4.5 4.5 0 01-3-2.8V4h-3v8.5a1.5 1.5 0 11-1-1.4V8.9a4 4 0 103.5 3.9V7.2a6.5 6.5 0 003.5 1V5.7a4.5 4.5 0 01-3-1.5" fill="none"/>
    <path d="M10 5h4c0 2 1.5 3.5 3.5 3.5v3A6.5 6.5 0 0114 10v5a3.5 3.5 0 11-3.5-3.5c.2 0 .3 0 .5.1V9.5A6 6 0 0010 5z" fill="white"/>
  </svg>
);

const FriendsIcon = () => (
  <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
    <Users className="w-4 h-4 text-white" />
  </div>
);

const RepeatIcon = () => (
  <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center">
    <RefreshCw className="w-4 h-4 text-white" />
  </div>
);

const OPTIONS = [
  { value: 'telegram', label: 'Telegram', icon: <TelegramIcon />, color: 'bg-blue-50 border-blue-200' },
  { value: 'youtube', label: 'YouTube', icon: <YouTubeIcon />, color: 'bg-red-50 border-red-200' },
  { value: 'instagram', label: 'Instagram', icon: <InstagramIcon />, color: 'bg-pink-50 border-pink-200' },
  { value: 'tiktok', label: 'TikTok', icon: <TikTokIcon />, color: 'bg-gray-50 border-gray-200' },
  { value: 'vk', label: 'VK', icon: <VKIcon />, color: 'bg-blue-50 border-blue-200' },
  { value: 'rutube', label: 'RuTube', icon: <RuTubeIcon />, color: 'bg-orange-50 border-orange-200' },
  { value: 'friends', label: 'Посоветовали друзья', icon: <FriendsIcon />, color: 'bg-green-50 border-green-200' },
  { value: 'repeat', label: 'Оформлял(-а) визу ранее', icon: <RepeatIcon />, color: 'bg-gray-50 border-gray-200' },
];

export default function Step3HowHeard({ data, onChange, onNext, onPrev }: Step3Props) {
  const [selected, setSelected] = useState<string[]>(data);

  useEffect(() => {
    onChange(selected);
  }, [selected]);

  const toggleOption = (value: string) => {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleNext = () => {
    if (selected.length === 0) {
      alert('Пожалуйста, выберите хотя бы один вариант');
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
        {OPTIONS.map(option => (
          <div
            key={option.value}
            onClick={() => toggleOption(option.value)}
            className={`border-2 rounded-xl p-4 cursor-pointer transition ${
              selected.includes(option.value)
                ? `${option.color} border-blue-500 shadow-md`
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                selected.includes(option.value)
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-gray-300'
              }`}>
                {selected.includes(option.value) && (
                  <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                    <path d="M5 13l4 4L19 7"></path>
                  </svg>
                )}
              </div>
              <div className="flex-shrink-0">{option.icon}</div>
              <span className="text-gray-800">{option.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
        <button
          onClick={handleNext}
          className="flex-1 bg-[#2196F3] text-white py-4 rounded-[16px] hover:bg-[#1E88E5] transition flex items-center justify-center gap-2"
        >
          Далее
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
