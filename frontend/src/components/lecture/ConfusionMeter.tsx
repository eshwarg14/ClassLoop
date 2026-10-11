import { motion } from 'framer-motion';
import { confusionColor, confusionLabel } from '@/lib/utils';

interface ConfusionMeterProps {
  score: number; // 0.0 to 1.0
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfusionMeter({ score, className, size = 'md' }: ConfusionMeterProps) {
  const normalized = Math.min(Math.max(score, 0), 1);
  const percentage = Math.round(normalized * 100);
  const color = confusionColor(normalized);
  const label = confusionLabel(normalized);

  // SVG Gauge geometry
  const radius = size === 'sm' ? 40 : size === 'lg' ? 70 : 54;
  const strokeWidth = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
  const circumference = 2 * Math.PI * radius;
  // Semi-circle gauge (180 degrees)
  const semiCircumference = circumference / 2;
  const strokeDashoffset = semiCircumference - normalized * semiCircumference;

  return (
    <div className={`flex flex-col items-center justify-center relative select-none ${className || ''}`}>
      <div className="relative flex items-center justify-center">
        <svg
          width={radius * 2 + strokeWidth * 2}
          height={radius + strokeWidth * 2 + 10}
          viewBox={`0 0 ${radius * 2 + strokeWidth * 2} ${radius + strokeWidth * 2 + 10}`}
          className="overflow-visible"
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="confusionMeterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="50%" stopColor="#F5B84B" />
              <stop offset="100%" stopColor="#FF6B6B" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <path
            d={`M ${strokeWidth} ${radius + strokeWidth} A ${radius} ${radius} 0 0 1 ${radius * 2 + strokeWidth} ${radius + strokeWidth}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-border/60"
          />

          {/* Value Progress Arc */}
          <motion.path
            d={`M ${strokeWidth} ${radius + strokeWidth} A ${radius} ${radius} 0 0 1 ${radius * 2 + strokeWidth} ${radius + strokeWidth}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={semiCircumference}
            initial={{ strokeDashoffset: semiCircumference }}
            animate={{ strokeDashoffset }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            style={{
              filter: `drop-shadow(0px 0px 8px ${color}66)`,
            }}
          />
        </svg>

        {/* Center reading value */}
        <div className="absolute bottom-2 flex flex-col items-center">
          <motion.span
            key={percentage}
            initial={{ scale: 0.85, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="font-mono font-bold tracking-tight text-foreground"
            style={{
              fontSize: size === 'sm' ? '1.25rem' : size === 'lg' ? '2.25rem' : '1.75rem',
            }}
          >
            {percentage}%
          </motion.span>
          <span
            className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full mt-0.5"
            style={{
              backgroundColor: `${color}20`,
              color,
              border: `1px solid ${color}40`,
            }}
          >
            {label} Confusion
          </span>
        </div>
      </div>
    </div>
  );
}
