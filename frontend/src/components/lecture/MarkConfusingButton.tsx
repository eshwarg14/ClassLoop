import { useState } from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MarkConfusingButtonProps {
  onMark: () => void;
  disabled?: boolean;
  className?: string;
}

export function MarkConfusingButton({ onMark, disabled = false, className }: MarkConfusingButtonProps) {
  const [isPulsing, setIsPulsing] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsPulsing(true);
    onMark();
    setTimeout(() => setIsPulsing(false), 600);
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl font-heading font-semibold text-sm transition-all shadow-md select-none focus:outline-none focus:ring-2 focus:ring-confusion-danger',
        'bg-confusion-danger/15 text-confusion-danger border border-confusion-danger/40 hover:bg-confusion-danger/25 hover:border-confusion-danger/60 hover:shadow-glow-danger',
        disabled && 'opacity-40 pointer-events-none cursor-not-allowed',
        className
      )}
    >
      {/* Animated ripple circle */}
      {isPulsing && (
        <span className="absolute inset-0 rounded-xl bg-confusion-danger/30 animate-ping pointer-events-none" />
      )}

      <Flame className={cn('w-4 h-4 text-confusion-danger transition-transform', isPulsing && 'scale-125')} />
      <span>Mark Confusing</span>
      <kbd className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-surface/80 border border-confusion-danger/30 text-confusion-danger">
        M
      </kbd>
    </motion.button>
  );
}
