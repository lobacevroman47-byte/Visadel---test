import type { FormData } from '../ApplicationForm';

interface Step3Props {
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step3HowKnow({ formData, updateFormData, onNext, onPrev }: Step3Props) {
  const sources = [
    { id: 'telegram', label: 'Telegram', icon: '📱' },
    { id: 'youtube', label: 'YouTube', icon: '▶️' },
    { id: 'instagram', label: 'Instagram', icon: '📸' },
    { id: 'vk', label: 'VK', icon: '🔵' },
    { id: 'rutube', label: 'RuTube', icon: '🎬' },
    { id: 'friends', label: 'Друзья', icon: '👥' },
    { id: 'previous', label: 'Оформлял(-а) визу ранее', icon: '✓' },
  ];

  const selectedSources = formData.howKnow || [];

  const toggleSource = (sourceId: string) => {
    const newSources = selectedSources.includes(sourceId)
      ? selectedSources.filter((id: string) => id !== sourceId)
      : [...selectedSources, sourceId];
    updateFormData({ howKnow: newSources });
  };

  return (
    <div>
      <h2 className="mb-6">Как узнали о нас?</h2>
      
      <div className="space-y-4 mb-8">
        {sources.map((source) => (
          <label
            key={source.id}
            className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedSources.includes(source.id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedSources.includes(source.id)}
              onChange={() => toggleSource(source.id)}
              className="w-5 h-5"
            />
            <span className="text-2xl">{source.icon}</span>
            <span className="flex-1">{source.label}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
