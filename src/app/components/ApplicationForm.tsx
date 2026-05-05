import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Save } from 'lucide-react';
import type { VisaOption } from '../App';
import Step1BasicData from './form-steps/Step1BasicData';
import { getAdditionalServices } from '../lib/db';
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
}

export interface FormData {
  // Basic data (varies by country)
  basicData: Record<string, any>;
  // Additional docs
  additionalDocs: {
    hotelBooking: boolean;
    returnTicket: boolean;
    urgentProcessing: boolean;
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

const STEPS = [
  'Основные данные',
  'Усиление заявки',
  'Контакты',
  'Загрузка фото',
  'Проверка',
  'Оплата'
];

export default function ApplicationForm({ visa, urgent, prefilledAddons, onBack, onContinueDraft }: ApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
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

  // Load draft if exists
  useEffect(() => {
    const draftKey = `draft_${visa.id}_${urgent ? 'urgent' : 'normal'}`;
    setDraftId(draftKey);
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed.formData);
        // Clamp step to valid range (0..STEPS.length-1) — handles legacy drafts with bad step values
        const safeStep = Math.max(0, Math.min(parsed.step ?? 0, STEPS.length - 1));
        setCurrentStep(safeStep);
        if (onContinueDraft) {
          onContinueDraft(parsed);
        }
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, [visa.id, urgent]);

  const getTelegramId = (): number => {
    try { return JSON.parse(localStorage.getItem('userData') ?? '{}').telegramId ?? 0; } catch { return 0; }
  };

  const scheduleReminders = (type: 'draft' | 'payment') => {
    const telegramId = getTelegramId();
    if (!telegramId || !draftId) return;
    fetch('/api/schedule-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_id: telegramId,
        draft_key: draftId,
        country: visa.country,
        visa_type: visa.type,
        type,
      }),
    }).catch(console.error);
  };

  const saveDraft = () => {
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
    localStorage.setItem(draftId, JSON.stringify(draft));

    // Also save to drafts list for ApplicationsTab
    const draftsKey = 'visa_drafts';
    const existingDrafts = JSON.parse(localStorage.getItem(draftsKey) || '[]');
    const draftIndex = existingDrafts.findIndex((d: any) => d.id === draftId);

    if (draftIndex >= 0) {
      existingDrafts[draftIndex] = draft;
    } else {
      existingDrafts.push(draft);
    }

    localStorage.setItem(draftsKey, JSON.stringify(existingDrafts));

    // Schedule draft reminders
    scheduleReminders('draft');

    alert('✅ Черновик сохранен!');
  };

  // When user reaches payment step — schedule "payment abandoned" reminders (once)
  useEffect(() => {
    if (currentStep === 5 && !paymentReminderScheduled.current && draftId) {
      paymentReminderScheduled.current = true;
      scheduleReminders('payment');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, draftId]);

  const updateFormData = (step: keyof FormData, data: any) => {
    setFormData(prev => ({
      ...prev,
      [step]: data,
    }));
  };

  const goToNextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
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

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* Compact Header */}
      <div
        ref={headerRef}
        className="bg-gradient-to-r from-[#0D47A1] to-[#1976D2] text-white sticky top-0 z-10 shadow-md transition-all duration-200"
        style={{ padding: keyboardOpen ? '6px 12px' : '8px 16px' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Top row: back / title / save */}
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-full transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center leading-tight">
              <span className="text-sm font-semibold">{visa.country} · {STEPS[currentStep]}</span>
              {!keyboardOpen && (
                <span className="block text-xs text-blue-200">{calculateTotal()}₽{urgent && visa.country !== 'Вьетнам' ? ' (срочно)' : ''}</span>
              )}
            </div>
            <button onClick={saveDraft} className="p-1.5 hover:bg-white/20 rounded-full transition" title="Сохранить черновик">
              <Save className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar + step counter — always visible (incl. when keyboard is open) */}
          <div className="mt-1.5">
            <div className="h-1 bg-white/25 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-blue-200 mt-0.5">
              <span>Шаг {currentStep + 1}/{STEPS.length}</span>
              <span>{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span>
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
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}