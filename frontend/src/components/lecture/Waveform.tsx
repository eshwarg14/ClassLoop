import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WaveformProps {
  isListening?: boolean;
  className?: string;
  barCount?: number;
}

export function Waveform({ isListening = true, className, barCount = 18 }: WaveformProps) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-[3px] h-10 px-4 rounded-xl bg-surface/70 border border-border',
        className
      )}
      title={isListening ? 'Audio ingestion active' : 'Audio ingestion paused'}
    >
      {bars.map((idx) => {
        // Pseudo-random height animation delay and duration for organic waveform feel
        const duration = 0.6 + (idx % 5) * 0.15;
        const delay = (idx * 0.05) % 0.4;
        const targetHeights = [
          4 + ((idx * 7) % 18),
          18 + ((idx * 11) % 14),
          6 + ((idx * 5) % 12),
        ];

        return (
          <motion.div
            key={idx}
            className={cn(
              'w-[3px] rounded-full transition-colors',
              isListening ? 'bg-secondary' : 'bg-muted/40'
            )}
            animate={
              isListening
                ? {
                    height: targetHeights,
                  }
                : { height: 4 }
            }
            transition={
              isListening
                ? {
                    duration,
                    delay,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                  }
                : { duration: 0.2 }
            }
            style={{ minHeight: '4px' }}
          />
        );
      })}
    </div>
  );
}
