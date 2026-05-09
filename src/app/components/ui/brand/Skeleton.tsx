// VISADEL Skeleton — серый плейсхолдер для loading state.
//
// Пример:
//   <Skeleton className="h-4 w-32" />
//   <SkeletonCard /> — карточка-плейсхолдер 16px со shadow

import * as React from 'react';
import { cn } from '../utils';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className, ...rest
}) => (
  <div
    className={cn('bg-gray-200 rounded-md animate-pulse', className)}
    aria-hidden
    {...rest}
  />
);

export const SkeletonCard: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3, className,
}) => (
  <div className={cn('bg-white rounded-2xl shadow-sm p-5', className)}>
    <Skeleton className="h-4 w-1/3 mb-3" />
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  </div>
);
