// VISADEL UI Kit — barrel export.
//
// Использование на страницах:
//   import { Button, Card, Modal, Tabs, Badge, Input } from '@/app/components/ui/brand';
//
// Эта папка — единый источник истины для UI VISADEL Mini App. Существующие
// pages работают на inline Tailwind классах — они продолжают работать. Эта
// папка добавляет reusable wrapper'ы для НОВОГО кода и для постепенной
// миграции старых страниц.

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize, ButtonShape } from './Button';

export { Input, Textarea } from './Input';
export type { InputProps, TextareaProps } from './Input';

export { Card, CardHeader, CardTitle, CardBody } from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant } from './Badge';

export { SectionTitle, MicroLabel } from './SectionTitle';
export type { SectionTitleProps } from './SectionTitle';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { Skeleton, SkeletonCard } from './Skeleton';

// Re-export tokens (foundation) для удобства
export * as tokens from '../tokens';
export { colors, typography, spacing, radii, shadows, sizes, gradients } from '../tokens';
