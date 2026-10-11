import * as React from 'react';
import { LucideIcon, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border/80 bg-surface/30',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-raised border border-border flex items-center justify-center text-muted mb-4 shadow-sm">
        <Icon className="w-6 h-6 text-accent/70" />
      </div>
      <h3 className="text-sm font-semibold text-foreground font-heading">{title}</h3>
      <p className="text-xs text-muted max-w-sm mt-1 mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
