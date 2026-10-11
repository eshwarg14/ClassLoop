import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'calm';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

    const variants = {
      primary:
        'bg-accent text-white hover:bg-accent-hover shadow-sm hover:shadow-glow-sm border border-accent/20',
      secondary:
        'bg-surface text-foreground hover:bg-raised border border-border hover:border-accent/40',
      ghost:
        'text-muted hover:text-foreground hover:bg-surface/80',
      danger:
        'bg-confusion-danger/10 text-confusion-danger border border-confusion-danger/30 hover:bg-confusion-danger/20 hover:border-confusion-danger/50 shadow-sm hover:shadow-glow-danger',
      calm:
        'bg-confusion-calm/10 text-confusion-calm border border-confusion-calm/30 hover:bg-confusion-calm/20 shadow-sm hover:shadow-glow-calm',
      outline:
        'border border-border bg-transparent hover:bg-surface text-foreground',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-4 py-2 gap-2 h-10',
      lg: 'text-base px-6 py-2.5 gap-2.5 h-12 font-semibold',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
