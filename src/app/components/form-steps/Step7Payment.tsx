import { useState, useEffect } from 'react';
import { ChevronLeft, Upload, CheckCircle2, Save, CreditCard, Coins, Loader2 } from 'lucide-react';
import type { FormData } from '../ApplicationForm';
import type { VisaOption } from '../../App';
import { saveApplication, uploadFile, updateUser } from '../../lib/db';
import { haptic } from '../../lib/telegram';
import { getMaxBonusUsage } from '../../lib/bonus-config';

interface Step7Props {
  formData: FormData;
  visa: VisaOption;
  urgent: boolean;
  totalPrice: number;
  addonPrices: { urgent: number; hotel: number; ticket: number };
  onPrev: () => void;
  onComplete: () => void;
}

export default function Step7Payment({ formData, visa, urgent, totalPrice, addonPrices, onPrev, onComplete }: Step7Props) {
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(totalPrice);
  const [submitting, setSubmitting] = useState(false);

  const userData = JSON.parse(localStorage.getItem('userData') || '{"bonusBalance": 0, "isInfluencer": false}');
  const telegramId: number = userData.telegramId ?? 0;
  const availableBonuses = userData.bonusBalance || 0;
  const isPartner = userData.isInfluencer || false;
  const paidRefCount: number = userData.paidReferralsCount ?? 0;
  // Level-based bonus usage limit (500/600/800/1000 by paid refs, null = 100% for partners)
  const bonusLimit = getMaxBonusUsage(paidRefCount, isPartner);

  useEffect(() => {
    if (useBonuses && availableBonuses > 0) {
      const max = bonusLimit == null
        ? Math.min(availableBonuses, totalPrice)
        : Math.min(availableBonuses, bonusLimit, totalPrice);
      setBonusAmount(max);
      setFinalPrice(totalPrice - max);
    } else {
      setBonusAmount(0);
      setFinalPrice(totalPrice);
    }
  }, [useBonuses, availableBonuses, totalPrice, bonusLimit]);

  const handleSaveDraft = () => {
    const draftKey = `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
    // Strip File objects — they don't survive JSON.stringify and break the form on restore
    const draftFormData = {
      ...formData,
      photos: { facePhoto: null, passportPhoto: null, additionalPhotos: {} },
    };
    const draft = {
      id: draftKey,
      formData: draftFormData,
      step: 5, // payment step (index in STEPS array)
      visa,
      urgent,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));

    // Also save to drafts list for ApplicationsTab
    const draftsKey = 'visa_drafts';
    const existingDrafts = JSON.parse(localStorage.getItem(draftsKey) || '[]');
    const draftIndex = existingDrafts.findIndex((d: { id?: string }) => d.id === draftKey);
    if (draftIndex >= 0) existingDrafts[draftIndex] = draft;
    else existingDrafts.push(draft);
    localStorage.setItem(draftsKey, JSON.stringify(existingDrafts));

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
      // 1. Upload payment screenshot
      const proofUrl = await uploadFile(paymentScreenshot, 'payments');

      // 2. Upload all photos in parallel — only real File objects (drafts strip them)
      const photoUrls: Record<string, string | null> = {};
      const photoUploads: Promise<void>[] = [];
      const isFile = (f: unknown): f is File => f instanceof File;

      if (isFile(formData.photos.facePhoto)) {
        photoUploads.push(
          uploadFile(formData.photos.facePhoto, 'photos').then(url => { photoUrls.facePhoto = url; })
        );
      }
      if (isFile(formData.photos.passportPhoto)) {
        photoUploads.push(
          uploadFile(formData.photos.passportPhoto, 'photos').then(url => { photoUrls.passportPhoto = url; })
        );
      }
      for (const [key, file] of Object.entries(formData.photos.additionalPhotos)) {
        if (isFile(file)) {
          photoUploads.push(
            uploadFile(file as File, 'photos').then(url => { photoUrls[key] = url; })
          );
        }
      }
      await Promise.all(photoUploads);

      // Check that we have at least the required photos uploaded — if user came from draft
      // and photos got stripped, ask them to re-upload
      if (!photoUrls.facePhoto && !photoUrls.passportPhoto) {
        alert('Фотографии не были сохранены в черновике. Пожалуйста, вернитесь на шаг "Загрузка фото" и загрузите их заново.');
        setSubmitting(false);
        return;
      }

      // 3. Save application to Supabase (or localStorage fallback)
      const savedApp = await saveApplication({
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
          photoUrls,
        },
        payment_proof_url: proofUrl ?? undefined,
        bonuses_used: bonusAmount,
      });

      // 3a. Notify user: application received (pending_confirmation)
      if (telegramId) {
        fetch('/api/notify-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_id: telegramId,
            status: 'pending_confirmation',
            country: visa.country,
            visa_type: visa.type,
            application_id: savedApp?.id,
          }),
        }).catch(console.error);
      }

      // 3b. Notify all admins about new application
      fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_application',
          application_id: savedApp?.id,
          country: visa.country,
          visa_type: visa.type,
          price: totalPrice,
          urgent,
          customer_name: [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim()
            || formData.basicData?.fullName
            || formData.basicData?.lastName
            || null,
          customer_telegram: formData.contactInfo?.telegram ?? null,
        }),
      }).catch(console.error);

      // 4. Referral bonus to the referrer is paid by admin when status moves to 'in_progress'
      // (i.e. only after the payment is actually confirmed). See admin/Applications.tsx.

      // 5. Deduct bonuses from Supabase + localStorage
      if (useBonuses && bonusAmount > 0) {
        const newBalance = availableBonuses - bonusAmount;
        const updated = { ...userData, bonusBalance: newBalance };
        localStorage.setItem('userData', JSON.stringify(updated));
        localStorage.setItem('vd_user', JSON.stringify(updated));
        if (telegramId) {
          await updateUser(telegramId, { bonus_balance: newBalance }).catch(console.error);
        }
      }

      // 4. Remove draft
      const draftKey = `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
      localStorage.removeItem(draftKey);

      // 5. Cancel any pending reminders for this draft
      fetch('/api/cancel-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_key: draftKey }),
      }).catch(console.error);

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
  if (formData.additionalDocs.urgentProcessing && visa.country !== 'Вьетнам') breakdown.push({ label: 'Срочное оформление', amount: addonPrices.urgent });
  if (formData.additionalDocs.hotelBooking) breakdown.push({ label: 'Подтверждение бронирования', amount: addonPrices.hotel });
  if (formData.additionalDocs.returnTicket) breakdown.push({ label: 'Бронирование авиабилета', amount: addonPrices.ticket });

  return (
    <div className="bg-[#F5F7FA] rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Финал</p>
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#0F2A36] mt-1">Оплата</h2>
        <p className="text-sm text-[#0F2A36]/60 mt-1">Переведите средства и загрузите скриншот</p>
      </div>

      {/* Реквизиты */}
      <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md flex-shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-[#0F2A36] font-bold text-sm">Реквизиты для оплаты</h3>
            <p className="text-[10px] text-[#0F2A36]/60 mt-1.5 uppercase tracking-wider font-semibold">Номер карты</p>
            <p className="text-[#0F2A36] font-mono text-[15px] mt-0.5 tracking-wide">5536 9140 3834 6908</p>
            <p className="text-[11px] text-[#0F2A36]/60 mt-2">После оплаты загрузите скриншот перевода</p>
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
                {bonusLimit != null && ` · макс. ${bonusLimit}₽`}{bonusLimit == null && ' · 🌟 до 100%'}
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
      <div className="vd-grad-soft rounded-2xl p-5 mb-4 border border-blue-100/60">
        <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold mb-3">Детали оплаты</p>
        <div className="space-y-2 mb-3">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-[#0F2A36]/70">{item.label}</span>
              <span className="text-[#0F2A36] font-semibold">{idx === 0 ? `${item.amount.toLocaleString('ru-RU')} ₽` : `+${item.amount.toLocaleString('ru-RU')} ₽`}</span>
            </div>
          ))}
          {useBonuses && bonusAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[#00C853]">Бонусы</span>
              <span className="text-[#00C853] font-semibold">−{bonusAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
        </div>
        <div className="border-t border-blue-200/60 pt-3 flex justify-between items-center">
          <span className="text-[#0F2A36] font-bold">Итого</span>
          <span className="text-2xl vd-grad-text font-extrabold tracking-tight">{finalPrice.toLocaleString('ru-RU')} ₽</span>
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
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 rounded-2xl active:scale-[0.98] transition font-bold tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_10px_30px_-8px_rgba(16,185,129,0.6)]"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {submitting ? 'Отправляем…' : 'Оплатил — отправить заявку'}
        </button>

        <button onClick={handleSaveDraft} className="w-full vd-grad-soft text-[#3B5BFF] py-3 rounded-2xl hover:bg-blue-100 transition flex items-center justify-center gap-2 text-sm font-semibold border border-blue-100/60">
          <Save className="w-4 h-4" /> Сохранить черновик
        </button>

        <button onClick={onPrev} className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl hover:bg-gray-200 transition flex items-center justify-center gap-2 text-sm font-medium">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>
      </div>
    </div>
  );
}
