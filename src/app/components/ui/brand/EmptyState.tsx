// VISADEL EmptyState — стандартный «ничего нет» блок.
//
// Используется в списках виз/броней/партнёров когда пусто. По образцу
// существующих empty-блоков: круглый icon-холдер + title + subtitle + CTA.
//
// Пример:
//   <EmptyState
//     icon={<Plane className="w-6 h-6 text-[#3B5BFF]" />}
//     title="Пока нет броней"
//     subtitle="Создайте первую — мы оформим её за 30 минут"
//     action={<Button>Создать бронь</Button>}
//   />

import * as React from 'react';
import { cn } from '../utils';

export interface EmptyStateProps {
  icon?:    React.ReactNode;
  title:    React.ReactNode;
  subtitle?: React.ReactNode;
  action?:   React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon, title, subtitle, action, className,
}) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-10 px-4', className)}>
    {icon && (
      <div className="w-14 h-14 rounded-full bg-[#EAF1FF] flex items-center justify-center mb-3">
        {icon}
      </div>
    )}
    <div className="text-base font-bold text-[#0F2A36]">{title}</div>
    {subtitle && <div className="text-sm text-[#0F2A36]/60 mt-1 max-w-xs">{subtitle}</div>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
