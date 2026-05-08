// Премиальный полноэкранный экран-успех. Используется ВЕЗДЕ где раньше
// был native alert("Заявка отправлена!" / "Черновик сохранён!"):
//   - Step7Payment после submit заявки
//   - Step7Payment / ApplicationForm после сохранения черновика
//   - HotelBookingForm / FlightBookingForm после submit брони
//   - Партнёрская анкета и пр.
//
// Поддерживает 1 или 2 кнопки. Первая — primary (vd-grad), вторая —
// secondary (outline). Иконка по умолчанию зелёная галка, можно
// заменить на любую через icon prop.

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface SuccessAction {
  label: string;
  onClick: () => void;
}

interface SuccessScreenProps {
  title: string;
  description?: ReactNode;
  // primary action — крупная брендовая кнопка снизу
  primaryAction: SuccessAction;
  // secondary action — серая outline-кнопка под primary; опциональна
  secondaryAction?: SuccessAction;
  // кастомная иконка вместо зелёной галки (например emoji-обёртка)
  icon?: ReactNode;
}

export default function SuccessScreen({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
}: SuccessScreenProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-5 py-12">
      <div className="w-20 h-20 rounded-full vd-grad flex items-center justify-center text-white shadow-lg vd-shadow-cta mb-5">
        {icon ?? <Check className="w-10 h-10" strokeWidth={3} />}
      </div>

      <h1 className="text-[24px] font-extrabold tracking-tight text-[#0F2A36] text-center">
        {title}
      </h1>

      {description && (
        <p className="text-center text-sm text-[#0F2A36]/65 mt-3 max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      <div className="mt-8 w-full max-w-xs flex flex-col gap-2.5">
        <button
          onClick={primaryAction.onClick}
          className="w-full px-6 py-3.5 rounded-2xl vd-grad text-white font-bold tracking-wide shadow-md vd-shadow-cta active:scale-[0.98] transition"
        >
          {primaryAction.label}
        </button>

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="w-full px-6 py-3.5 rounded-2xl border border-gray-200 bg-white text-[#0F2A36] font-semibold active:scale-[0.98] transition hover:bg-gray-50"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
