// VISADEL Modal — центрированная модалка с brand header.
//
// По образцу того, что уже работает в admin/Bookings.tsx и admin/Applications.tsx:
//   - centered (flex items-center)
//   - rounded-2xl, sm:max-w-2xl, max-h-[92vh]
//   - vd-grad-soft header с emoji + label + close X
//   - body scrollable (overflow-y-auto flex-1)
//   - optional footer (липкий внизу, белый фон с верхним border)
//
// Закрытие: backdrop click + Escape + close button → onClose().
// Модалка БЛОКИРУЕТ скролл body пока открыта.
//
// Пример:
//   <Modal
//     open={open}
//     onClose={() => setOpen(false)}
//     icon="🛂"
//     label="Заявка"
//     title="Иван Иванов"
//     subtitle="09.05.26 · @ivan_t"
//     footer={<>...кнопки...</>}
//   >
//     ...content...
//   </Modal>

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Эмодзи перед label (необязательно). */
  icon?: React.ReactNode;
  /** Маленький label в верхней vd-grad-soft строке (напр. "Заявка"). */
  label?: string;
  /** Большой заголовок строкой ниже (напр. имя клиента). */
  title?: React.ReactNode;
  /** Вторая строка заголовка (метаданные). */
  subtitle?: React.ReactNode;
  /** Footer (напр. кнопки сохранения). Рендерится липко внизу. */
  footer?: React.ReactNode;
  /** Кастомизация ширины — по умолчанию 'lg' (sm:max-w-2xl). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Закрывать по клику по backdrop. По умолчанию true. */
  closeOnBackdrop?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const sizeClass = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
};

export const Modal: React.FC<ModalProps> = ({
  open, onClose,
  icon, label, title, subtitle,
  footer, size = 'lg',
  closeOnBackdrop = true,
  className, children,
}) => {
  // Lock body scroll while open + Escape closes
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'bg-white rounded-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-xl',
          sizeClass[size],
          className,
        )}
      >
        {/* Header (vd-grad-soft) */}
        {(label || title || subtitle || icon) && (
          <div className="vd-grad-soft px-5 pt-4 pb-4 relative shrink-0">
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-[#0F2A36]" />
            </button>
            {(icon || label) && (
              <div className="flex items-center gap-2 mb-1">
                {icon && <span className="text-base leading-none">{icon}</span>}
                {label && <span className="text-[10px] uppercase tracking-widest font-bold text-[#0F2A36]/60">{label}</span>}
              </div>
            )}
            {title && <div className="text-[18px] font-extrabold tracking-tight text-[#0F2A36] leading-tight pr-10">{title}</div>}
            {subtitle && <div className="text-xs text-[#0F2A36]/60 mt-1">{subtitle}</div>}
          </div>
        )}

        {/* Body (scrollable) */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer (sticky bottom) */}
        {footer && (
          <div className="border-t border-[#E1E5EC] bg-white px-5 py-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
