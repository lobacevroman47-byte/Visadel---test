import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Save } from 'lucide-react';
import type { VisaOption } from '../App';
import Step1BasicData from './form-steps/Step1BasicData';
import Step2AdditionalDocs from './form-steps/Step2AdditionalDocs';
import Step3HowHeard from './form-steps/Step3HowHeard';
import Step4ContactInfo from './form-steps/Step4ContactInfo';
import Step5PhotoUpload from './form-steps/Step5PhotoUpload';
import Step6Review from './form-steps/Step6Review';
import Step7Payment from './form-steps/Step7Payment';

interface ApplicationFormProps {
  visa: VisaOption;
  urgent: boolean;
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
  'Как узнали',
  'Контакты',
  'Загрузка фото',
  'Проверка',
  'Оплата'
];

export default function ApplicationForm({ visa, urgent, onBack, onContinueDraft }: ApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    basicData: {},
    additionalDocs: {
      hotelBooking: false,
      returnTicket: false,
      urgentProcessing: false,
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
  const headerRef = useRef<HTMLDivElement>(null);

  // Keyboard detection — shrink header when keyboard opens
  useEffect(() => {
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const handler = () => {
      const ratio = vv.height / window.innerHeight;
      setKeyboardOpen(ratio < 0.75);
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
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
        setCurrentStep(parsed.step);
        if (onContinueDraft) {
          onContinueDraft(parsed);
        }
      } catch (e) {
        console.error('Failed to load draft', e);
      }
    }
  }, [visa.id, urgent]);

  const saveDraft = () => {
    const draft = {
      id: draftId,
      formData,
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
    alert('✅ Черновик сохранен!');
  };

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
      total += 1000;
    }
    if (formData.additionalDocs.hotelBooking) {
      total += 1000;
    }
    if (formData.additionalDocs.returnTicket) {
      total += 2000;
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

          {/* Progress bar — always visible but thinner */}
          <div className="mt-1.5">
            <div className="h-1 bg-white/25 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {!keyboardOpen && (
              <div className="flex justify-between text-[10px] text-blue-200 mt-0.5">
                <span>Шаг {currentStep + 1}/{STEPS.length}</span>
                <span>{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span>
              </div>
            )}
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
            <Step3HowHeard
              data={formData.howHeard}
              onChange={(data) => updateFormData('howHeard', data)}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 3 && (
            <Step4ContactInfo
              data={formData.contactInfo}
              onChange={(data) => updateFormData('contactInfo', data)}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 4 && (
            <Step5PhotoUpload
              country={visa.country}
              data={formData.photos}
              additionalDocs={formData.additionalDocs}
              onChange={(data) => updateFormData('photos', data)}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 5 && (
            <Step6Review
              formData={formData}
              visa={visa}
              urgent={urgent}
              totalPrice={calculateTotal()}
              onNext={goToNextStep}
              onPrev={goToPrevStep}
            />
          )}
          {currentStep === 6 && (
            <Step7Payment
              formData={formData}
              visa={visa}
              urgent={urgent}
              totalPrice={calculateTotal()}
              onPrev={goToPrevStep}
              onComplete={onBack}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}