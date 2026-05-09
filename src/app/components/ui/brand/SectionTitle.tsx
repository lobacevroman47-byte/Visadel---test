// VISADEL SectionTitle — заголовок секции с опциональным action в правой части.
//
// Соответствует общему паттерну в админке/профиле:
//   "Заголовок секции"      [правая ссылка/кнопка]
//   "опциональный subtitle"
//
// Пример:
//   <SectionTitle title="Активные брони" subtitle="Обновлено только что" />
//   <SectionTitle title="Партнёры" action={<Button size="sm">Добавить</Button>} />

import * as React from 'react';
import { cn } from '../utils';

export interface SectionTitleProps {
  title:    React.ReactNode;
  subtitle?: React.ReactNode;
  action?:   React.ReactNode;
  /** Размер. По умолчанию 'md'. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const titleSize = {
  sm: 'text-sm font-bold',
  md: 'text-base font-bold',
  lg: 'text-[22px] font-extrabold tracking-tight',
};

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title, subtitle, action,
  size = 'md', className,
}) => (
  <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
    <div className="min-w-0">
      <h2 className={cn(titleSize[size], 'text-[#0F2A36] leading-tight')}>{title}</h2>
      {subtitle && <p className="text-xs text-[#0F2A36]/60 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ── MicroLabel — маленькие UPPERCASE подзаголовки над секцией ────────────────

export const MicroLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className, children, ...rest
}) => (
  <span
    className={cn(
      'text-[10px] uppercase tracking-widest font-bold text-[#0F2A36]/60',
      className,
    )}
    {...rest}
  >
    {children}
  </span>
);
