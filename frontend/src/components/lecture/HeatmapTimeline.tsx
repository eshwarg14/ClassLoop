import { useState } from 'react';
import { motion } from 'framer-motion';
import { formatDuration, confusionColor } from '@/lib/utils';
import type { TranscriptChunk } from '@/lib/api';

interface HeatmapTimelineProps {
  chunks: TranscriptChunk[];
  currentTime?: number;
  duration?: number;
  onSelectChunk?: (chunk: TranscriptChunk) => void;
  className?: string;
}

export function HeatmapTimeline({
  chunks,
  currentTime,
  duration,
  onSelectChunk,
  className,
}: HeatmapTimelineProps) {
  const [hoveredChunk, setHoveredChunk] = useState<TranscriptChunk | null>(null);

  const totalDuration = duration || (chunks.length > 0 ? chunks[chunks.length - 1].end_time : 3600);

  return (
    <div className={`space-y-2 select-none ${className || ''}`}>
      <div className="flex items-center justify-between text-[11px] font-mono text-muted">
        <span>00:00</span>
        <span>Heatmap Scrubber</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>

      <div className="relative h-7 w-full bg-surface border border-border rounded-lg overflow-hidden flex items-center p-0.5 group">
        {chunks.length === 0 ? (
          <div className="w-full text-center text-xs text-muted/60 font-mono">
            Awaiting streaming lecture chunks...
          </div>
        ) : (
          chunks.map((chunk) => {
            const chunkDuration = Math.max(chunk.end_time - chunk.start_time, 10);
            const widthPct = Math.max((chunkDuration / totalDuration) * 100, 2);
            const color = confusionColor(chunk.confusion_score);

            return (
              <button
                key={chunk.id}
                onClick={() => onSelectChunk?.(chunk)}
                onMouseEnter={() => setHoveredChunk(chunk)}
                onMouseLeave={() => setHoveredChunk(null)}
                className="h-full rounded-[3px] mx-[1px] transition-transform hover:scale-y-125 hover:z-10 relative focus:outline-none"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: color,
                  opacity: chunk.is_flagged ? 1 : 0.8,
                }}
                title={`${formatDuration(chunk.start_time)} - ${formatDuration(chunk.end_time)} | Confusion: ${Math.round(chunk.confusion_score * 100)}%`}
              />
            );
          })
        )}

        {/* Current playback / scrubber needle */}
        {currentTime !== undefined && totalDuration > 0 && (
          <motion.div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-glow-md pointer-events-none z-20"
            style={{
              left: `${Math.min((currentTime / totalDuration) * 100, 100)}%`,
            }}
          />
        )}
      </div>

      {/* Hover preview tooltip */}
      {hoveredChunk && (
        <div className="p-2 rounded-lg bg-surface border border-border shadow-lg text-xs flex items-center justify-between gap-4 animate-fade-in font-mono">
          <span className="text-muted">
            {formatDuration(hoveredChunk.start_time)} - {formatDuration(hoveredChunk.end_time)}
          </span>
          <span className="truncate max-w-xs text-foreground font-sans text-xs">
            {hoveredChunk.text}
          </span>
          <span
            className="font-bold px-2 py-0.5 rounded text-[11px]"
            style={{
              color: confusionColor(hoveredChunk.confusion_score),
              backgroundColor: `${confusionColor(hoveredChunk.confusion_score)}20`,
            }}
          >
            {Math.round(hoveredChunk.confusion_score * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
