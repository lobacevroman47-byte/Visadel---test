import { useState, useEffect, useRef, useCallback } from 'react';
import { generateNewDraftId } from '../lib/visaDrafts';
import { motion } from 'motion/react';
import { ChevronLeft, Save } from 'lucide-react';
import type { VisaOption } from '../App';
import SuccessScreen from './shared/SuccessScreen';
import Step1BasicData from './form-steps/Step1BasicData';
import { getAdditionalServices } from '../lib/db';
import { apiFetch } from '../lib/apiFetch';
import {
  showBackButton, hideBackButton,
  enableClosingConfirmation, disableClosingConfirmation,
  haptic,
} from '../lib/telegram';
import Step2AdditionalDocs from './form-steps/Step2AdditionalDocs';
import Step4ContactInfo from './form-steps/Step4ContactInfo';
import Step5PhotoUpload from './form-steps/Step5PhotoUpload';
import Step6Review from './form-steps/Step6Review';
import Step7Payment from './form-steps/Step7Payment';

interface ApplicationFormProps {
  visa: VisaOption;
  urgent: boolean;
  prefilledAddons?: { urgent: boolean; hotel: boolean; ticket: boolean };
  onBack: () => void;
  onContinueDraft?: (draft: any) => void;
  // Куда вести юзера после "Сохранить черновик" / "Заявка отправлена" —
  // обычно в Профиль → вкладку "Мои заявки", чтобы он видел свой драфт.
  onGoToProfile?: () => void;
  // Если задан — загружаем именно этот черновик (multi-draft режим).
  // Если не задан — генерируем новый UUID для совершенно новой заявки.
  // Передаётся из App.tsx после выбора в DraftPickerModal.
  initialDraftId?: string;
}

// When a user picks the «Бронь отеля для визы» / «Бронь обратного билета»
// addons, we collect the same trip-specific fields here that the standalone
// HotelBookingForm / FlightBookingForm collect — same source of truth.
// Contact info and passport are intentionally NOT duplicated: the visa form
// already collects those.
export interface HotelAddonDetails {
  country?: string;
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  hasChildren?: 'yes' | 'no';
  childrenCount?: number;
  extra_fields?: Record<string, string>;
}

export interface FlightAddonDetails {
  fromCity?: string;
  toCity?: string;
  bookingDate?: string;
  extra_fields?: Record<string, string>;
}

export interface FormData {
  // Basic data (varies by country)
  basicData: Record<string, any>;
  // Additional docs
  additionalDocs: {
    hotelBooking: boolean;
    returnTicket: boolean;
    urgentProcessing: boolean;
    hotelDetails?: HotelAddonDetails;
    flightDetails?: FlightAddonDetails;
  };
  // How heard
  howHeard: string[];
  // Contact info
  contactInfo: {
    email: string;
    phone: string;
    telegram: string;
  };
  // Photos
  photos: {
    facePhoto: File | null;
    passportPhoto: File | null;
    additionalPhotos: Record<string, File | null>;
  };
}

// Имена файлов form-steps/Step{N}.tsx остались исторические — Step3HowHeard
// был удалён (слили в Step1), но переименовывать остальные файлы (Step4 →
// Step3, и т.д.) не стали — слишком много импортов. Поэтому Step4ContactInfo
// рендерится как индекс 2, Step5PhotoUpload как 3, Step6Review как 4,
// Step7Payment как 5. STEPS-массив тут — единственный источник
// display-нумерации.
const STEPS = [
  'Основные данные',   // Step1BasicData       — index 0
  'Усиление заявки',   // Step2AdditionalDocs  — index 1
  'Контакты',          // Step4ContactInfo     — index 2
  'Загрузка фото',     // Step5PhotoUpload     — index 3
  'Проверка',          // Step6Review          — index 4
  'Оплата',            // Step7Payment         — index 5
];

