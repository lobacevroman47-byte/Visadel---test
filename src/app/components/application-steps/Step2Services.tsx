import { Check } from 'lucide-react';
import { ApplicationData } from '../ApplicationForm';

interface Step2Props {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  onNext: () => void;
}

export default function Step2Services({ data, onChange, onNext }: Step2Props) {
  const returnTicketPrice = 2000;
  const hotelBookingPrice = 2000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Дополнительные услуги</h2>
        <p className="text-sm text-gray-500 mb-6">
          Выберите дополнительные услуги для комфортной поездки
        </p>
      </div>

      <div
        onClick={() => onChange({ ...data, returnTicket: !data.returnTicket })}
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
          data.returnTicket
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
              data.returnTicket
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300 bg-white'
            }`}
          >
            {data.returnTicket && <Check className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-gray-900">Бронирование обратного билета</h3>
              <span className="text-blue-600">+{returnTicketPrice}₽</span>
            </div>
            <p className="text-sm text-gray-600">
              Мы забронируем для вас обратный билет, который требуется для получения визы. 
              Билет будет действителен 48 часов.
            </p>
          </div>
        </div>
      </div>

      <div
        onClick={() => onChange({ ...data, insurance: !data.insurance })}
        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
          data.insurance
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
              data.insurance
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300 bg-white'
            }`}
          >
            {data.insurance && <Check className="w-4 h-4 text-white" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-gray-900">Медицинская страховка</h3>
              <span className="text-blue-600">+{insurancePrice}₽</span>
            </div>
            <p className="text-sm text-gray-600">
              Полис медицинского страхования с покрытием до $50,000. 
              Действует на территории страны назначения весь период действия визы.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          💡 <strong>Рекомендация:</strong> Для получения визы в большинство стран требуется 
          подтверждение обратного билета и медицинская страховка. Мы рекомендуем 
          воспользоваться этими услугами.
        </p>
      </div>

      {(data.returnTicket || data.insurance) && (
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700">Дополнительные услуги:</span>
            <span className="text-gray-900">
              {(data.returnTicket ? returnTicketPrice : 0) + 
               (data.insurance ? insurancePrice : 0)}₽
            </span>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
      >
        Далее
      </button>
    </form>
  );
}
