import { ChatView } from '@/components/ask/ChatView';
import { Sparkles, BrainCircuit } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

export function AskPage() {
  const activeLecture = useStore((s) => s.activeLecture);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="p-5 rounded-2xl bg-surface/80 border border-border backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shadow-glow-sm">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold font-heading text-foreground">
              Ask ClassLoop Study Intelligence
            </h1>
            <p className="text-xs text-muted font-mono mt-0.5">
              Vector retrieval grounded across lecture audio transcripts, generated notes, and confusion spikes.
            </p>
          </div>
        </div>

        {activeLecture && (
          <div className="hidden sm:block text-right">
            <span className="text-[10px] font-mono uppercase text-muted">Active Scope:</span>
            <span className="block text-xs font-semibold text-accent max-w-xs truncate">
              {activeLecture.title}
            </span>
          </div>
        )}
      </div>

      <ChatView initialLectureId={activeLecture?.id} />
    </div>
  );
}
