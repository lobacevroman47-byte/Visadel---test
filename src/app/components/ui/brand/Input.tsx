// VISADEL Input — единый стиль для текстовых полей.
//
// Поддерживает label, hint, error, leftIcon, rightIcon. Совпадает с тем,
// как сейчас выглядят формы в админке и в формах броней/виз:
//   - белый фон, rounded-xl, border #E1E5EC
//   - focus → border #3B5BFF + soft brand ring
//   - py-2.5 px-3, text-sm
//
// Примеры:
//   <Input label="Имя" value={v} onChange={e => set(e.target.value)} />
//   <Input label="Сумма" type="number" hint="без копеек" />
//   <Input label="Email" error="Некорректный email" />

import * as React from 'react';
import { cn } from '../utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?:     string;
  hint?:      string;
  error?:     string;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Поведение размера: md (стандарт) или sm (компактные таблицы/фильтры). */
  size?: 'sm' | 'md';
  /** Полная ширина (по умолчанию true). */
  fullWidth?: boolean;
}

const sizeClass = {
  sm: 'py-1.5 px-2.5 text-xs',
  md: 'py-2.5 px-3 text-sm',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    label, hint, error,
    leftIcon, rightIcon,
    size = 'md',
    fullWidth = true,
    className, id, disabled,
    ...rest
  }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="block text-xs text-gray-500 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0F2A36]/45 pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              'w-full bg-white text-[#0F2A36] rounded-xl border transition-colors',
              'placeholder:text-[#0F2A36]/40',
              'focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20',
              error
                ? 'border-rose-400 focus:border-rose-500'
                : 'border-[#E1E5EC] focus:border-[#3B5BFF]',
              disabled && 'bg-gray-50 cursor-not-allowed opacity-60',
              sizeClass[size],
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className,
            )}
            {...rest}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F2A36]/45 pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>
        {error
          ? <p id={`${inputId}-err`}  className="text-[11px] text-rose-500 mt-1">{error}</p>
          : hint
            ? <p id={`${inputId}-hint`} className="text-[11px] text-[#0F2A36]/45 mt-1">{hint}</p>
            : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ── Textarea (тот же стиль) ──────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?:  string;
  error?: string;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, fullWidth = true, className, id, disabled, ...rest }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="block text-xs text-gray-500 mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={!!error}
          className={cn(
            'w-full bg-white text-[#0F2A36] rounded-xl border py-2.5 px-3 text-sm transition-colors',
            'placeholder:text-[#0F2A36]/40',
            'focus:outline-none focus:ring-2 focus:ring-[#3B5BFF]/20',
            error
              ? 'border-rose-400 focus:border-rose-500'
              : 'border-[#E1E5EC] focus:border-[#3B5BFF]',
            disabled && 'bg-gray-50 cursor-not-allowed opacity-60',
            className,
          )}
          {...rest}
        />
        {error
          ? <p className="text-[11px] text-rose-500 mt-1">{error}</p>
          : hint
            ? <p className="text-[11px] text-[#0F2A36]/45 mt-1">{hint}</p>
            : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
