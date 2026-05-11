import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Upload, CheckCircle2, Save, CreditCard, Coins, Loader2 } from 'lucide-react';
import SuccessScreen from '../shared/SuccessScreen';
import type { FormData } from '../ApplicationForm';
import type { VisaOption } from '../../App';
import { saveApplication, uploadFile, getAppSettings } from '../../lib/db';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';
import { haptic } from '../../lib/telegram';
import { getMaxBonusUsage } from '../../lib/bonus-config';
import { useDialog } from '../shared/BrandDialog';
import { Button } from '../ui/brand';

interface Step7Props {
  formData: FormData;
  visa: VisaOption;
  urgent: boolean;
  totalPrice: number;
  addonPrices: { urgent: number; hotel: number; ticket: number };
  onPrev: () => void;
  onComplete: () => void;
  // Куда уйти из success-экранов (черновик / отправка) — обычно профиль.
  onGoToProfile?: () => void;
  // Draft ID этой анкеты (UUID). Передаётся из ApplicationForm чтобы после
  // оплаты удалить ИМЕННО этот черновик, не трогая другие драфты этой же визы.
  draftId?: string;
}

export default function Step7Payment({ formData, visa, urgent, totalPrice, addonPrices, onPrev, onComplete, onGoToProfile, draftId }: Step7Props) {
  const dialog = useDialog();
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(totalPrice);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Полноэкранный success после "Сохранить черновик" с двумя кнопками
  // (продолжить оформление / в личный кабинет) — заменяет native alert.
  const [draftSavedShown, setDraftSavedShown] = useState(false);
  const [cardNumber, setCardNumber] = useState('5536 9140 3834 6908');
  const [cardHolder, setCardHolder] = useState('');

  useEffect(() => {
    let alive = true;
    getAppSettings().then(s => {
      if (!alive) return;
      if (s.payment_card_number) setCardNumber(s.payment_card_number);
      if (s.payment_card_holder) setCardHolder(s.payment_card_holder);
    }).catch(() => { /* defaults stay */ });
    return () => { alive = false; };
  }, []);

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

    haptic('success');
    // Полноэкранный success вместо native alert
    setDraftSavedShown(true);
  };

  const handlePaymentComplete = async () => {
    if (!paymentScreenshot) {
      await dialog.warning('Загрузите скриншот оплаты');
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
        await dialog.warning('Фотографии не были сохранены', 'Вернитесь на шаг «Загрузка фото» и загрузите их заново.');
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

      // 3a. Списываем бонусы СНАЧАЛА (до notify-admin) — раньше делали
      //     ПОСЛЕ notify, и если grant-bonus падал, заявка уже улетела
      //     к админу, юзер получил визу не списав баланс (двойная выгода
      //     или потеря денег для нас). Теперь:
      //       1) spend-bonus → если упал → отменяем заявку (status=cancelled),
      //          notify-admin вообще не отправляем, юзеру говорим попробовать
      //          ещё раз. Никакого мусора у админа, никакой потери денег.
      //       2) если spend OK или бонусы не используются → notify-admin/user.
      let spendOk = true;
      if (useBonuses && bonusAmount > 0 && telegramId) {
        try {
          const res = await apiFetch('/api/grant-bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegram_id: telegramId,
              type: 'spent',
              amount: -bonusAmount,
              description: `−${bonusAmount}₽ оплата визы ${visa.country} (${savedApp?.id ?? 'pending'})`,
              // dedupe_key = 'spent:<uuid>' защищает от двойного списания
              // при повторном submit (юзер тыкает «Отправить» дважды).
              application_id: savedApp?.id,
            }),
          });
          const data = await res.json().catch(() => ({} as { newBalance?: number; skipped?: unknown }));
          if (!res.ok) {
            console.error('[step7] spend-bonus failed:', res.status, data);
            spendOk = false;
          } else if (data.skipped) {
            // Уже списали ранее (повторный submit) — это ОК, продолжаем
            console.warn('[step7] spend-bonus skipped (dedup)');
          } else if (typeof data.newBalance === 'number') {
            const updated = { ...userData, bonusBalance: data.newBalance };
            localStorage.setItem('userData', JSON.stringify(updated));
            localStorage.setItem('vd_user', JSON.stringify(updated));
          }
        } catch (e) {
          console.error('[step7] spend-bonus exception:', e);
          spendOk = false;
        }
      }

      // 3b. Если spend упал — откатываем: помечаем заявку как cancelled,
      //     админ не получает уведомление, юзер видит понятный текст.
      if (!spendOk) {
        if (savedApp?.id && isSupabaseConfigured()) {
          try {
            await supabase.from('applications')
              .update({ status: 'cancelled' })
              .eq('id', savedApp.id);
          } catch (e) { console.warn('[step7] rollback cancel failed:', e); }
        }
        await dialog.error(
          'Не удалось списать бонусы',
          'Заявка не отправлена админу. Проверьте баланс бонусов и попробуйте ещё раз через минуту.',
        );
        setSubmitting(false);
        return;
      }

      // 3c. Notify user: application received (pending_confirmation)
      if (telegramId) {
        apiFetch('/api/notify-status', {
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

      // 3d. Notify all admins about new application
      apiFetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_application',
          application_id: savedApp?.id,
          country: visa.country,
          visa_type: visa.type,
          price: totalPrice,
          urgent,
          customer_name: [formData.basicData?.firstName, formData.basicData?.lastName].filter(Boolean).join(' ').trim()
            || formData.basicData?.fullName
            || null,
          customer_telegram: formData.contactInfo?.telegram ?? null,
        }),
      }).catch(console.error);

      // 4. Referral bonus to the referrer is paid by admin when status moves to 'in_progress'
      // (i.e. only after the payment is actually confirmed). See admin/Applications.tsx.

      // 4. Remove draft — и одиночный ключ, и запись из массива visa_drafts.
      // Multi-draft режим: удаляем ИМЕННО этот draftId (UUID), не трогая
      // другие драфты этой же визы (могут быть для других членов семьи).
      // Fallback на legacy-ключ для совместимости со старыми анкетами.
      const draftKey = draftId || `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
      localStorage.removeItem(draftKey);
      try {
        const raw = localStorage.getItem('visa_drafts');
        if (raw) {
          const filtered = JSON.parse(raw).filter((d: { id?: string }) => d.id !== draftKey);
          localStorage.setItem('visa_drafts', JSON.stringify(filtered));
        }
      } catch (e) {
        console.warn('[step7] failed to prune visa_drafts:', e);
      }

      // 5. Cancel any pending reminders for this draft
      apiFetch('/api/cancel-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_key: draftKey }),
      }).catch(console.error);

      haptic('success');
      // Показываем full-screen success экран (как у Бронь отеля/билета).
      // Раньше был alert + onComplete — выглядело как в браузере, не premium.
      setSubmitted(true);
    } catch (err) {
      console.error('Submit error:', err);
      haptic('error');
      toast.error('Не удалось отправить заявку. Попробуй ещё раз или сохрани черновик.');
    } finally {
      setSubmitting(false);
    }
  };

  // Срочные Вьетнамские визы — приоритет уже в цене, аддон не суммируется.
  const isVietnamUrgentVisa = visa.country === 'Вьетнам' && /^vietnam-(3d|2d|1d|4h|2h)-/.test(visa.id);
  const breakdown = [{ label: visa.type, amount: visa.price }];
  if (formData.additionalDocs.urgentProcessing && !isVietnamUrgentVisa) breakdown.push({ label: 'Срочное оформление', amount: addonPrices.urgent });
  if (formData.additionalDocs.hotelBooking) breakdown.push({ label: 'Подтверждение бронирования', amount: addonPrices.hotel });
  if (formData.additionalDocs.returnTicket) breakdown.push({ label: 'Бронирование авиабилета', amount: addonPrices.ticket });

  // Полноэкранный success-экран — единый стиль с бронями отеля/билета.
  // Success после отправки заявки на визу — единый паттерн с бронями
  // и черновиками (см. shared/SuccessScreen).
  if (submitted) {
    return (
      <SuccessScreen
        title="Заявка отправлена!"
        description={
          <>
            Мы получили вашу заявку на визу в <b>{visa.country}</b> и свяжемся в Telegram
            в течение нескольких часов.
          </>
        }
        primaryAction={{
          label: 'На главную',
          onClick: onComplete,
        }}
        secondaryAction={onGoToProfile ? {
          label: 'Мои заявки',
          onClick: onGoToProfile,
        } : undefined}
      />
    );
  }

  // Success после "Сохранить черновик" — две кнопки: продолжить здесь
  // или уйти в Личный кабинет → Мои заявки (где видны все драфты).
  if (draftSavedShown) {
    return (
      <SuccessScreen
        title="Черновик сохранён"
        description={
          <>
            Заявка для <b>{visa.country}</b> сохранена в Личном кабинете → «Мои заявки».
            Вернись к ней в любой момент — данные не потеряются.
          </>
        }
        primaryAction={{
          label: 'Продолжить оформление',
          onClick: () => setDraftSavedShown(false),
        }}
        secondaryAction={onGoToProfile ? {
          label: 'В личный кабинет',
          onClick: () => { setDraftSavedShown(false); onGoToProfile(); },
        } : undefined}
      />
    );
  }

  return (
    <div className="bg-[#F5F7FA] rounded-2xl shadow-lg p-6">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Финал</p>
        <h2 className="text-[26px] font-extrabold tracking-tight text-[#0F2A36] mt-1">Оплата</h2>
        <p className="text-sm text-[#0F2A36]/60 mt-1">Переведите средства и загрузите скриншот</p>
      </div>

      {/* Реквизиты */}
      <div className="bg-white rounded-2xl p-5 mb-3 shadow-sm border border-gray-100">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl vd-grad flex items-center justify-center text-white shadow-md flex-shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-[#0F2A36] font-bold text-sm">Реквизиты для оплаты</h3>
            <p className="text-[10px] text-[#0F2A36]/60 mt-1.5 uppercase tracking-wider font-semibold">Номер карты</p>
            <p className="text-[#0F2A36] font-mono text-[15px] mt-0.5 tracking-wide">{cardNumber}</p>
            {cardHolder && (
              <>
                <p className="text-[10px] text-[#0F2A36]/60 mt-2 uppercase tracking-wider font-semibold">Получатель</p>
                <p className="text-[#0F2A36] text-[14px] mt-0.5 font-semibold">{cardHolder}</p>
              </>
            )}
            <p className="text-[11px] text-[#0F2A36]/60 mt-2">После оплаты загрузите скриншот перевода</p>
          </div>
        </div>
      </div>

      {/* Trust strip — снижает страх перед вводом реквизитов */}
      <div className="bg-white rounded-2xl px-4 py-3 mb-4 shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[18px]">🛡️</span>
            <span className="text-[10px] leading-tight text-[#0F2A36]/70">Защищено<br/>Telegram</span>
          </div>
          <div className="flex flex-col items-center gap-1 border-l border-gray-100">
            <span className="text-[18px]">🤝</span>
            <span className="text-[10px] leading-tight text-[#0F2A36]/70">Поддержка<br/>24/7</span>
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
            className={`w-full rounded-[14px] py-3 px-4 transition-all flex items-center justify-between ${useBonuses ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-[#616161]'}`}
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
        <div className="space-y-2.5 mb-3">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[#0F2A36]/70 leading-snug min-w-0 break-words">{item.label}</span>
              <span className="text-[#0F2A36] font-semibold whitespace-nowrap shrink-0 tabular-nums">
                {idx === 0 ? `${item.amount.toLocaleString('ru-RU')} ₽` : `+${item.amount.toLocaleString('ru-RU')} ₽`}
              </span>
            </div>
          ))}
          {useBonuses && bonusAmount > 0 && (
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="text-[#10B981]">Бонусы</span>
              <span className="text-[#10B981] font-semibold whitespace-nowrap shrink-0 tabular-nums">
                −{bonusAmount.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}
        </div>
        <div className="border-t border-blue-200/60 pt-3 flex items-baseline justify-between gap-3">
          <span className="text-[#0F2A36] font-bold">Итого</span>
          <span className="text-2xl vd-grad-text font-extrabold tracking-tight whitespace-nowrap shrink-0 tabular-nums">
            {finalPrice.toLocaleString('ru-RU')} ₽
          </span>
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
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { await dialog.warning('Максимальный размер 5MB'); return; }
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
        <Button
          variant="success"
          size="lg"
          fullWidth
          className="!py-4 !rounded-2xl !font-bold shadow-[0_10px_30px_-8px_rgba(16,185,129,0.6)]"
          onClick={handlePaymentComplete}
          disabled={submitting}
          loading={submitting}
          leftIcon={!submitting ? <CheckCircle2 className="w-5 h-5" /> : undefined}
        >
          {submitting ? 'Отправляем…' : 'Оплатил — отправить заявку'}
        </Button>

        <Button
          variant="soft"
          size="md"
          fullWidth
          className="!py-3 !rounded-2xl"
          onClick={handleSaveDraft}
          leftIcon={<Save className="w-4 h-4" />}
        >
          Сохранить черновик
        </Button>

        <Button
          variant="secondary"
          size="md"
          fullWidth
          className="!py-3 !rounded-2xl !bg-gray-100 !border-0 !text-[#0F2A36]/70 hover:!bg-gray-200"
          onClick={onPrev}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Назад
        </Button>
      </div>
    </div>
  );
}
