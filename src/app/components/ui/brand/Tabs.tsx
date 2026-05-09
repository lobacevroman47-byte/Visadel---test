// VISADEL Tabs — pill-style горизонтальные табы.
//
// Идентично тому, как они выглядят в админке (Заявки/Брони/Партнёры) и
// внутри модалок (Основное/Анкета/Файлы/Оплата).
//
// Контролируемый компонент: значение и колбэк управляются снаружи.
//
// Пример:
//   const [tab, setTab] = useState('main');
//   <Tabs
//     value={tab}
//     onChange={setTab}
//     items={[
//       { value: 'main',   label: 'Основное' },
//       { value: 'form',   label: 'Анкета'   },
//       { value: 'files',  label: 'Файлы',  badge: 3 },
//     ]}
//   />

import * as React from 'react';
import { cn } from '../utils';

export interface TabItem<V extends string = string> {
  value: V;
  label: React.ReactNode;
  /** Опциональный счётчик (напр. количество файлов). */
  badge?: number | string;
  /** Опциональная иконка слева от label. */
  icon?: React.ReactNode;
}

export interface TabsProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  items: TabItem<V>[];
  /** Стиль пилюль или подчёркиваний. По умолчанию 'pill'. */
  variant?: 'pill' | 'underline';
  /** Заполнять всю ширину контейнера. */
  fullWidth?: boolean;
  className?: string;
}

export function Tabs<V extends string = string>({
  value, onChange, items,
  variant = 'pill',
  fullWidth, className,
}: TabsProps<V>) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex items-center gap-4 border-b border-[#E1E5EC]', className)}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'pb-2 text-sm font-medium transition-colors -mb-px border-b-2',
                active
                  ? 'text-[#3B5BFF] border-[#3B5BFF]'
                  : 'text-[#0F2A36]/60 border-transparent hover:text-[#0F2A36]',
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {item.icon}
                {item.label}
                {item.badge != null && (
                  <span className="text-[10px] font-bold text-[#0F2A36]/45">({item.badge})</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // pill variant
  return (
    <div className={cn('flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl', fullWidth && 'w-full', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5',
              fullWidth && 'flex-1 justify-center',
              active
                ? 'bg-white text-[#0F2A36] shadow-sm'
                : 'text-[#0F2A36]/60 hover:text-[#0F2A36]',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge != null && (
              <span className={cn(
                'text-[10px] font-bold rounded-full px-1.5 py-0.5',
                active ? 'bg-[#EAF1FF] text-[#3B5BFF]' : 'bg-[#0F2A36]/10 text-[#0F2A36]/60',
              )}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
