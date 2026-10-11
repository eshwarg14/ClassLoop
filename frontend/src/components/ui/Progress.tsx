import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn, confusionColor } from '@/lib/utils';

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  colorScale?: boolean;
}

export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value = 0, colorScale = false, ...props }, ref) => {
  const percentage = Math.min(Math.max(value || 0, 0), 100);
  const normalizedScore = percentage / 100;
  const barColor = colorScale ? confusionColor(normalizedScore) : undefined;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-raised border border-border/60',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full w-full flex-1 transition-all duration-300', !colorScale && 'bg-accent')}
        style={{
          transform: `translateX(-${100 - percentage}%)`,
          backgroundColor: barColor,
        }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;
