// VISADEL Button — единый primary CTA / secondary / ghost / danger / success.
//
// Выровнен по существующим inline-стилям (vd-grad, rounded-full/2xl, shadow-cta).
// Существующие <button className="..."> можно мигрировать постепенно.
//
// Примеры:
//   <Button variant="primary">Сохранить</Button>
//   <Button variant="secondary" size="sm">Отмена</Button>
//   <Button variant="success" leftIcon={<Send className="w-4 h-4"/>}>Отправить</Button>

import * as React from 'react';
import { cn } from '../utils';

export type ButtonVariant =
  | 'primary'    // vd-grad — основной CTA
  | 'secondary'  // белый фон + border — второстепенное действие
  | 'ghost'      // прозрачный — третичное (отмена, закрыть)
  | 'danger'     // красный — деструктивное действие
  | 'success'    // зелёный — подтверждение
  | 'soft';      // brandSubtle bg + brand text — мягкая альтернатива primary

export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonShape = 'rounded' | 'pill';

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'vd-grad text-white shadow-md vd-shadow-cta hover:opacity-95 active:opacity-90 disabled:opacity-50',
  secondary:
    'bg-white text-[#0F2A36] border border-[#E1E5EC] hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50',
  ghost:
    'bg-transparent text-[#0F2A36] hover:bg-gray-100 active:bg-gray-200 disabled:opacity-50',
  danger:
    'bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700 disabled:opacity-50',
  success:
    'bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50',
  soft:
    'bg-[#EAF1FF] text-[#3B5BFF] hover:bg-[#DCE7FF] active:bg-[#CFDDFF] disabled:opacity-50',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'py-1.5 px-3 text-xs gap-1.5',
  md: 'py-2.5 px-4 text-sm gap-2',
  lg: 'py-3 px-5 text-sm gap-2',
};

const shapeClass: Record<ButtonShape, string> = {
  rounded: 'rounded-xl',
  pill:    'rounded-full',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  shape?:   ButtonShape;
  fullWidth?: boolean;
  loading?:   boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size    = 'md',
    shape   = 'rounded',
    fullWidth,
    loading,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    ...rest
  }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BFF]/40 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        shapeClass[shape],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading
        ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
        : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  ),
);
Button.displayName = 'Button';
