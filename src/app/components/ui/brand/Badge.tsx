// VISADEL Badge — статус-пилюли (новая, в работе, готова, отменена и т.д.).
//
// Соответствует тому, что уже используется в карточках виз/броней:
//   - bg + text семантического цвета
//   - rounded-full, px-2.5 py-1, text-[11px], font-medium
//
// Варианты:
//   neutral / brand / success / warning / danger / muted
//
// Пример:
//   <Badge variant="success">Готова</Badge>
//   <Badge variant="brand" dot>В работе</Badge>

import * as React from 'react';
import { cn } from '../utils';

export type BadgeVariant =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'muted';

const variantClass: Record<BadgeVariant, string> = {
  neutral: 'bg-gray-100 text-[#0F2A36]',
  brand:   'bg-[#EAF1FF] text-[#3B5BFF]',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger:  'bg-rose-100 text-rose-700',
  muted:   'bg-[#0F2A36]/5 text-[#0F2A36]/60',
};

const dotColor: Record<BadgeVariant, string> = {
  neutral: 'bg-[#0F2A36]/40',
  brand:   'bg-[#3B5BFF]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-rose-500',
  muted:   'bg-[#0F2A36]/30',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Маленькая точка перед текстом (для статусов "в работе"). */
  dot?: boolean;
  /** Размер. По умолчанию 'md'. */
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  dot, size = 'md',
  className, children, ...rest
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
      variantClass[variant],
      className,
    )}
    {...rest}
  >
    {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor[variant])} aria-hidden />}
    {children}
  </span>
);
