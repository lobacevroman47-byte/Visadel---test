import { useState, useEffect } from 'react';
import { ChevronLeft, Upload, CheckCircle2, Save, CreditCard, Coins, Loader2 } from 'lucide-react';
import type { FormData } from '../ApplicationForm';
import type { VisaOption } from '../../App';
import { saveApplication, uploadFile } from '../../lib/db';
import { haptic } from '../../lib/telegram';

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
  const [submitting, setSubmitting] = useState(false);

  const userData = JSON.parse(localStorage.getItem('userData') || '{"bonusBalance": 0, "isInfluencer": false}');
  const telegramId: number = userData.telegramId ?? 0;
  const availableBonuses = userData.bonusBalance || 0;
  const isPartner = userData.isInfluencer || false;

  useEffect(() => {
    if (useBonuses && availableBonuses > 0) {
      const max = isPartner
        ? Math.min(availableBonuses, totalPrice)
        : Math.min(availableBonuses, 1000, totalPrice);
      setBonusAmount(max);
      setFinalPrice(totalPrice - max);
    } else {
      setBonusAmount(0);
      setFinalPrice(totalPrice);
    }
  }, [useBonuses, availableBonuses, totalPrice, isPartner]);

  const handleSaveDraft = () => {
    const draftKey = `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
    localStorage.setItem(draftKey, JSON.stringify({ formData, step: 6, visa, urgent, savedAt: new Date().toISOString() }));
    alert('Черновик сохранён! Вернитесь позже.');
  };

  const handlePaymentComplete = async () => {
    if (!paymentScreenshot) {
      alert('Загрузите скриншот оплаты');
      return;
    }

    setSubmitting(true);
    haptic('medium');

    try {
      // 1. Upload screenshot
      const proofUrl = await uploadFile(paymentScreenshot, 'payments');

      // 2. Save application to Supabase (or localStorage fallback)
      await saveApplication({
        user_telegram_id: telegramId,
        country: visa.country,
        visa_type: visa.type,
        visa_id: visa.id,
        price: totalPrice,
        urgent,
        status: 'pending_confirmation',
        form_data: {
          basicData: formData.basicData,
          additionalDocs: formData.additionalDocs,
          howHeard: formData.howHeard,
          contactInfo: formData.contactInfo,
        },
        payment_proof_url: proofUrl ?? undefined,
        bonuses_used: bonusAmount,
      });

      // 3. Deduct bonuses locally
      if (useBonuses && bonusAmount > 0) {
        const updated = { ...userData, bonusBalance: availableBonuses - bonusAmount };
        localStorage.setItem('userData', JSON.stringify(updated));
        localStorage.setItem('vd_user', JSON.stringify(updated));
      }

      // 4. Remove draft
      localStorage.removeItem(`draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`);

      haptic('success');
      alert('Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
      onComplete();
    } catch (err) {
      console.error('Submit error:', err);
      haptic('error');
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Ошибка при отправке:\n${msg}\n\nПопробуйте ещё раз или сохраните черновик.`);
    } finally {
      setSubmitting(false);
    }
  };

  const breakdown = [{ label: visa.type, amount: visa.price }];
  if (formData.additionalDocs.urgentProcessing && visa.country !== 'Вьетнам') breakdown.push({ label: 'Срочное оформление', amount: 1000 });
  if (formData.additionalDocs.hotelBooking) breakdown.push({ label: 'Подтверждение бронирования', amount: 1000 });
  if (formData.additionalDocs.returnTicket) breakdown.push({ label: 'Бронирование авиабилета', amount: 2000 });

  return (
    <div className="bg-[#F5F7FA] rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl mb-1 text-[#212121]">Оплата</h2>
        <p className="text-sm text-[#616161]">Переведите средства и загрузите скриншот</p>
      </div>

      {/* Реквизиты */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-start gap-3">
          <CreditCard className="w-6 h-6 text-[#2196F3] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[#212121] mb-1">Реквизиты для оплаты</h3>
            <p className="text-sm text-[#212121]"><span className="text-[#616161]">Номер карты:</span> 5536 9140 3834 6908</p>
            <p className="text-xs text-[#616161] mt-2">После оплаты загрузите скриншот перевода</p>
          </div>
        </div>
      </div>

      {/* Бонусы */}
      {availableBonuses > 0 && (
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border-2 border-[#FFC400]">
          <div className="flex items-start gap-3 mb-3">
            <Coins className="w-5 h-5 text-[#FFC400] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[#212121] text-sm mb-0.5">Использовать бонусы</h3>
              <p className="text-xs text-[#616161]">Доступно: <span className="text-[#FFC400] font-semibold">{availableBonuses}₽</span>
                {!isPartner && ' · макс. 1000₽'}{isPartner && ' · 🌟 до 100%'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setUseBonuses(!useBonuses)}
            className={`w-full rounded-[14px] py-3 px-4 transition-all flex items-center justify-between ${useBonuses ? 'bg-[#00C853] text-white' : 'bg-gray-100 text-[#616161]'}`}
          >
            <span className="text-sm">{useBonuses ? `Списать ${bonusAmount}₽` : 'Не использовать'}</span>
            <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${useBonuses ? 'bg-white/40' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${useBonuses ? 'translate-x-5' : ''}`} />
            </div>
          </button>
        </div>
      )}

      {/* Итого */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
        <h3 className="text-[#212121] text-sm mb-3">Детали оплаты</h3>
        <div className="space-y-2 mb-3">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-[#616161]">{item.label}</span>
              <span className="text-[#212121]">{idx === 0 ? `${item.amount}₽` : `+${item.amount}₽`}</span>
            </div>
          ))}
          {useBonuses && bonusAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#00C853]">Бонусы</span>
              <span className="text-[#00C853]">−{bonusAmount}₽</span>
            </div>
          )}
        </div>
        <div className="border-t pt-3 flex justify-between items-center">
          <span className="text-[#212121] text-sm">Итого к оплате:</span>
          <span className="text-2xl text-[#2196F3] font-semibold">{finalPrice}₽</span>
        </div>
      </div>

      {/* Загрузка скриншота */}
      <div className="mb-6">
        <label className="block mb-2 text-sm text-gray-700 font-medium">
          Скриншот оплаты <span className="text-red-500">*</span>
        </label>
        {!paymentScreenshot ? (
          <label className="block border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-7 h-7 text-gray-400" />
              <p className="text-sm text-gray-500">Нажмите для загрузки</p>
              <p className="text-xs text-gray-400">JPG, PNG · макс. 5MB</p>
            </div>
            <input type="file" accept=".jpg,.jpeg,.png" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('Максимальный размер 5MB'); return; }
                setPaymentScreenshot(file);
              }}
            />
          </label>
        ) : (
          <div className="border-2 border-green-500 bg-green-50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-800">{paymentScreenshot.name}</p>
                <p className="text-xs text-gray-500">{(paymentScreenshot.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button onClick={() => setPaymentScreenshot(null)} className="text-xs text-blue-600">Изменить</button>
          </div>
        )}
      </div>

      {/* Кнопки */}
      <div className="space-y-3">
        <button
          onClick={handlePaymentComplete}
          disabled={submitting}
          className="w-full bg-[#00C853] text-white py-4 rounded-[16px] hover:bg-[#00E676] transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {submitting ? 'Отправляем...' : 'Оплатил — отправить заявку'}
        </button>

        <button onClick={handleSaveDraft} className="w-full bg-blue-50 text-blue-700 py-3 rounded-[16px] hover:bg-blue-100 transition flex items-center justify-center gap-2 text-sm">
          <Save className="w-4 h-4" /> Сохранить черновик
        </button>

        <button onClick={onPrev} className="w-full bg-gray-100 text-gray-600 py-3 rounded-[16px] hover:bg-gray-200 transition flex items-center justify-center gap-2 text-sm">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
      </div>
    </div>
  );
}
