import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface Step3Props {
  data: string[];
  onChange: (data: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
}

const OPTIONS = [
  { value: 'telegram', label: 'Telegram', icon: '📱', color: 'bg-blue-100 border-blue-300' },
  { value: 'youtube', label: 'YouTube', icon: '▶️', color: 'bg-red-100 border-red-300' },
  { value: 'instagram', label: 'Instagram', icon: '📷', color: 'bg-pink-100 border-pink-300' },
  { value: 'vk', label: 'VK', icon: '🔵', color: 'bg-blue-100 border-blue-300' },
  { value: 'rutube', label: 'RuTube', icon: '🎬', color: 'bg-purple-100 border-purple-300' },
  { value: 'friends', label: 'Посоветовали друзья', icon: '👥', color: 'bg-green-100 border-green-300' },
  { value: 'repeat', label: 'Оформлял(-а) визу ранее', icon: '🔄', color: 'bg-gray-100 border-gray-300' },
];

export default function Step3HowHeard({ data, onChange, onNext, onPrev }: Step3Props) {
  const [selected, setSelected] = useState<string[]>(data);

  useEffect(() => {
    onChange(selected);
  }, [selected]);

  const toggleOption = (value: string) => {
    setSelected(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
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
        <p className="text-gray-600 text-sm">
          Выберите один или несколько вариантов
        </p>
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
              <span className="text-3xl">{option.icon}</span>
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