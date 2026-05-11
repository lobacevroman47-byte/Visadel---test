import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Upload, CheckCircle2, CreditCard, User, Coins, Save } from 'lucide-react';
import type { VisaOption } from '../App';
import LatinNotice from './shared/LatinNotice';
import SuccessScreen from './shared/SuccessScreen';
import { useDialog } from './shared/BrandDialog';
import { Button } from './ui/brand';
import { saveApplication, uploadFile, getAppSettings } from '../lib/db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiFetch } from '../lib/apiFetch';
import { haptic } from '../lib/telegram';
import { getMaxBonusUsage } from '../lib/bonus-config';

// Форма продления виз (Шри-Ланка). После рефакторинга 2026-05-10 —
// единый стиль с основным визовым flow (vd-grad header/кнопки, формат
// даты dd.MM.yyyy, номер карты из app_settings, лимит 10MB, заявка
// сохраняется в Supabase applications с application_type='extension'),
// поддержка черновиков (`draft_extension_<visa_id>` + visa_drafts массив),
// уведомления админу и юзеру через /api/notify-*.
//
// Раньше компонент был полностью изолированным legacy — писал только в
// localStorage, не уведомлял админа, не виден в админке/«Мои заявки».

interface SriLankaExtensionFormProps {
  visa: VisaOption;
  onBack: () => void;
  onComplete: () => void;
  // Куда уйти из success-экрана (черновик / отправка) — обычно профиль.
  onGoToProfile?: () => void;
  // Draft ID для восстановления (передаётся из ApplicationsTab → handleContinueDraft).
  // Если undefined — генерируем `draft_extension_<visa_id>` (один черновик на тип).
  draftId?: string;
}

interface ExtensionFormData {
  firstName: string;       // латиница, как в загранпаспорте
  lastName: string;        // латиница
  homeAddress: string;     // прописка в РФ
  arrivalDate: string;     // ISO 'YYYY-MM-DD'
  sriLankaAddress: string;
  phoneRussia: string;
  phoneSriLanka: string;
  passportPhoto: File | null;
  facePhoto: File | null;
}

