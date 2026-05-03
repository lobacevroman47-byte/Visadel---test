import { Check } from 'lucide-react';
import { ApplicationData } from '../ApplicationForm';

interface Step3Props {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onNext: () => void;
}

export default function Step3HearAbout({ data, onChange, onNext }: Step3Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  const toggleHearAbout = (key: keyof ApplicationData['hearAbout']) => {
    onChange({
      ...data,
      hearAbout: {
        ...data.hearAbout,
        [key]: !data.hearAbout[key]
      }
    });
  };

  const options = [
    { key: 'telegram' as const, label: 'Telegram', icon: '📱' },
    { key: 'youtube' as const, label: 'YouTube', icon: '📺' },
    { key: 'instagram' as const, label: 'Instagram', icon: '📸' },
    { key: 'vk' as const, label: 'VK', icon: '🔵' },
    { key: 'rutube' as const, label: 'RuTube', icon: '🎬' },
    { key: 'friends' as const, label: 'От друзей', icon: '👥' },
    { key: 'previousVisa' as const, label: 'Оформлял(-а) визу ранее', icon: '✈️' }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Как вы узнали о нас?</h2>
        <p className="text-sm text-gray-500 mb-6">
          Выберите один или несколько вариантов
        </p>
      </div>

      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => toggleHearAbout(option.key)}
            className={`w-full p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
              data.hearAbout[option.key]
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{option.icon}</span>
                <span className="text-gray-900">{option.label}</span>
              </div>
              {data.hearAbout[option.key] && (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-sm text-purple-900">
          📊 Ваш ответ поможет нам улучшить сервис и предложить вам лучшие условия
        </p>
      </div>

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
      >
        Продолжить
      </button>
    </form>
  );
}
