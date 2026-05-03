import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface Step2Props {
  country: string;
  data: {
    hotelBooking: boolean;
    returnTicket: boolean;
    urgentProcessing: boolean;
  };
  onChange: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function Step2AdditionalDocs({ country, data, onChange, onNext, onPrev }: Step2Props) {
  const [formData, setFormData] = useState(data);

  useEffect(() => {
    onChange(formData);
  }, [formData]);

  const toggleOption = (option: 'hotelBooking' | 'returnTicket' | 'urgentProcessing') => {
    setFormData(prev => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  // Вьетнам не имеет дополнительных опций (уже включено в стоимость)
  const showOptions = country !== 'Вьетнам';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-2 text-[#212121]">Дополнительные опции</h2>
        <p className="text-[#616161] text-sm">
          {showOptions 
            ? 'Выберите дополнительные услуги для вашей заявки' 
            : 'Для Вьетнама дополнительные опции недоступны'}
        </p>
      </div>

      {showOptions && (
        <div className="space-y-4 mb-6">
          {/* Urgent Processing */}
          <button
            onClick={() => toggleOption('urgentProcessing')}
            className={`w-full rounded-[16px] p-5 transition-all duration-200 ${
              formData.urgentProcessing
                ? 'bg-[#00C853] shadow-lg shadow-green-200'
                : 'bg-[#00C853] opacity-50 hover:opacity-70'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">⚡</span>
              <div className="flex-1 text-left">
                <p className="text-white text-lg mb-1">Срочное оформление</p>
                <p className="text-white/90 text-sm">
                  Ваша заявка будет обработана в приоритетном порядке
                </p>
              </div>
              <div 
                className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
                style={{
                  backgroundColor: formData.urgentProcessing ? 'white' : 'transparent'
                }}
              >
                {formData.urgentProcessing && (
                  <div className="w-3 h-3 rounded-full bg-[#00C853]"></div>
                )}
              </div>
            </div>
          </button>

          {/* Hotel Booking */}
          <button
            onClick={() => toggleOption('hotelBooking')}
            className={`w-full rounded-[16px] p-5 transition-all duration-200 ${
              formData.hotelBooking
                ? 'bg-[#00C853] shadow-lg shadow-green-200'
                : 'bg-[#00C853] opacity-50 hover:opacity-70'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🏨</span>
              <div className="flex-1 text-left">
                <p className="text-white text-lg mb-1">Подтверждение бронирования жилья</p>
                <p className="text-white/90 text-sm">
                  Показывает, где вы остановитесь, и облегчает прохождение границы
                </p>
              </div>
              <div 
                className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
                style={{
                  backgroundColor: formData.hotelBooking ? 'white' : 'transparent'
                }}
              >
                {formData.hotelBooking && (
                  <div className="w-3 h-3 rounded-full bg-[#00C853]"></div>
                )}
              </div>
            </div>
          </button>

          {/* Return Ticket */}
          <button
            onClick={() => toggleOption('returnTicket')}
            className={`w-full rounded-[16px] p-5 transition-all duration-200 ${
              formData.returnTicket
                ? 'bg-[#00C853] shadow-lg shadow-green-200'
                : 'bg-[#00C853] opacity-50 hover:opacity-70'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">✈️</span>
              <div className="flex-1 text-left">
                <p className="text-white text-lg mb-1">Бронирование авиабилета</p>
                <p className="text-white/90 text-sm">
                  Помогает показать намерение покинуть страну вовремя
                </p>
              </div>
              <div 
                className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center"
                style={{
                  backgroundColor: formData.returnTicket ? 'white' : 'transparent'
                }}
              >
                {formData.returnTicket && (
                  <div className="w-3 h-3 rounded-full bg-[#00C853]"></div>
                )}
              </div>
            </div>
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onPrev}
          className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-[16px] hover:bg-gray-200 transition flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-[#2196F3] text-white py-4 rounded-[16px] hover:bg-[#1E88E5] transition flex items-center justify-center gap-2"
        >
          Далее
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}