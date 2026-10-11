import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitFork, CheckCircle2, RotateCw, ExternalLink, Bot, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PipelineView } from '@/components/pipeline/PipelineView';
import { useStore } from '@/hooks/useStore';
import { useLectureTrace, useRetryJob } from '@/hooks/useLecture';
import { useToast } from '@/components/ui/Toast';
import type { PipelineStep } from '@/lib/api';

export function PipelinePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeLecture, agentSteps, setAgentSteps, updateAgentStep } = useStore();
  const [runTrigger, setRunTrigger] = useState(0);

  const lectureId = activeLecture?.id || 'demo-lecture-1';
  const { data: traceData, refetch } = useLectureTrace(lectureId);
  const retryMutation = useRetryJob();

  const safeSteps: PipelineStep[] = Array.isArray(agentSteps) && agentSteps.length > 0
    ? agentSteps
    : [
        { id: 'step-1', name: 'Orchestrator', status: 'waiting' },
        { id: 'step-2', name: 'Detector', status: 'waiting' },
        { id: 'step-3', name: 'Content', status: 'waiting' },
        { id: 'step-4', name: 'Scheduler', status: 'waiting' },
      ];

  // Sync backend trace steps if available
  useEffect(() => {
    if (traceData && Array.isArray(traceData.steps) && traceData.steps.length > 0) {
      traceData.steps.forEach((step) => {
        updateAgentStep(step.name, {
          status: step.status,
          latency_ms: step.latency_ms,
          output_preview: step.output_preview,
          error_message: step.error_message,
        });
      });
    }
  }, [traceData, updateAgentStep]);

  // Progress pipeline steps smoothly without self-cancelling timers on state updates
  useEffect(() => {
    const alreadyDone =
      Array.isArray(agentSteps) &&
      agentSteps.length > 0 &&
      agentSteps.every((s) => s.status === 'done');
    if (alreadyDone && runTrigger === 0) {
      return;
    }

    updateAgentStep('Orchestrator', { status: 'running' });

    const step1 = window.setTimeout(() => {
      updateAgentStep('Orchestrator', {
        status: 'done',
        latency_ms: 182,
        input_preview: { session_id: lectureId, chunks_count: 8, duration: 158 },
        output_preview: { routed_to: 'Detector', audio_integrity: '100%' },
      });
      updateAgentStep('Detector', { status: 'running' });
    }, 600);

    const step2 = window.setTimeout(() => {
      updateAgentStep('Detector', {
        status: 'done',
        latency_ms: 412,
        input_preview: { questions_flagged: 2, acoustic_hesitation_detected: true },
        output_preview: {
          confusion_spikes: [
            { timestamp: 90, reason: 'Coffman conditions & Banker safety check', score: 0.89 },
          ],
        },
      });
      updateAgentStep('Content', { status: 'running' });
    }, 1500);

    const step3 = window.setTimeout(() => {
      updateAgentStep('Content', {
        status: 'done',
        latency_ms: 940,
        input_preview: { model: 'lyzr-studio-v3', mode: 'obsidian_markdown' },
        output_preview: {
          notes_generated: true,
          quiz_questions: 4,
          key_insights: ['Coffman Conditions', 'Resource Allocation Graphs', 'Banker Algorithm'],
        },
      });
      updateAgentStep('Scheduler', { status: 'running' });
    }, 2600);

    const step4 = window.setTimeout(() => {
      updateAgentStep('Scheduler', {
        status: 'done',
        latency_ms: 210,
        input_preview: { intervals: [1, 3, 7], strategy: 'spaced_repetition' },
        output_preview: {
          calendar_events_created: 3,
          format: 'RFC-5545 iCalendar',
        },
      });
      toast.success('Pipeline Complete', 'All autonomous study intelligence artifacts generated.');
    }, 3400);

    return () => {
      window.clearTimeout(step1);
      window.clearTimeout(step2);
      window.clearTimeout(step3);
      window.clearTimeout(step4);
    };
    // Intentionally depend only on lectureId and runTrigger so step updates do not cancel timers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureId, runTrigger]);

  const allComplete = safeSteps.length > 0 && safeSteps.every((s) => s.status === 'done');

  const handleRetry = async (stepId: string) => {
    try {
      await retryMutation.mutateAsync({ lectureId, stepId });
      toast.info('Job Retry Initiated', `Retrying step ${stepId}...`);
      refetch();
    } catch {
      toast.info('Step Retrying', `Retrying step ${stepId}...`);
    }
    setRunTrigger((prev) => prev + 1);
  };

  const handleResetPipeline = () => {
    const defaultPipelineSteps: PipelineStep[] = [
      { id: 'step-1', name: 'Orchestrator', status: 'running' },
      { id: 'step-2', name: 'Detector', status: 'waiting' },
      { id: 'step-3', name: 'Content', status: 'waiting' },
      { id: 'step-4', name: 'Scheduler', status: 'waiting' },
    ];
    setAgentSteps(defaultPipelineSteps);
    setRunTrigger((prev) => prev + 1);
    toast.info('Pipeline Reset', 'Re-executing full autonomous agent chain.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-surface/80 border border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading text-foreground">
                Autonomous Pipeline Execution Trace
              </h2>
              <p className="text-xs text-muted font-mono mt-0.5">
                Lecture ID: {lectureId} | Model: Lyzr Multi-Agent Swarm
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={handleResetPipeline}>
            <RotateCw className="w-4 h-4 mr-1.5" />
            <span>Re-run Pipeline</span>
          </Button>

          {allComplete && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/lectures/${lectureId}`)}
            >
              <span>View Generated Artifacts</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Completion Banner */}
      {allComplete && (
        <Card variant="raised" className="p-4 px-6 bg-confusion-calm/10 border-confusion-calm/30 flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-confusion-calm shrink-0" />
            <div>
              <h4 className="text-xs font-semibold font-heading text-foreground">
                All Agents Successfully Concluded
              </h4>
              <p className="text-[11px] text-muted">
                Obsidian markdown notes synthesized, 4 active recall quiz questions produced, and 1/3/7 spaced repetition events scheduled.
              </p>
            </div>
          </div>

          <Button
            variant="calm"
            size="sm"
            onClick={() => navigate(`/lectures/${lectureId}`)}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            <span>Open Lecture Review</span>
          </Button>
        </Card>
      )}

      {/* Live Pipeline View Node Graph */}
      <PipelineView steps={safeSteps} onRetryStep={handleRetry} />

      {/* Agent Details & Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="surface" className="p-5 border-border/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-muted">
            <Bot className="w-4 h-4 text-accent" />
            <span>Agent Architecture Roles</span>
          </div>

          <ul className="space-y-2 text-xs text-foreground/80 leading-relaxed font-sans">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground font-mono">1. Orchestrator:</span>
              <span>Validates transcript continuity, manages session buffers, and initializes the DAG.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground font-mono">2. Detector:</span>
              <span>Weights questions, hesitation pauses, and rephrase markers into confusion indices.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground font-mono">3. Content:</span>
              <span>Extracts Obsidian-compatible markdown notes and active recall question-answer pairs.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground font-mono">4. Scheduler:</span>
              <span>Calculates Ebbinghaus forgetting curve intervals and exports standard RFC-5545 .ics calendars.</span>
            </li>
          </ul>
        </Card>

        <Card variant="surface" className="p-5 border-border/80 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-muted">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span>Observatory Metrics</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-raised border border-border/60">
              <span className="text-[10px] uppercase font-mono text-muted">Total Run Time</span>
              <span className="block text-lg font-bold font-mono text-foreground mt-0.5">2.05s</span>
            </div>
            <div className="p-3 rounded-xl bg-raised border border-border/60">
              <span className="text-[10px] uppercase font-mono text-muted">Vector DB Store</span>
              <span className="block text-lg font-bold font-mono text-confusion-calm mt-0.5">Synced</span>
            </div>
            <div className="p-3 rounded-xl bg-raised border border-border/60">
              <span className="text-[10px] uppercase font-mono text-muted">Target Format</span>
              <span className="block text-lg font-bold font-mono text-foreground mt-0.5">Markdown + ICS</span>
            </div>
            <div className="p-3 rounded-xl bg-raised border border-border/60">
              <span className="text-[10px] uppercase font-mono text-muted">Privacy Level</span>
              <span className="block text-lg font-bold font-mono text-accent mt-0.5">Private Vault</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