export default function ApplicationForm({ visa, urgent, prefilledAddons, onBack, onContinueDraft, onGoToProfile, initialDraftId }: ApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  // Когда юзер сохраняет черновик — показываем полноэкранный success
  // вместо native alert. 2 кнопки: "Продолжить оформление" (закрыть оверлей)
  // и "В личный кабинет" (выход + переход в Профиль → Мои заявки).
  const [draftSavedShown, setDraftSavedShown] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    basicData: {},
    additionalDocs: {
      hotelBooking: prefilledAddons?.hotel ?? false,
      returnTicket: prefilledAddons?.ticket ?? false,
      urgentProcessing: prefilledAddons?.urgent ?? false,
    },
    howHeard: [],
    contactInfo: {
      email: '',
      phone: '',
      telegram: '',
    },
    photos: {
      facePhoto: null,
      passportPhoto: null,
      additionalPhotos: {},
    },
  });
  const [draftId, setDraftId] = useState<string>('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Addon prices loaded from DB so admin changes propagate to total + breakdown
  const [addonPrices, setAddonPrices] = useState({ urgent: 1000, hotel: 1000, ticket: 2000 });

  useEffect(() => {
    let alive = true;
    getAdditionalServices()
      .then(services => {
        if (!alive) return;
        const enabled = services.filter(s => s.enabled);
        const byId = new Map(enabled.map(s => [s.id, s.price] as const));
        setAddonPrices({
          urgent: byId.get('urgent-processing') ?? 1000,
          hotel:  byId.get('hotel-booking')     ?? 1000,
          ticket: byId.get('flight-booking')    ?? 2000,
        });
      })
      .catch(e => console.warn('addon prices load failed', e));
    return () => { alive = false; };
  }, []);
  const headerRef = useRef<HTMLDivElement>(null);
  const paymentReminderScheduled = useRef(false);

  // Keyboard detection — shrink header when keyboard opens + scroll focused input into view
  useEffect(() => {
    const vv = (window as any).visualViewport;
    if (!vv) return;

    const handler = () => {
      const ratio = vv.height / window.innerHeight;
      setKeyboardOpen(ratio < 0.75);
    };
    vv.addEventListener('resize', handler);

    // Scroll focused input above the keyboard on Android
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      // Wait for keyboard to finish animating (~300ms), then scroll
      setTimeout(() => {
        const headerHeight = headerRef.current?.offsetHeight ?? 56;
        const rect = target.getBoundingClientRect();
        const viewportHeight = (window as any).visualViewport?.height ?? window.innerHeight;
        // If input is behind the header or below the keyboard viewport
        if (rect.top < headerHeight + 8 || rect.bottom > viewportHeight - 8) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
    };

    document.addEventListener('focusin', onFocusIn);
    return () => {
      vv.removeEventListener('resize', handler);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  // Multi-draft setup:
  //   * initialDraftId передан → загружаем именно этот черновик (юзер выбрал
  //     его в DraftPickerModal или нажал «Продолжить» в «Мои заявки»)
  //   * не передан → генерируем UUID для НОВОЙ заявки. Анкета пустая.
  //
  // Раньше draftKey был детерминированный (`draft_${visa.id}_${urgent}`) —
  // это означало ОДИН черновик на визу. Если юзер заполнял для себя, потом
  // открывал ту же визу для жены — данные перетирались. Теперь UUID = каждый
  // драфт независимый, можно оформлять для всей семьи без потерь.
  useEffect(() => {
    if (initialDraftId) {
      // Загружаем существующий
      setDraftId(initialDraftId);
      const savedDraft = localStorage.getItem(initialDraftId);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setFormData(parsed.formData);
          const safeStep = Math.max(0, Math.min(parsed.step ?? 0, STEPS.length - 1));
          setCurrentStep(safeStep);
          if (onContinueDraft) onContinueDraft(parsed);
        } catch (e) {
          console.error('Failed to load draft', e);
        }
      }
    } else {
      // Новая анкета — генерируем UUID. Запись в localStorage появится только
      // когда юзер начнёт заполнять (autosave debounce). До этого ключа нет.
      setDraftId(generateNewDraftId());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraftId, visa.id, urgent]);

  const getTelegramId = (): number => {
    try { return JSON.parse(localStorage.getItem('userData') ?? '{}').telegramId ?? 0; } catch { return 0; }
  };

  const scheduleReminders = (type: 'draft' | 'payment') => {
    const telegramId = getTelegramId();
    if (!telegramId || !draftId) return;
    apiFetch('/api/schedule-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // telegram_id больше не шлём — сервер берёт из verified initData
        draft_key: draftId,
        country: visa.country,
        visa_type: visa.type,
        type,
      }),
    }).catch(console.error);
  };

  // ── Autosave: persistDraft = «тихая» запись в localStorage без push'ей,
  //    запускается из автосейв-хука каждые ~1.5с после изменения. saveDraft
  //    = ручной клик по «Сохранить черновик» — делает persistDraft + ставит
  //    cron-напоминалку + показывает full-screen success-экран.
  const [autoSaveAt, setAutoSaveAt] = useState<number | null>(null);

  const persistDraft = useCallback(() => {
    if (!draftId) return;
    // Strip File objects — they don't survive JSON.stringify
    const draftFormData = {
      ...formData,
      photos: { facePhoto: null, passportPhoto: null, additionalPhotos: {} },
    };
    const draft = {
      id: draftId,
      formData: draftFormData,
      step: currentStep,
      visa,
      urgent,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftId, JSON.stringify(draft));

      // Also save to drafts list for ApplicationsTab
      const draftsKey = 'visa_drafts';
      const existingDrafts = JSON.parse(localStorage.getItem(draftsKey) || '[]');
      const draftIndex = existingDrafts.findIndex((d: { id?: string }) => d.id === draftId);
      if (draftIndex >= 0) existingDrafts[draftIndex] = draft;
      else existingDrafts.push(draft);
      localStorage.setItem(draftsKey, JSON.stringify(existingDrafts));

      setAutoSaveAt(Date.now());
    } catch (e) {
      // localStorage quota / JSON serialization fail — игнорим, юзер
      // увидит в индикаторе что не сохранилось (autoSaveAt не обновится).
      console.warn('[autosave] persist failed:', e);
    }
  }, [draftId, formData, currentStep, visa, urgent]);

  const saveDraft = () => {
    persistDraft();
    scheduleReminders('draft');
    // Полноэкранный success — только при ручном клике
    setDraftSavedShown(true);
  };

  // ── Автосохранение: запускаем persistDraft через 1.5s после последнего
  //    изменения formData / currentStep. Раньше юзер мог потерять анкету
  //    если случайно закрыл мини-апп — теперь данные пишутся в localStorage
  //    автоматически на каждой паузе ввода.
  useEffect(() => {
    if (!draftId) return;
    // Не сейвим пустую заявку (juser ещё не ввёл ничего)
    const hasContent =
      Object.keys(formData.basicData).length > 0 ||
      formData.contactInfo.email || formData.contactInfo.phone || formData.contactInfo.telegram ||
      formData.howHeard.length > 0 ||
      formData.additionalDocs.hotelBooking || formData.additionalDocs.returnTicket ||
      currentStep > 0;
    if (!hasContent) return;
    const timer = setTimeout(persistDraft, 1500);
    return () => clearTimeout(timer);
  }, [formData, currentStep, draftId, persistDraft]);

  // When user reaches payment step — schedule "payment abandoned" reminders (once)
  useEffect(() => {
    if (currentStep === 5 && !paymentReminderScheduled.current && draftId) {
      paymentReminderScheduled.current = true;
      scheduleReminders('payment');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, draftId]);

  // Native Telegram BackButton — на iOS юзеры свайпают назад из системного
  // жеста, не из in-app chevron'a. Без этого мы теряем заполненные поля.
  // На Step 0 кнопка возвращает к каталогу (onBack), на остальных — к
  // предыдущему шагу. Также включаем closing confirmation чтобы свайп
  // вниз / закрытие WebView показал диалог сохранения.
  useEffect(() => {
    enableClosingConfirmation();
    return () => disableClosingConfirmation();
  }, []);

  useEffect(() => {
    const handler = () => {
      if (currentStep === 0) onBack();
      else setCurrentStep(s => Math.max(0, s - 1));
    };
    showBackButton(handler);
    return () => hideBackButton(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const updateFormData = (step: keyof FormData, data: any) => {
    setFormData(prev => ({
      ...prev,
      [step]: data,
    }));
  };

  const goToNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      haptic('light');
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
      haptic('light');
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const calculateTotal = () => {
    let total = visa.price;
    if (formData.additionalDocs.urgentProcessing && visa.country !== 'Вьетнам') {
      total += addonPrices.urgent;
    }
    if (formData.additionalDocs.hotelBooking) {
      total += addonPrices.hotel;
    }
    if (formData.additionalDocs.returnTicket) {
      total += addonPrices.ticket;
    }
    return total;
  };

  // Полноэкранный success после сохранения черновика — заменяет native alert.
  // Юзер выбирает: остаться в форме и продолжить, или уйти в Профиль → Мои заявки.
  if (draftSavedShown) {
    return (
      <div className="min-h-screen bg-[#F5F7FA]">
        <SuccessScreen
          title="Черновик сохранён"
          description={
            <>
              Заявка для <b>{visa.country}</b> сохранена в Личном кабинете → «Мои заявки».
              Можешь вернуться к ней в любой момент — данные не потеряются.
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* Compact Header — VISADEL brand */}
      <div
        ref={headerRef}
        className="bg-white sticky top-0 z-10 border-b border-gray-100 transition-all duration-200"
        style={{ padding: keyboardOpen ? '6px 12px' : '10px 16px' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Top row: back / brand / save */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                // На Step 0 — выход из анкеты (как было). На остальных шагах
                // эта стрелка должна вести к предыдущему шагу, а не закрывать
                // всю анкету. Раньше она всегда дёргала onBack — вернуться
                // в драфте можно было только через Telegram BackButton.
                if (currentStep === 0) onBack();
                else goToPrevStep();
              }}
              className="w-11 h-11 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition active:scale-95"
              aria-label={currentStep === 0 ? 'Назад к каталогу' : 'Предыдущий шаг'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center leading-tight">
              <div className="flex items-center justify-center gap-1.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 12 L9 18 L21 6" stroke="#5C7BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-[#0F2A36] font-extrabold text-[15px] tracking-tight">VISADEL</span>
              </div>
              {!keyboardOpen && (
                <span className="block text-[11px] text-gray-500 mt-0.5">{visa.country} · {STEPS[currentStep]}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Тихий индикатор автосохранения. Показывается на 2.5s после
                  каждого автосейва, потом плавно исчезает. */}
              {autoSaveAt && Date.now() - autoSaveAt < 2500 && !keyboardOpen && (
                <span className="text-[10px] text-emerald-600/80 font-semibold animate-pulse">
                  ✓ Сохранено
                </span>
              )}
              <button onClick={saveDraft} className="w-11 h-11 rounded-full border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-700 transition" title="Сохранить черновик">
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar + step counter — always visible */}
          <div className="mt-2">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full vd-grad rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-medium">
              <span>Шаг {currentStep + 1}/{STEPS.length}{!keyboardOpen ? ` · ${calculateTotal().toLocaleString('ru-RU')} ₽${urgent && visa.country !== 'Вьетнам' ? ' (срочно)' : ''}` : ''}</span>
              <span className="text-[#3B5BFF] font-bold">{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Steps */}
      <div className="max-w-2xl mx-auto p-4">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 0 && (
            <Step1BasicData
              country={visa.country}
              visaId={visa.id}
              data={formData.basicData}
              onChange={(data) => updateFormData('basicData', data)}
              onNext={goToNextStep}
            />
          )}
          {currentStep === 1 && (
            <Step2AdditionalDocs
              country={visa.country}
              data={formData.additionalDocs}
              onChange={(data) => updateFormData('additionalDocs', data)}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 2 && (
            <Step4ContactInfo
              data={formData.contactInfo}
              onChange={(data) => updateFormData('contactInfo', data)}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 3 && (
            <Step5PhotoUpload
              country={visa.country}
              data={formData.photos}
              additionalDocs={formData.additionalDocs}
              onChange={(data) => updateFormData('photos', data)}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 4 && (
            <Step6Review
              formData={formData}
              visa={visa}
              urgent={urgent}
              totalPrice={calculateTotal()}
              addonPrices={addonPrices}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 5 && (
            <Step7Payment
              formData={formData}
              visa={visa}
              urgent={urgent}
              totalPrice={calculateTotal()}
              addonPrices={addonPrices}
              onPrev={goToPrevStep}
              onComplete={onBack}
              onGoToProfile={onGoToProfile}
              draftId={draftId}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}