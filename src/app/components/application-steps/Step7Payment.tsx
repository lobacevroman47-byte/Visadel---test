import { useState, useEffect } from 'react';
import { Copy, Upload, Check, CreditCard, AlertCircle } from 'lucide-react';
import { ApplicationData } from '../ApplicationForm';
import { getAppSettings } from '../../lib/db';

interface Step7Props {
  data: ApplicationData;
  onChange: (data: ApplicationData) => void;
  country: string;
  duration: string;
  isUrgent: boolean;
  onSaveDraft: () => void;
  onComplete: () => void;
}

const COUNTRY_PRICES: Record<string, Record<string, number>> = {
  'Индия': { 'E-VISA 30 дней': 5490, 'E-VISA 1 год': 7490, 'E-VISA 5 лет': 11490 },
  'Вьетнам': { 'E-VISA 90 дней однократная': 5490, 'E-VISA 90 дней многократная': 8490 },
  'Южная Корея': { 'K-ETA 3 года': 3490 },
  'Израиль': { 'ETA 2 года': 3490 },
  'Камбоджа': { 'E-VISA 30 дней': 6490 },
  'Кения': { 'ETA 90 дней': 6490 },
  'Пакистан': { 'E-VISA до 90 дней': 2490 },
  'Шри-Ланка': { 'ETA 30 дней (РФ)': 2490, 'ETA 30 дней (другие страны)': 8490 }
};

export default function Step7Payment({ 
  data, 
  onChange, 
  country, 
  duration, 
  isUrgent,
  onSaveDraft,
  onComplete 
}: Step7Props) {
  const [copied, setCopied] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const basePrice = COUNTRY_PRICES[country]?.[duration] || 3000;
  const urgentFee = isUrgent ? 1000 : 0;
  const ticketFee = data.returnTicket ? 2000 : 0;
  const hotelFee = data.hotelBooking ? 2000 : 0;
  const totalPrice = basePrice + urgentFee + ticketFee + hotelFee;

  const [cardNumber, setCardNumber] = useState('5536 9140 3834 6908');

  useEffect(() => {
    let alive = true;
    getAppSettings().then(s => {
      if (!alive) return;
      if (s.payment_card_number) setCardNumber(s.payment_card_number);
    }).catch(() => { /* defaults stay */ });
    return () => { alive = false; };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(cardNumber.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5 МБ');
        return;
      }
      onChange({ ...data, paymentScreenshot: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!data.paymentScreenshot) {
      alert('Пожалуйста, загрузите скриншот оплаты');
      return;
    }

    // Save application to localStorage
    const application = {
      id: Date.now().toString(),
      country,
      duration,
      isUrgent,
      ...data,
      totalPrice,
      status: 'pending_confirmation',
      createdAt: new Date().toISOString()
    };

    const applications = JSON.parse(localStorage.getItem('visaApplications') || '[]');
    applications.push(application);
    localStorage.setItem('visaApplications', JSON.stringify(applications));

    alert('Заявка отправлена! Ожидайте подтверждения оплаты.');
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl mb-4 text-gray-900">Оплата</h2>
        <p className="text-sm text-gray-500 mb-6">
          Переведите указанную сумму и загрузите скриншот оплаты
        </p>
      </div>

      {/* Price Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-gray-900 mb-3">Детали оплаты</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Виза ({country} - {duration}):</span>
            <span className="text-gray-900">{basePrice}₽</span>
          </div>
          {isUrgent && (
            <div className="flex justify-between">
              <span className="text-gray-600">Срочное оформление:</span>
              <span className="text-gray-900">{urgentFee}₽</span>
            </div>
          )}
          {data.returnTicket && (
            <div className="flex justify-between">
              <span className="text-gray-600">Обратный билет:</span>
              <span className="text-gray-900">{ticketFee}₽</span>
            </div>
          )}
          {data.hotelBooking && (
            <div className="flex justify-between">
              <span className="text-gray-600">Бронирование отеля:</span>
              <span className="text-gray-900">{hotelFee}₽</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-900">Итого к оплате:</span>
              <span className="text-xl text-gray-900">{totalPrice}₽</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5" />
          <h3>Реквизиты для перевода</h3>
        </div>
        
        <div className="space-y-3">
          <div>
            <p className="text-sm opacity-80 mb-1">Номер карты:</p>
            <div className="flex items-center justify-between bg-white/20 rounded-lg p-3">
              <span className="text-xl tracking-wider">{cardNumber}</span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          
          <div>
            <p className="text-sm opacity-80 mb-1">Сумма:</p>
            <div className="bg-white/20 rounded-lg p-3">
              <span className="text-xl">{totalPrice}₽</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-900">
              После перевода обязательно загрузите скриншот оплаты. 
              Без подтверждения заявка не будет обработана.
            </p>
          </div>
        </div>
      </div>

      {/* Screenshot Upload */}
      <div>
        <label className="block text-sm mb-3 text-gray-700">
          Скриншот оплаты
        </label>
        
        {!screenshotPreview ? (
          <label className="block">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleScreenshotUpload}
              className="hidden"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-700 mb-1">Загрузите скриншот платежа</p>
              <p className="text-sm text-gray-500">JPG, PNG (макс. 5MB)</p>
            </div>
          </label>
        ) : (
          <div className="relative">
            <img
              src={screenshotPreview}
              alt="Payment screenshot"
              className="w-full h-64 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={() => {
                onChange({ ...data, paymentScreenshot: null });
                setScreenshotPreview(null);
              }}
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleSubmit}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 rounded-xl hover:opacity-90 transition-opacity"
        >
          Я оплатил
        </button>
        
        <button
          type="button"
          onClick={onSaveDraft}
          className="w-full bg-gray-200 text-gray-700 py-4 rounded-xl hover:bg-gray-300 transition-colors"
        >
          Сохранить черновик
        </button>
      </div>

      <p className="text-xs text-center text-gray-500">
        Черновик сохраняется автоматически и будет доступен в течение 30 дней
      </p>
    </div>
  );
}
