import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const steps = [
    'Основные данные',
    'Документы',
    'Источник',
    'Контакты',
    'Фото',
    'Проверка',
    'Оплата',
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const step = index + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full transition-all ${
                isCompleted
                  ? 'bg-blue-600'
                  : isCurrent
                  ? 'bg-blue-400'
                  : 'bg-gray-200'
              }`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Шаг {currentStep} из {totalSteps}: {steps[currentStep - 1]}
        </span>
        <span className="text-blue-600">
          {Math.round((currentStep / totalSteps) * 100)}%
        </span>
      </div>
    </div>
  );
}
