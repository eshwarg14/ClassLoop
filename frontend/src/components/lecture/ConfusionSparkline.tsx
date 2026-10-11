import { ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';
import { confusionColor } from '@/lib/utils';

interface ConfusionSparklineProps {
  data: number[];
  height?: number;
  className?: string;
}

export function ConfusionSparkline({ data, height = 48, className }: ConfusionSparklineProps) {
  const chartData = data.map((val, idx) => ({
    i: idx,
    value: Math.round(val * 100),
  }));

  const latestVal = data.length > 0 ? data[data.length - 1] : 0.2;
  const strokeColor = confusionColor(latestVal);

  return (
    <div className={`w-full overflow-hidden ${className || ''}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#sparklineGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