// dd.MM.yyyy — формат даты единый с остальным мини-аппом.
// Раньше показывалось «21 мая 2026 г.» (нативный iOS toLocaleDateString).
function formatDateRu(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

const EMPTY_FORM: ExtensionFormData = {
  firstName: '',
  lastName: '',
  homeAddress: '',
  arrivalDate: '',
  sriLankaAddress: '',
  phoneRussia: '',
  phoneSriLanka: '',
  passportPhoto: null,
  facePhoto: null,
};

export default function SriLankaExtensionForm({ visa, onBack, onComplete, onGoToProfile, draftId }: SriLankaExtensionFormProps) {
  const dialog = useDialog();
  const [currentStep, setCurrentStep] = useState<'form' | 'payment'>('form');

  // Restore draft if exists (File-объекты не переживают JSON.stringify — юзер
  // загружает фото заново). Такой же паттерн как в ApplicationForm.
  const [formData, setFormData] = useState<ExtensionFormData>(() => {
    const key = draftId || `draft_extension_${visa.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { formData?: Partial<ExtensionFormData> };
        if (parsed?.formData) {
          return {
            ...EMPTY_FORM,
            ...parsed.formData,
            passportPhoto: null,
            facePhoto: null,
          };
        }
      }
    } catch { /* ignore — пустая форма */ }
    return EMPTY_FORM;
  });

  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [draftSavedShown, setDraftSavedShown] = useState(false);

  // Реквизиты карты из app_settings — единый источник со Step7Payment.
  const [cardNumber, setCardNumber] = useState('5536 9140 3834 6908');
  const [cardHolder, setCardHolder] = useState('');

  // Бонусы (та же логика что Step7Payment).
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(visa.price);
  const userData = JSON.parse(localStorage.getItem('userData') || '{"bonusBalance": 0, "isInfluencer": false}');
  const telegramId: number = userData.telegramId ?? 0;
  const availableBonuses = userData.bonusBalance || 0;
  const isPartner = userData.isInfluencer || false;
  const paidRefCount: number = userData.paidReferralsCount ?? 0;
  const bonusLimit = getMaxBonusUsage(paidRefCount, isPartner);

  useEffect(() => {
    let alive = true;
    getAppSettings().then(s => {
      if (!alive) return;
      if (s.payment_card_number) setCardNumber(s.payment_card_number);
      if (s.payment_card_holder) setCardHolder(s.payment_card_holder);
    }).catch(() => { /* defaults stay */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (useBonuses && availableBonuses > 0) {
      const max = bonusLimit == null
        ? Math.min(availableBonuses, visa.price)
        : Math.min(availableBonuses, bonusLimit, visa.price);
      setBonusAmount(max);
      setFinalPrice(visa.price - max);
    } else {
      setBonusAmount(0);
      setFinalPrice(visa.price);
    }
  }, [useBonuses, availableBonuses, visa.price, bonusLimit]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'Укажите имя латиницей';
    if (!formData.lastName.trim()) newErrors.lastName = 'Укажите фамилию латиницей';
    if (!formData.homeAddress.trim()) newErrors.homeAddress = 'Укажите домашний адрес';
    if (!formData.arrivalDate) newErrors.arrivalDate = 'Укажите дату прилёта';
    if (!formData.sriLankaAddress.trim()) newErrors.sriLankaAddress = 'Укажите адрес проживания на Шри-Ланке';
    if (!formData.phoneRussia.trim()) newErrors.phoneRussia = 'Укажите телефон в РФ';
    if (!formData.phoneSriLanka.trim()) newErrors.phoneSriLanka = 'Укажите телефон на Шри-Ланке';
    if (!formData.passportPhoto) newErrors.passportPhoto = 'Загрузите фото паспорта';
    if (!formData.facePhoto) newErrors.facePhoto = 'Загрузите ваше фото';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoToPayment = async () => {
    if (!validateForm()) {
      await dialog.warning('Заполните все обязательные поля');
      return;
    }
    setCurrentStep('payment');
    window.scrollTo(0, 0);
  };

  const handleFileUpload = async (field: 'passportPhoto' | 'facePhoto', file: File | null) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        await dialog.warning('Размер файла не должен превышать 10MB');
        return;
      }
    }
    setFormData(prev => ({ ...prev, [field]: file }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSaveDraft = () => {
    const key = draftId || `draft_extension_${visa.id}`;
    // File-объекты стрипаем — JSON.stringify их не сохраняет.
    const draftFormData = {
      ...formData,
      passportPhoto: null,
      facePhoto: null,
    };
    const draft = {
      id: key,
      formData: draftFormData,
      step: 0,
      visa,
      urgent: false,
      application_type: 'extension' as const,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(draft));

    // Добавляем в visa_drafts массив — отобразится в ApplicationsTab.
    const draftsKey = 'visa_drafts';
    try {
      const existingDrafts = JSON.parse(localStorage.getItem(draftsKey) || '[]') as Array<{ id?: string }>;
      const draftIndex = existingDrafts.findIndex(d => d.id === key);
      if (draftIndex >= 0) existingDrafts[draftIndex] = draft;
      else existingDrafts.push(draft);
      localStorage.setItem(draftsKey, JSON.stringify(existingDrafts));
    } catch (e) {
      console.warn('[extension] failed to update visa_drafts:', e);
    }

    haptic('success');
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
      // 1. Скрин оплаты в Storage.
      const proofUrl = await uploadFile(paymentScreenshot, 'payments');

      // 2. Фото паспорта + лица в Storage параллельно.
      const photoUrls: Record<string, string | null> = {};
      const photoUploads: Promise<void>[] = [];
      const isFile = (f: unknown): f is File => f instanceof File;

      if (isFile(formData.passportPhoto)) {
        photoUploads.push(
          uploadFile(formData.passportPhoto, 'photos').then(url => { photoUrls.passportPhoto = url; })
        );
      }
      if (isFile(formData.facePhoto)) {
        photoUploads.push(
          uploadFile(formData.facePhoto, 'photos').then(url => { photoUrls.facePhoto = url; })
        );
      }
      await Promise.all(photoUploads);

      if (!photoUrls.passportPhoto || !photoUrls.facePhoto) {
        await dialog.warning('Фотографии не были сохранены', 'Вернитесь на шаг «Личные данные» и загрузите их заново.');
        setSubmitting(false);
        return;
      }

      // 3. Сохраняем заявку в Supabase с application_type='extension'.
      // Структура form_data зеркалит визовый flow: basicData содержит
      // ФИО (как у виз) — админка ApplicationsTab/Applications.tsx
      // читает оттуда; extensionData — специфичные поля продления.
      const savedApp = await saveApplication({
        user_telegram_id: telegramId,
        country: visa.country,
        visa_type: visa.type,
        visa_id: visa.id,
        price: visa.price,
        urgent: false,
        status: 'pending_confirmation',
        application_type: 'extension',
        form_data: {
          basicData: {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
          },
          extensionData: {
            homeAddress: formData.homeAddress.trim(),
            arrivalDate: formData.arrivalDate,
            sriLankaAddress: formData.sriLankaAddress.trim(),
            phoneRussia: formData.phoneRussia.trim(),
            phoneSriLanka: formData.phoneSriLanka.trim(),
          },
          photoUrls,
        },
        payment_proof_url: proofUrl ?? undefined,
        bonuses_used: bonusAmount,
      });

      // 3a. Списываем бонусы ДО уведомления админа (та же логика что Step7Payment:170+).
      // Если spend упал — откатываем заявку (status=cancelled), не шлём notify.
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
              description: `−${bonusAmount}₽ оплата продления визы ${visa.country} (${savedApp?.id ?? 'pending'})`,
              application_id: savedApp?.id,
            }),
          });
          const data = await res.json().catch(() => ({} as { newBalance?: number; skipped?: unknown }));
          if (!res.ok) {
            console.error('[extension] spend-bonus failed:', res.status, data);
            spendOk = false;
          } else if (data.skipped) {
            console.warn('[extension] spend-bonus skipped (dedup)');
          } else if (typeof data.newBalance === 'number') {
            const updated = { ...userData, bonusBalance: data.newBalance };
            localStorage.setItem('userData', JSON.stringify(updated));
            localStorage.setItem('vd_user', JSON.stringify(updated));
          }
        } catch (e) {
          console.error('[extension] spend-bonus exception:', e);
          spendOk = false;
        }
      }

      if (!spendOk) {
        if (savedApp?.id && isSupabaseConfigured()) {
          try {
            await supabase.from('applications')
              .update({ status: 'cancelled' })
              .eq('id', savedApp.id);
          } catch (e) { console.warn('[extension] rollback cancel failed:', e); }
        }
        await dialog.error(
          'Не удалось списать бонусы',
          'Заявка не отправлена админу. Проверьте баланс бонусов и попробуйте ещё раз через минуту.',
        );
        setSubmitting(false);
        return;
      }

      // 3b. Уведомление юзеру: заявка получена.
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

      // 3c. Уведомление админу (event=new_application — тот же что у виз;
      // лейбл «Продление» подставляется через visa.type, который уже
      // содержит «Первое продление на 60 дней» и т.д.).
      apiFetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'new_application',
          application_id: savedApp?.id,
          country: visa.country,
          visa_type: visa.type,
          price: visa.price,
          urgent: false,
          customer_name: [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim() || null,
          customer_telegram: null,
        }),
      }).catch(console.error);

      // 4. Удаляем черновик — и одиночный ключ, и запись из массива.
      const key = draftId || `draft_extension_${visa.id}`;
      localStorage.removeItem(key);
      try {
        const raw = localStorage.getItem('visa_drafts');
        if (raw) {
          const filtered = JSON.parse(raw).filter((d: { id?: string }) => d.id !== key);
          localStorage.setItem('visa_drafts', JSON.stringify(filtered));
        }
      } catch (e) {
        console.warn('[extension] failed to prune visa_drafts:', e);
      }

      haptic('success');
      setSubmitted(true);
    } catch (err) {
      console.error('Extension submit error:', err);
      haptic('error');
      toast.error('Не удалось отправить заявку. Попробуй ещё раз или сохрани черновик.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screens ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SuccessScreen
        title="Заявка отправлена!"
        description={
          <>
            Мы получили вашу заявку на <b>{visa.type}</b> ({visa.country}) и свяжемся в Telegram
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

  if (draftSavedShown) {
    return (
      <SuccessScreen
        title="Черновик сохранён"
        description={
          <>
            Заявка на <b>{visa.type}</b> сохранена в Личном кабинете → «Мои заявки».
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

  // ── Payment step ────────────────────────────────────────────────────────────
  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] pb-20">
        {/* Header — единый vd-grad как у визового flow */}
        <div className="vd-grad text-white p-6 sticky top-0 z-10 shadow-lg">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setCurrentStep('form')} className="mb-4 flex items-center gap-2 hover:opacity-80 transition">
              <ChevronLeft className="w-5 h-5" />
              Назад
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">Оплата продления визы</h1>
            <p className="text-white/80 text-sm">{visa.type}</p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-[#F5F7FA] rounded-2xl shadow-lg p-6">
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold">Финал</p>
              <h2 className="text-[26px] font-extrabold tracking-tight text-[#0F2A36] mt-1">Оплата</h2>
              <p className="text-sm text-[#0F2A36]/60 mt-1">Переведите средства и загрузите скриншот</p>
            </div>

            {/* Реквизиты — единый стиль со Step7Payment */}
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

            {/* Trust strip */}
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
                  className={`w-full rounded-[14px] py-3 px-4 transition-all flex items-center justify-between ${useBonuses ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-[#616161]'}`}
                >
                  <span className="text-sm">{useBonuses ? `Списать ${bonusAmount}₽` : 'Не использовать'}</span>
                  <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${useBonuses ? 'bg-white/40' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${useBonuses ? 'translate-x-5' : ''}`} />
                  </div>
                </button>
              </div>
            )}

            {/* Детали оплаты */}
            <div className="vd-grad-soft rounded-2xl p-5 mb-4 border border-blue-100/60">
              <p className="text-[10px] uppercase tracking-widest text-[#3B5BFF] font-bold mb-3">Детали оплаты</p>
              <div className="space-y-2.5 mb-3">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-[#0F2A36]/70 leading-snug min-w-0 break-words">{visa.type}</span>
                  <span className="text-[#0F2A36] font-semibold whitespace-nowrap shrink-0 tabular-nums">
                    {visa.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                {useBonuses && bonusAmount > 0 && (
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-emerald-600">Бонусы</span>
                    <span className="text-emerald-600 font-semibold whitespace-nowrap shrink-0 tabular-nums">
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

            {/* Скрин оплаты */}
            <div className="mb-6">
              <label className="block mb-2 text-sm text-gray-700 font-medium">
                Скриншот оплаты <span className="text-red-500">*</span>
              </label>
              {!paymentScreenshot ? (
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-7 h-7 text-gray-400" />
                    <p className="text-sm text-gray-500">Нажмите для загрузки</p>
                    <p className="text-xs text-gray-400">JPG, PNG · макс. 10MB</p>
                  </div>
                  <input type="file" accept=".jpg,.jpeg,.png" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { await dialog.warning('Максимальный размер 10MB'); return; }
                      setPaymentScreenshot(file);
                    }}
                  />
                </label>
              ) : (
                <div className="border-2 border-emerald-500 bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-sm text-gray-800">{paymentScreenshot.name}</p>
                      <p className="text-xs text-gray-500">{(paymentScreenshot.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={() => setPaymentScreenshot(null)} className="text-xs text-blue-600">Изменить</button>
                </div>
              )}
            </div>

            {/* Кнопка submit */}
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
          </div>
        </div>
      </div>
    );
  }

  // ── Form step ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      <div className="vd-grad text-white p-6 sticky top-0 z-10 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="mb-4 flex items-center gap-2 hover:opacity-80 transition">
            <ChevronLeft className="w-5 h-5" />
            Назад
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">Продление визы</h1>
          <p className="text-white/80 text-sm">{visa.type}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <User className="w-5 h-5 text-[#3B5BFF]" />
              <h3 className="text-sm font-bold text-[#0F2A36]">Личные данные</h3>
            </div>
            <LatinNotice />
          </div>

          {/* Имя */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Имя (латиницей, как в паспорте)
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.firstName || ''}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value.toUpperCase() })}
              className={`form-input ${errors.firstName ? 'border-red-500' : ''}`}
              placeholder="IVAN"
              autoComplete="off"
            />
            {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
          </div>

          {/* Фамилия */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Фамилия (латиницей, как в паспорте)
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.lastName || ''}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })}
              className={`form-input ${errors.lastName ? 'border-red-500' : ''}`}
              placeholder="IVANOV"
              autoComplete="off"
            />
            {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
          </div>

          {/* Домашний адрес */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Домашний адрес (прописка / последнее место проживания)
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.homeAddress || ''}
              onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
              className={`form-input ${errors.homeAddress ? 'border-red-500' : ''}`}
              placeholder="Россия, г. Москва, ул. Примерная, д. 1, кв. 1"
            />
            {errors.homeAddress && <p className="text-red-500 text-xs mt-1">{errors.homeAddress}</p>}
          </div>

          {/* Дата прилёта */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Дата прилёта на Шри-Ланку
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="date"
              value={formData.arrivalDate || ''}
              onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
              className={`form-input ${errors.arrivalDate ? 'border-red-500' : ''}`}
            />
            {formData.arrivalDate && (
              <p className="text-xs text-[#0F2A36]/60 mt-1">
                Дата: <span className="font-semibold text-[#0F2A36]">{formatDateRu(formData.arrivalDate)}</span>
              </p>
            )}
            {errors.arrivalDate && <p className="text-red-500 text-xs mt-1">{errors.arrivalDate}</p>}
          </div>

          {/* Адрес на Шри-Ланке */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Адрес проживания на Шри-Ланке
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={formData.sriLankaAddress || ''}
              onChange={(e) => setFormData({ ...formData, sriLankaAddress: e.target.value })}
              className={`form-input ${errors.sriLankaAddress ? 'border-red-500' : ''}`}
              placeholder="Отель или адрес проживания"
            />
            {errors.sriLankaAddress && <p className="text-red-500 text-xs mt-1">{errors.sriLankaAddress}</p>}
          </div>

          {/* Телефон РФ */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Мобильный номер телефона в РФ
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="tel"
              value={formData.phoneRussia || ''}
              onChange={(e) => setFormData({ ...formData, phoneRussia: e.target.value })}
              className={`form-input ${errors.phoneRussia ? 'border-red-500' : ''}`}
              placeholder="+7 (999) 123-45-67"
            />
            {errors.phoneRussia && <p className="text-red-500 text-xs mt-1">{errors.phoneRussia}</p>}
          </div>

          {/* Телефон ШЛ */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Мобильный номер телефона на Шри-Ланке
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="tel"
              value={formData.phoneSriLanka || ''}
              onChange={(e) => setFormData({ ...formData, phoneSriLanka: e.target.value })}
              className={`form-input ${errors.phoneSriLanka ? 'border-red-500' : ''}`}
              placeholder="+94 XX XXX XXXX"
            />
            {errors.phoneSriLanka && <p className="text-red-500 text-xs mt-1">{errors.phoneSriLanka}</p>}
          </div>

          {/* Фото паспорта */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Фото загранпаспорта (без бликов, пальцев)
              <span className="text-red-500 ml-1">*</span>
            </label>
            {!formData.passportPhoto ? (
              <label className={`block border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-[#3B5BFF] hover:bg-[#EAF1FF] transition ${
                errors.passportPhoto ? 'border-red-500' : 'border-gray-300'
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-600">Нажмите для загрузки фото паспорта</p>
                  <p className="text-xs text-gray-400">JPG, PNG · макс. 10MB</p>
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload('passportPhoto', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="border-2 border-emerald-500 bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <p className="text-sm text-gray-800">{formData.passportPhoto.name}</p>
                      <p className="text-xs text-gray-500">
                        {(formData.passportPhoto.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFileUpload('passportPhoto', null)}
                    className="text-sm text-[#3B5BFF] hover:text-[#4F2FE6]"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            )}
            {errors.passportPhoto && <p className="text-red-500 text-xs mt-1">{errors.passportPhoto}</p>}
          </div>

          {/* Фото лица */}
          <div>
            <label className="block mb-2 text-[#212121]">
              Фото Ваше на светлом фоне (как на паспорт)
              <span className="text-red-500 ml-1">*</span>
            </label>
            {!formData.facePhoto ? (
              <label className={`block border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-[#3B5BFF] hover:bg-[#EAF1FF] transition ${
                errors.facePhoto ? 'border-red-500' : 'border-gray-300'
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-600">Нажмите для загрузки вашего фото</p>
                  <p className="text-xs text-gray-400">JPG, PNG · макс. 10MB</p>
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload('facePhoto', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="border-2 border-emerald-500 bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <p className="text-sm text-gray-800">{formData.facePhoto.name}</p>
                      <p className="text-xs text-gray-500">
                        {(formData.facePhoto.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFileUpload('facePhoto', null)}
                    className="text-sm text-[#3B5BFF] hover:text-[#4F2FE6]"
                  >
                    Изменить
                  </button>
                </div>
              </div>
            )}
            {errors.facePhoto && <p className="text-red-500 text-xs mt-1">{errors.facePhoto}</p>}
          </div>

          {/* Стоимость */}
          <div className="vd-grad-soft rounded-xl p-4 border border-blue-100/60">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#212121]">Стоимость продления:</span>
              <span className="text-2xl vd-grad-text font-extrabold tracking-tight">{visa.price.toLocaleString('ru-RU')}₽</span>
            </div>
            <p className="text-sm text-[#0F2A36]/60">После проверки заявки вы перейдёте к оплате</p>
          </div>

          {/* Кнопки — submit + save draft */}
          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              className="!py-4 !rounded-2xl !font-bold"
              onClick={handleGoToPayment}
            >
              Перейти к оплате
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
          </div>
        </div>
      </div>
    </div>
  );
}
