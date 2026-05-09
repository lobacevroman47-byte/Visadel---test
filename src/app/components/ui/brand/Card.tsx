// VISADEL Card — карточка с белым фоном, rounded-2xl, shadow-sm.
//
// Замена inline `bg-white rounded-2xl shadow-sm p-5` который встречается
// сотни раз в pages.
//
// Есть варианты:
//   default — белая карта со shadow-sm
//   soft    — vd-grad-soft (для hero-блоков)
//   flat    — без shadow, с border (для вложенных)
//   ghost   — прозрачный (без bg)
//
// Примеры:
//   <Card>...</Card>
//   <Card variant="soft" padding="lg">...</Card>
//   <Card padding="none"><div className="p-5">custom</div></Card>

import * as React from 'react';
import { cn } from '../utils';

export type CardVariant = 'default' | 'soft' | 'flat' | 'ghost';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const variantClass: Record<CardVariant, string> = {
  default: 'bg-white shadow-sm',
  soft:    'vd-grad-soft',
  flat:    'bg-white border border-[#E1E5EC]',
  ghost:   'bg-transparent',
};

const paddingClass: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  /** Скруглить углы. По умолчанию '2xl' (стандарт VISADEL). */
  radius?:  'xl' | '2xl' | '3xl';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'lg', radius = '2xl', className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        variantClass[variant],
        paddingClass[padding],
        radius === 'xl'  && 'rounded-xl',
        radius === '2xl' && 'rounded-2xl',
        radius === '3xl' && 'rounded-3xl',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

// ── Card sub-parts (опционально, для удобной структуры) ─────────────────────

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={cn('flex items-center justify-between mb-3', className)} {...rest} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...rest }) => (
  <h3 className={cn('text-sm font-bold text-[#0F2A36]', className)} {...rest} />
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={cn('space-y-3', className)} {...rest} />
);
