import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  isSecret?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, helperText, error, isSecret, ...props }, ref) => {
    const [revealed, setRevealed] = React.useState(false);
    const inputType = isSecret ? (revealed ? 'text' : 'password') : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-foreground/85">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            type={inputType}
            className={cn(
              'w-full h-10 px-3.5 py-2 rounded-lg bg-surface text-foreground border border-border placeholder:text-muted/60 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:opacity-50 disabled:bg-surface/50 font-mono text-xs',
              error && 'border-confusion-danger focus:ring-confusion-danger',
              isSecret && 'pr-10',
              className
            )}
            ref={ref}
            {...props}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => setRevealed(!revealed)}
              tabIndex={-1}
              className="absolute right-3 p-1 text-muted hover:text-foreground transition-colors focus:outline-none"
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {error ? (
          <p className="text-xs text-confusion-danger mt-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-muted mt-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
