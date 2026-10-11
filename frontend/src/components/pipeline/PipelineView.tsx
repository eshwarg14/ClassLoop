import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BrainCircuit,
  Eye,
  FileText,
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Code2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import type { PipelineStep } from '@/lib/api';

interface PipelineViewProps {
  steps: PipelineStep[];
  onRetryStep?: (stepId: string) => void;
  className?: string;
}

const nodeIcons = {
  Orchestrator: BrainCircuit,
  Detector: Eye,
  Content: FileText,
  Scheduler: CalendarDays,
};

const nodeDescriptions = {
  Orchestrator: 'Ingests audio events, tracks session state & routes downstream pipelines',
  Detector: 'Computes multimodal confusion matrix, question tags & flags',
  Content: 'Synthesizes structured Obsidian markdown notes & interactive active recall quiz',
  Scheduler: 'Generates spaced repetition calendar events (1/3/7 day intervals)',
};

export function PipelineView({ steps, className }: PipelineViewProps) {
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);

  const getStatusBadge = (status: PipelineStep['status']) => {
    switch (status) {
      case 'done':
        return (
          <Badge variant="calm" size="sm" className="gap-1">
            <CheckCircle2 className="w-3 h-3 text-confusion-calm" />
            Done
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="accent" size="sm" className="gap-1 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
            Running
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="danger" size="sm" className="gap-1">
            <AlertTriangle className="w-3 h-3 text-confusion-danger" />
            Error
          </Badge>
        );
      case 'waiting':
      default:
        return (
          <Badge variant="outline" size="sm" className="gap-1 text-muted">
            <Clock className="w-3 h-3 text-muted/60" />
            Waiting
          </Badge>
        );
    }
  };

  return (
    <div className={`space-y-8 ${className || ''}`}>
      {/* Visual Pipeline Flow */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {steps.map((step, idx) => {
          const Icon = nodeIcons[step.name] || BrainCircuit;
          const isDone = step.status === 'done';
          const isRunning = step.status === 'running';
          const isError = step.status === 'error';

          return (
            <div key={step.id || step.name} className="relative flex flex-col">
              <motion.div
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedStep(step)}
                className={`p-5 rounded-2xl border bg-surface/80 backdrop-blur-sm transition-all cursor-pointer flex flex-col justify-between h-full relative overflow-hidden group ${
                  isRunning
                    ? 'border-accent shadow-glow-md ring-1 ring-accent'
                    : isDone
                    ? 'border-confusion-calm/50 shadow-sm'
                    : isError
                    ? 'border-confusion-danger/60 shadow-glow-danger'
                    : 'border-border opacity-70 hover:opacity-100 hover:border-border/90'
                }`}
              >
                {/* Status indicator pulse in background if running */}
                {isRunning && (
                  <div className="absolute inset-0 bg-accent/5 animate-pulse pointer-events-none" />
                )}

                <div>
                  {/* Top node header */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                        isRunning
                          ? 'bg-accent/20 border-accent/40 text-accent'
                          : isDone
                          ? 'bg-confusion-calm/15 border-confusion-calm/30 text-confusion-calm'
                          : isError
                          ? 'bg-confusion-danger/15 border-confusion-danger/30 text-confusion-danger'
                          : 'bg-raised border-border text-muted'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {getStatusBadge(step.status)}
                  </div>

                  <h4 className="text-sm font-semibold font-heading text-foreground mb-1">
                    {step.name}
                  </h4>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {nodeDescriptions[step.name]}
                  </p>
                </div>

                {/* Footer metrics & inspect hint */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted/80">
                    {step.latency_ms ? `${step.latency_ms}ms` : isRunning ? 'Running...' : 'Queued'}
                  </span>
                  <span className="text-[11px] text-accent flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    Inspect <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </motion.div>

              {/* Edge connector to next node on desktop */}
              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center pointer-events-none">
                  <div
                    className={`w-5 h-0.5 ${
                      isDone
                        ? 'bg-confusion-calm'
                        : isRunning
                        ? 'bg-accent animate-pulse'
                        : 'bg-border'
                    }`}
                  />
                  {isRunning && (
                    <motion.div
                      className="absolute w-2 h-2 rounded-full bg-accent"
                      animate={{ x: [-10, 10] }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* JSON Inspector Dialog */}
      <Dialog open={Boolean(selectedStep)} onOpenChange={(open) => !open && setSelectedStep(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedStep && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <DialogTitle>{selectedStep.name} Step Trace</DialogTitle>
                  {getStatusBadge(selectedStep.status)}
                </div>
                <DialogDescription>
                  Latency: {selectedStep.latency_ms ? `${selectedStep.latency_ms} ms` : 'N/A'} | Status: {selectedStep.status}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Input Payload */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted uppercase tracking-wider mb-1.5">
                    <Code2 className="w-3.5 h-3.5 text-accent" />
                    <span>Input Payload Preview</span>
                  </div>
                  <pre className="text-xs font-mono bg-raised p-3.5 rounded-xl border border-border/70 overflow-x-auto text-foreground/90 max-h-48">
                    {selectedStep.input_preview
                      ? typeof selectedStep.input_preview === 'string'
                        ? selectedStep.input_preview
                        : JSON.stringify(selectedStep.input_preview, null, 2)
                      : JSON.stringify({ status: 'Awaiting upstream pipeline handoff' }, null, 2)}
                  </pre>
                </div>

                {/* Output Payload */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted uppercase tracking-wider mb-1.5">
                    <Code2 className="w-3.5 h-3.5 text-confusion-calm" />
                    <span>Output Artifact Preview</span>
                  </div>
                  <pre className="text-xs font-mono bg-raised p-3.5 rounded-xl border border-border/70 overflow-x-auto text-foreground/90 max-h-48">
                    {selectedStep.output_preview
                      ? typeof selectedStep.output_preview === 'string'
                        ? selectedStep.output_preview
                        : JSON.stringify(selectedStep.output_preview, null, 2)
                      : selectedStep.status === 'running'
                      ? JSON.stringify({ state: 'Agent synthesizing...' }, null, 2)
                      : JSON.stringify({ state: 'Not yet generated' }, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
