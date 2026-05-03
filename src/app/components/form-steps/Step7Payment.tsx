import { useState, useEffect } from 'react';
import { ChevronLeft, Upload, CheckCircle2, Save, CreditCard, Coins } from 'lucide-react';
import type { FormData } from '../ApplicationForm';
import type { VisaOption } from '../../App';

interface Step7Props {
  formData: FormData;
  visa: VisaOption;
  urgent: boolean;
  totalPrice: number;
  onPrev: () => void;
  onComplete: () => void;
}

export default function Step7Payment({ formData, visa, urgent, totalPrice, onPrev, onComplete }: Step7Props) {
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(totalPrice);

  // Get user data
  const userData = JSON.parse(localStorage.getItem('userData') || '{"bonusBalance": 0, "isInfluencer": false}');
  const availableBonuses = userData.bonusBalance || 0;
  const isPartner = userData.isInfluencer || false;

  // Calculate bonus deduction
  useEffect(() => {
    if (useBonuses && availableBonuses > 0) {
      let maxBonusDeduction = 0;
      
      if (isPartner) {
        // Partners can use up to 100% of visa cost
        maxBonusDeduction = Math.min(availableBonuses, totalPrice);
      } else {
        // Regular users: max 1000₽ per visa
        maxBonusDeduction = Math.min(availableBonuses, 1000, totalPrice);
      }
      
      setBonusAmount(maxBonusDeduction);
      setFinalPrice(totalPrice - maxBonusDeduction);
    } else {
      setBonusAmount(0);
      setFinalPrice(totalPrice);
    }
  }, [useBonuses, availableBonuses, totalPrice, isPartner]);

  const handleSaveDraft = () => {
    const draftKey = `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
    const draft = {
      formData,
      step: 6,
      visa,
      urgent,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
    alert('Черновик сохранен! Вы можете вернуться к нему позже.');
  };

  const handlePaymentComplete = () => {
    if (!paymentScreenshot) {
      alert('Пожалуйста, загрузите скриншот оплаты');
      return;
    }

    // Deduct bonuses if used
    if (useBonuses && bonusAmount > 0) {
      const newBonusBalance = availableBonuses - bonusAmount;
      const updatedUserData = { ...userData, bonusBalance: newBonusBalance };
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
    }

    // Save application to applications list
    const applications = JSON.parse(localStorage.getItem('applications') || '[]');
    const newApplication = {
      id: Date.now().toString(),
      visa,
      urgent,
      totalPrice,
      bonusesUsed: bonusAmount,
      finalPrice,
      formData,
      status: 'pending_confirmation',
      createdAt: new Date().toISOString(),
      paymentScreenshot: paymentScreenshot.name,
    };
    applications.push(newApplication);
    localStorage.setItem('applications', JSON.stringify(applications));

    // Remove draft
    const draftKey = `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
    localStorage.removeItem(draftKey);

    alert('Спасибо! Ваша заявка отправлена на обработку. Мы свяжемся с вами в ближайшее время.');
    onComplete();
  };

  const breakdown = [
    { label: visa.type, amount: visa.price },
  ];

  if (formData.additionalDocs.urgentProcessing && visa.country !== 'Вьетнам') {
    breakdown.push({ label: 'Срочное оформление', amount: 1000 });
  }

  if (formData.additionalDocs.hotelBooking) {
    breakdown.push({ label: 'Подтверждение бронирования жилья', amount: 1000 });
  }

  if (formData.additionalDocs.returnTicket) {
    breakdown.push({ label: 'Бронирование авиабилета', amount: 2000 });
  }

  const showBonusBlock = availableBonuses > 0;

  return (
    <div className="bg-[#F5F7FA] rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-2 text-[#212121]">Оплата</h2>
        <p className="text-sm text-[#616161]">
          Переведите средства и загрузите скриншот
        </p>
      </div>

      {/* Payment Details */}
      <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CreditCard className="w-6 h-6 text-[#2196F3] flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-[#212121] mb-2">Реквизиты для оплаты</h3>
            <div className="space-y-1 text-sm text-[#212121]">
              <p><span className="text-[#616161]">Номер карты:</span> 5536 9140 3834 6908</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-[#616161] mt-3">
          После оплаты обязательно загрузите скриншот перевода
        </p>
      </div>

      {/* Bonus Block */}
      {showBonusBlock && (
        <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border-2 border-[#FFC400]">
          <div className="flex items-start gap-3 mb-4">
            <Coins className="w-6 h-6 text-[#FFC400] flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-[#212121] mb-1">Использовать бонусы</h3>
              <p className="text-sm text-[#616161]">
                Доступно: <span className="text-[#FFC400] font-semibold">{availableBonuses}₽</span>
              </p>
              {!isPartner && (
                <p className="text-xs text-[#616161] mt-1">
                  Максимум 1000₽ за одну визу
                </p>
              )}
              {isPartner && (
                <p className="text-xs text-[#00C853] mt-1">
                  🌟 Партнёр: можно оплатить до 100% стоимости
                </p>
              )}
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={() => setUseBonuses(!useBonuses)}
            className={`w-full rounded-[16px] p-4 transition-all duration-200 ${
              useBonuses
                ? 'bg-[#00C853] shadow-lg'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`${useBonuses ? 'text-white' : 'text-[#616161]'}`}>
                {useBonuses ? `Списать ${bonusAmount}₽` : 'Не использовать бонусы'}
              </span>
              <div 
                className={`flex-shrink-0 w-12 h-6 rounded-full transition-colors ${
                  useBonuses ? 'bg-white' : 'bg-gray-400'
                }`}
              >
                <div 
                  className={`w-5 h-5 rounded-full transition-transform duration-200 ${
                    useBonuses ? 'translate-x-6 bg-[#00C853]' : 'translate-x-0.5 bg-white'
                  } mt-0.5`}
                />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Price Breakdown */}
      <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
        <h3 className="text-[#212121] mb-3">Детали оплаты</h3>
        <div className="space-y-2 mb-3">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-[#616161]">{item.label}</span>
              <span className="text-[#212121]">
                {idx === 0 ? `${item.amount}₽` : `+${item.amount}₽`}
              </span>
            </div>
          ))}
          {useBonuses && bonusAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#00C853]">Оплачено бонусами</span>
              <span className="text-[#00C853]">-{bonusAmount}₽</span>
            </div>
          )}
        </div>
        <div className="border-t pt-3 flex justify-between">
          <span className="text-[#212121]">Итого к оплате:</span>
          <span className="text-2xl text-[#2196F3]">{finalPrice}₽</span>
        </div>
      </div>

      {/* Upload Screenshot */}
      <div className="mb-6">
        <label className="block mb-2 text-gray-700">
          Скриншот оплаты
          <span className="text-red-500 ml-1">*</span>
        </label>
        {!paymentScreenshot ? (
          <label className="block border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-600">Нажмите для загрузки скриншота</p>
              <p className="text-xs text-gray-400">JPG, PNG (макс. 5MB)</p>
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    alert('Размер файла не должен превышать 5MB');
                    return;
                  }
                  setPaymentScreenshot(file);
                }
              }}
              className="hidden"
            />
          </label>
        ) : (
          <div className="border-2 border-green-500 bg-green-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm text-gray-800">{paymentScreenshot.name}</p>
                  <p className="text-xs text-gray-500">
                    {(paymentScreenshot.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaymentScreenshot(null)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Изменить
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <button
          onClick={handlePaymentComplete}
          className="w-full bg-[#00C853] text-white py-4 rounded-[16px] hover:bg-[#00E676] hover:shadow-lg transition flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          Оплатил
        </button>

        <button
          onClick={handleSaveDraft}
          className="w-full bg-blue-100 text-blue-700 py-4 rounded-[16px] hover:bg-blue-200 transition flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          Сохранить черновик
        </button>

        <button
          onClick={onPrev}
          className="w-full bg-gray-100 text-gray-700 py-4 rounded-[16px] hover:bg-gray-200 transition flex items-center justify-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>
      </div>
    </div>
  );
}
