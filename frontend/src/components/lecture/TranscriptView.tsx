import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, ArrowDownCircle } from 'lucide-react';
import { formatDuration, confusionColorClass } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { TranscriptChunk } from '@/lib/api';

interface TranscriptViewProps {
  chunks: TranscriptChunk[];
  selectedChunkId?: string;
  onSelectChunk?: (chunk: TranscriptChunk) => void;
  className?: string;
}

export function TranscriptView({
  chunks,
  selectedChunkId,
  onSelectChunk,
  className,
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll when new chunks arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chunks, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const getReasonBadgeVariant = (reason: string) => {
    switch (reason.toLowerCase()) {
      case 'question':
        return 'accent';
      case 'rephrase':
        return 'warning';
      case 'check-in':
        return 'calm';
      case 'manual':
        return 'danger';
      case 'pause':
      default:
        return 'default';
    }
  };

  return (
    <div className={`relative flex flex-col h-full bg-surface/40 border border-border rounded-xl overflow-hidden ${className || ''}`}>
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted">
            Live Stream Transcript
          </span>
          <span className="text-[11px] font-mono text-muted/70">
            ({chunks.length} chunks)
          </span>
        </div>

        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded transition-colors ${
            autoScroll ? 'text-accent bg-accent/10' : 'text-muted hover:text-foreground'
          }`}
          title="Toggle autoscroll"
        >
          <ArrowDownCircle className="w-3.5 h-3.5" />
          <span>Auto-scroll {autoScroll ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Transcript stream list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 font-sans"
      >
        {chunks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
            <p className="text-xs font-mono">Listening for live lecture audio stream...</p>
            <p className="text-[11px] text-muted/60 mt-1">Transcripts and confusion scores will appear in real time.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chunks.map((chunk) => {
              const colorInfo = confusionColorClass(chunk.confusion_score);
              const isSelected = selectedChunkId === chunk.id;

              return (
                <motion.div
                  key={chunk.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => onSelectChunk?.(chunk)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    colorInfo.bg
                  } ${colorInfo.border} ${
                    isSelected ? 'ring-2 ring-accent shadow-glow-sm' : 'hover:border-accent/40'
                  }`}
                >
                  {/* Top metadata row */}
                  <div className="flex items-center justify-between gap-2 mb-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground/90">
                        {chunk.speaker || 'Speaker'}
                      </span>
                      <span className="text-muted text-[11px]">
                        {formatDuration(chunk.start_time)} - {formatDuration(chunk.end_time)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {chunk.is_flagged && (
                        <span className="flex items-center gap-1 text-[10px] text-confusion-danger font-semibold bg-confusion-danger/20 border border-confusion-danger/40 px-1.5 py-0.5 rounded">
                          <Flame className="w-3 h-3 text-confusion-danger" />
                          FLAGGED
                        </span>
                      )}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${colorInfo.badge}`}>
                        {Math.round(chunk.confusion_score * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Transcript content */}
                  <p className="text-sm text-foreground/90 leading-relaxed font-normal">
                    {chunk.text}
                  </p>

                  {/* Reason chips */}
                  {chunk.reasons && chunk.reasons.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-border/30">
                      <span className="text-[10px] text-muted font-mono uppercase tracking-wide mr-1">
                        Triggers:
                      </span>
                      {chunk.reasons.map((r, idx) => (
                        <Badge key={idx} variant={getReasonBadgeVariant(r)} size="sm">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
