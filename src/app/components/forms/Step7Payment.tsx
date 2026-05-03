import { useState } from 'react';
import { Upload, Save, CheckCircle } from 'lucide-react';
import type { VisaOption } from '../../App';
import type { FormData } from '../ApplicationForm';
import FormField from './FormField';

interface Step7Props {
  visa: VisaOption;
  isUrgent: boolean;
  formData: FormData;
  onPrev: () => void;
  onSaveDraft: () => void;
}

export default function Step7Payment({ visa, isUrgent, formData, onPrev, onSaveDraft }: Step7Props) {
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const totalPrice = visa.price + (isUrgent ? 1000 : 0);

  const handleSubmit = () => {
    if (!paymentScreenshot) {
      alert('Пожалуйста, загрузите скриншот оплаты');
      return;
    }
    
    setIsSubmitted(true);
    
    // Здесь будет отправка данных на сервер
    setTimeout(() => {
      alert('Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.');
    }, 1000);
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="mb-4">Заявка успешно отправлена!</h2>
        <p className="text-gray-600 mb-6">
          Ваша заявка #{Math.floor(Math.random() * 100000)} принята в обработку.
          Мы свяжемся с вами в течение 24 часов.
        </p>
        <div className="bg-blue-50 p-4 rounded-lg max-w-md mx-auto">
          <p className="text-sm text-blue-900">
            Проверьте свою почту {formData.email} и Telegram {formData.telegram} для получения обновлений по заявке.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-6">Оплата</h2>
      
      <div className="space-y-6 mb-8">
        {/* Разбивка стоимости */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="mb-4">Итоговая сумма</h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">{visa.name}</span>
              <span className="text-gray-900">{visa.price}₽</span>
            </div>
            {isUrgent && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">🚨 Срочное оформление</span>
                <span className="text-red-600">+1000₽</span>
              </div>
            )}
            <div className="flex justify-between py-3 pt-4">
              <span>Итого к оплате:</span>
              <span className="text-blue-600">{totalPrice}₽</span>
            </div>
          </div>
        </div>

        {/* Реквизиты для оплаты */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-900 mb-4">Реквизиты для перевода</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-blue-700 mb-1">Номер карты:</p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-2 rounded border border-blue-200 flex-1">
                  2200 7007 1234 5678
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('2200700712345678');
                    alert('Номер карты скопирован!');
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  Копировать
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-blue-700 mb-1">Получатель:</p>
              <p className="bg-white px-3 py-2 rounded border border-blue-200">
                Visadel Agency
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 mb-1">СБП (Система Быстрых Платежей):</p>
              <div className="flex items-center gap-2">
                <code className="bg-white px-3 py-2 rounded border border-blue-200 flex-1">
                  +7 (999) 123-45-67
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('+79991234567');
                    alert('Номер телефона скопирован!');
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  Копировать
                </button>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm text-blue-700">
                💡 В комментарии к платежу укажите: <strong>Виза {visa.id}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Загрузка скриншота */}
        <FormField 
          label="Загрузите скриншот оплаты" 
          helper="Это подтверждение того, что оплата произведена"
        >
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
            <label className="flex flex-col items-center cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">
                {paymentScreenshot ? '✓ Скриншот выбран' : 'Нажмите для загрузки или перетащите файл'}
              </span>
              <span className="text-xs text-gray-500 mt-1">JPG, PNG (макс. 5MB)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(e) => setPaymentScreenshot(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          {paymentScreenshot && (
            <p className="text-sm text-green-600 mt-2">✓ Скриншот загружен: {paymentScreenshot.name}</p>
          )}
        </FormField>
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
          onClick={onSaveDraft}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Save className="w-5 h-5" />
          Сохранить черновик
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          disabled={!paymentScreenshot}
        >
          Оплатил
        </button>
      </div>
    </div>
  );
}
