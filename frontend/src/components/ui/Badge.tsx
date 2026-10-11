import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'calm' | 'warning' | 'danger' | 'accent' | 'default' | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    calm: 'bg-confusion-calm/15 text-confusion-calm border-confusion-calm/30',
    warning: 'bg-confusion-warning/15 text-confusion-warning border-confusion-warning/30',
    danger: 'bg-confusion-danger/15 text-confusion-danger border-confusion-danger/30',
    accent: 'bg-accent/15 text-accent border-accent/30',
    default: 'bg-surface text-foreground border-border',
    outline: 'border-border text-muted bg-transparent',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-medium tracking-wide uppercase',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors select-none font-mono',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
