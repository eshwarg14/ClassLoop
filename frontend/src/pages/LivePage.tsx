import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Bot,
  BrainCircuit,
  Eye,
  FileText,
  CalendarDays,
  Radio,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Waveform } from '@/components/lecture/Waveform';
import { ConfusionMeter } from '@/components/lecture/ConfusionMeter';
import { ConfusionSparkline } from '@/components/lecture/ConfusionSparkline';
import { TranscriptView } from '@/components/lecture/TranscriptView';
import { MarkConfusingButton } from '@/components/lecture/MarkConfusingButton';
import { OnboardingChecklist } from '@/components/shared/OnboardingChecklist';
import { useStore } from '@/hooks/useStore';
import { useSSE } from '@/hooks/useSSE';
import { useEndLecture } from '@/hooks/useLecture';
import { useToast } from '@/components/ui/Toast';
import { formatDuration } from '@/lib/utils';
import { api, type TranscriptChunk } from '@/lib/api';

// Demo simulated lecture stream chunks
const mockDemoChunks: Omit<TranscriptChunk, 'id' | 'lecture_id'>[] = [
  {
    chunk_index: 0,
    text: "Welcome back everyone. Today we are examining Operating Systems Deadlock Fundamentals and resource allocation graphs.",
    start_time: 0,
    end_time: 18,
    confusion_score: 0.12,
    reasons: [],
    speaker: 'Prof. Tanenbaum',
  },
  {
    chunk_index: 1,
    text: "Recall that a set of processes is deadlocked when each process holds a resource and waits for another held within the same set.",
    start_time: 18,
    end_time: 36,
    confusion_score: 0.18,
    reasons: [],
    speaker: 'Prof. Tanenbaum',
  },
  {
    chunk_index: 2,
    text: "Excuse me professor, could you clarify the difference between deadlock and resource starvation?",
    start_time: 36,
    end_time: 52,
    confusion_score: 0.62,
    reasons: ['Question', 'Pause'],
    speaker: 'Student Maya',
  },
  {
    chunk_index: 3,
    text: "Great question. In other words, starvation is indefinite postponement where progress is still possible, whereas deadlock is a permanent circular wait.",
    start_time: 52,
    end_time: 72,
    confusion_score: 0.48,
    reasons: ['Rephrase'],
    speaker: 'Prof. Tanenbaum',
  },
  {
    chunk_index: 4,
    text: "Wait, why do all four Coffman conditions have to hold simultaneously for a deadlock to occur?",
    start_time: 72,
    end_time: 90,
    confusion_score: 0.78,
    reasons: ['Question', 'Check-in'],
    speaker: 'Student Alex',
  },
  {
    chunk_index: 5,
    text: "This is where students often get lost: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait form a logical AND condition.",
    start_time: 90,
    end_time: 115,
    confusion_score: 0.89,
    reasons: ['Rephrase', 'Pause'],
    speaker: 'Prof. Tanenbaum',
  },
  {
    chunk_index: 6,
    text: "Next, in the Banker's Algorithm, we check if the Need matrix is less than or equal to the Available work vector before granting a request.",
    start_time: 115,
    end_time: 138,
    confusion_score: 0.74,
    reasons: ['Pause'],
    speaker: 'Prof. Tanenbaum',
  },
  {
    chunk_index: 7,
    text: "Does everyone follow how safe state verification prevents entering an unsafe allocation trajectory?",
    start_time: 138,
    end_time: 158,
    confusion_score: 0.66,
    reasons: ['Check-in', 'Question'],
    speaker: 'Prof. Tanenbaum',
  },
];

export function LivePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [launchingBackendDemo, setLaunchingBackendDemo] = useState(false);

  const {
    activeLecture,
    liveTranscript,
    confusionScores,
    latestConfusionScore,
    sessionDuration,
    isSessionActive,
    demoMode,
    demoPlaying,
    demoSpeed,
    setActiveLecture,
    setSessionActive,
    incrementDuration,
    addTranscriptChunk,
    markChunkFlagged,
    setDemoMode,
    setDemoPlaying,
    setDemoSpeed,
    resetActiveLecture,
  } = useStore();

  const endLectureMutation = useEndLecture();

  // SSE Hook
  useSSE(activeLecture?.id);

  // Timer interval for active session
  useEffect(() => {
    let interval: number;
    if (isSessionActive) {
      interval = window.setInterval(() => {
        incrementDuration();
      }, 1000 / (demoMode && demoPlaying ? demoSpeed : 1));
    }
    return () => clearInterval(interval);
  }, [isSessionActive, incrementDuration, demoMode, demoPlaying, demoSpeed]);

  // Demo playback simulation driver
  useEffect(() => {
    let demoTimer: number;
    if (demoMode && demoPlaying) {
      const nextChunkIdx = liveTranscript.length;
      if (nextChunkIdx < mockDemoChunks.length) {
        demoTimer = window.setTimeout(() => {
          const raw = mockDemoChunks[nextChunkIdx];
          const chunk: TranscriptChunk = {
            ...raw,
            id: `demo-chunk-${nextChunkIdx}`,
            lecture_id: activeLecture?.id || 'demo-lecture-1',
          };
          addTranscriptChunk(chunk);
        }, 3000 / demoSpeed);
      } else {
        setDemoPlaying(false);
        toast.info('Demo Stream Finished', 'All simulated lecture segments ingested. Click End Lecture Session to run the autonomous pipeline.');
      }
    }
    return () => clearTimeout(demoTimer);
  }, [demoMode, demoPlaying, liveTranscript.length, demoSpeed, activeLecture?.id, addTranscriptChunk, setDemoPlaying, toast]);

  const handleStartSession = () => {
    setActiveLecture({
      id: `lec-${Date.now()}`,
      title: 'Operating Systems: Deadlock Fundamentals & Banker Algorithm',
      subject: 'Computer Science',
      created_at: new Date().toISOString(),
      status: 'active',
      mean_confusion: 0.2,
      peak_confusion: 0.2,
      flagged_count: 0,
      visibility: 'private',
    });
    setSessionActive(true);
    toast.success('Lecture Session Started', 'Listening for live Omi audio transcription events.');
  };

  const handleStartDemo = () => {
    resetActiveLecture();
    setActiveLecture({
      id: 'demo-lecture-1',
      title: 'Demo Session: Operating Systems Deadlock Fundamentals',
      subject: 'Computer Science 301',
      created_at: new Date().toISOString(),
      status: 'active',
      mean_confusion: 0.42,
      peak_confusion: 0.89,
      flagged_count: 1,
      visibility: 'private',
    });
    setDemoMode(true);
    setDemoPlaying(true);
    setSessionActive(true);
    toast.info('Demo Mode Engaged', 'Streaming realistic lecture transcription and confusion shifts.');
  };

  const handleRunFullBackendDemo = async () => {
    setLaunchingBackendDemo(true);
    try {
      const res = await api.triggerDemoSession();
      setActiveLecture({
        id: res.lecture_id,
        title: 'Operating Systems: Deadlock Fundamentals',
        subject: 'Computer Science 301',
        created_at: new Date().toISOString(),
        status: 'processing',
        mean_confusion: 0.54,
        peak_confusion: 0.89,
        flagged_count: 2,
        visibility: 'private',
      });
      toast.success('Backend Demo Ingested', 'Chunks embedded into Qdrant and Lyzr agent pipeline started.');
      navigate('/pipeline');
    } catch {
      handleStartDemo();
    } finally {
      setLaunchingBackendDemo(false);
    }
  };

  const handleEndSession = async () => {
    setEndDialogOpen(false);
    setSessionActive(false);
    setDemoPlaying(false);

    if (demoMode) {
      try {
        const res = await api.triggerDemoSession();
        setActiveLecture({
          id: res.lecture_id,
          title: 'Operating Systems: Deadlock Fundamentals',
          subject: 'Computer Science 301',
          created_at: new Date().toISOString(),
          status: 'processing',
          mean_confusion: 0.54,
          peak_confusion: 0.89,
          flagged_count: 2,
          visibility: 'private',
        });
      } catch {
        // Fallback to client demo lecture id if offline
      }
    } else if (activeLecture?.id) {
      try {
        await endLectureMutation.mutateAsync(activeLecture.id);
      } catch {
        // Continue to pipeline regardless
      }
    }

    toast.success('Session Ended', 'Handoff triggered: Autonomous pipeline agents activated.');
    navigate('/pipeline');
  };

  const handleMarkLatestConfusing = () => {
    if (liveTranscript.length === 0) {
      toast.warning('No Chunk to Flag', 'Wait for transcription segments to appear.');
      return;
    }
    const latest = liveTranscript[liveTranscript.length - 1];
    markChunkFlagged(latest.id);
    toast.warning('Segment Flagged', 'Marked as confusing with score 1.0. Will receive deep focus in study notes.');
  };

  const meanConfusion = liveTranscript.length > 0
    ? Math.round((liveTranscript.reduce((acc, c) => acc + c.confusion_score, 0) / liveTranscript.length) * 100)
    : 0;
  const peakConfusion = liveTranscript.length > 0
    ? Math.round(Math.max(...liveTranscript.map((c) => c.confusion_score)) * 100)
    : 0;
  const flaggedCount = liveTranscript.filter((c) => c.is_flagged || c.confusion_score >= 0.7).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Onboarding Checklist if first run */}
      <OnboardingChecklist />

      {/* Hero Session Control Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-surface/80 border border-border backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${
              isSessionActive
                ? 'bg-confusion-danger/15 border-confusion-danger/40 text-confusion-danger shadow-glow-danger'
                : 'bg-raised border-border text-muted'
            }`}>
              <Radio className={`w-6 h-6 ${isSessionActive ? 'animate-pulse' : ''}`} />
            </div>
            {isSessionActive && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-confusion-danger animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold font-heading text-foreground">
                {activeLecture?.title || 'No Active Lecture Stream'}
              </h2>
              {isSessionActive && (
                <Badge variant="danger" size="sm" className="font-mono">
                  LIVE STREAMING
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted font-mono mt-0.5">
              Elapsed Time: {formatDuration(sessionDuration)} | Ingested Segments: {liveTranscript.length} | Flagged Spikes: {flaggedCount}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {!isSessionActive ? (
            <>
              <Button variant="secondary" size="md" onClick={handleStartDemo}>
                <Sparkles className="w-4 h-4 mr-1.5 text-accent" />
                <span>Simulate Live Stream</span>
              </Button>
              <Button
                variant="secondary"
                size="md"
                loading={launchingBackendDemo}
                onClick={handleRunFullBackendDemo}
              >
                <Zap className="w-4 h-4 mr-1.5 text-warning" />
                <span>Instant Full Demo</span>
              </Button>
              <Button variant="primary" size="md" onClick={handleStartSession}>
                <Play className="w-4 h-4 mr-1.5" />
                <span>Begin Real Lecture</span>
              </Button>
            </>
          ) : (
            <>
              <MarkConfusingButton onMark={handleMarkLatestConfusing} />
              <Button
                variant="danger"
                size="md"
                onClick={() => setEndDialogOpen(true)}
              >
                <Square className="w-4 h-4 mr-1.5" />
                <span>End Lecture Session</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Observatory Telemetry KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card variant="surface" className="p-4 border-border/80 bg-surface/75 flex flex-col justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Telemetry State</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-base font-bold font-heading text-foreground">
              {isSessionActive ? (demoMode ? 'Simulated Stream' : 'Omi Webhook Live') : 'Standby Ready'}
            </span>
            <Badge variant={isSessionActive ? 'calm' : 'outline'} size="sm" className="font-mono">
              {isSessionActive ? 'ACTIVE' : 'IDLE'}
            </Badge>
          </div>
        </Card>

        <Card variant="surface" className="p-4 border-border/80 bg-surface/75 flex flex-col justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Mean Confusion</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-bold font-mono text-confusion-calm">{meanConfusion}%</span>
            <span className="text-[11px] font-mono text-muted">{liveTranscript.length} chunks</span>
          </div>
        </Card>

        <Card variant="surface" className="p-4 border-border/80 bg-surface/75 flex flex-col justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Peak Confusion Spike</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xl font-bold font-mono text-confusion-danger">{peakConfusion}%</span>
            <span className="text-[11px] font-mono text-muted">{flaggedCount} high-priority</span>
          </div>
        </Card>

        <Card variant="surface" className="p-4 border-border/80 bg-surface/75 flex flex-col justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Vector Memory</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-bold font-mono text-accent truncate">Qdrant (384-dim)</span>
            <Badge variant="outline" size="sm" className="font-mono">
              org_memory
            </Badge>
          </div>
        </Card>
      </div>

      {/* Demo Replay Control Strip (when in Demo Mode) */}
      {demoMode && (
        <Card variant="raised" className="p-3.5 px-5 bg-accent/5 border-accent/30 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-accent">
            <Zap className="w-4 h-4" />
            <span className="font-semibold uppercase tracking-wider">Demo Replay Sandbox:</span>
            <span className="text-muted">Simulating teacher-student interaction & vocal dynamics</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDemoPlaying(!demoPlaying)}
              className="h-8 px-3 text-xs"
            >
              {demoPlaying ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
              <span>{demoPlaying ? 'Pause Stream' : 'Resume'}</span>
            </Button>

            <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded-lg border border-border text-xs font-mono">
              <span className="text-muted mr-1">Speed:</span>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setDemoSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    demoSpeed === spd ? 'bg-accent text-white font-bold' : 'text-muted hover:text-foreground'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartDemo}
              className="h-8 px-2 text-muted hover:text-foreground"
              title="Reset Demo Replay"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Live Observatory Intelligence Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Real-time Meters & Ingestion status */}
        <div className="space-y-6">
          {/* Real-time Confusion Meter Gauge */}
          <Card variant="raised" className="p-6 bg-surface/90 border-border/80 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-between w-full mb-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-accent" />
                Real-Time Confusion Score
              </span>
              <Badge variant="outline" size="sm" className="font-mono">
                Detector Model
              </Badge>
            </div>

            <div className="my-2">
              <ConfusionMeter score={latestConfusionScore} size="lg" />
            </div>

            <p className="text-xs text-muted mt-4 leading-relaxed max-w-xs">
              Multimodal scoring from acoustic pauses, linguistic question patterns, and manual flags.
            </p>
          </Card>

          {/* Confusion Trend Sparkline */}
          <Card variant="raised" className="p-5 bg-surface/90 border-border/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted">
              <span>Historical Trend (Past Segments)</span>
              <span>Recent 60 Chunks</span>
            </div>
            <ConfusionSparkline data={confusionScores} height={60} />
          </Card>

          {/* Audio Ingestion Waveform */}
          <Card variant="raised" className="p-5 bg-surface/90 border-border/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted">
              <span>Omi Audio Ingestion</span>
              <span className="text-secondary font-semibold">
                {isSessionActive ? 'Active Stream' : 'Standby'}
              </span>
            </div>
            <Waveform isListening={isSessionActive} barCount={24} />
          </Card>
        </div>

        {/* Right Columns: Streaming Transcript */}
        <div className="lg:col-span-2 min-h-[520px] flex flex-col">
          <TranscriptView chunks={liveTranscript} className="flex-1 shadow-md" />
        </div>
      </div>

      {/* Autonomous Agents Standing-by Strip */}
      <Card variant="surface" className="p-4 bg-surface/60 border-border/70 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Bot className="w-4 h-4 text-accent" />
          <span className="font-mono font-semibold uppercase tracking-wider">Agents Standing By:</span>
          <span>Orchestrator, Detector, Content & Scheduler ready for session completion.</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-muted/80">
          <span className="flex items-center gap-1.5"><BrainCircuit className="w-3.5 h-3.5 text-accent" /> Orchestrator</span>
          <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-confusion-calm" /> Detector</span>
          <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-warning" /> Content</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-accent" /> Scheduler</span>
        </div>
      </Card>

      {/* End Lecture Confirm Dialog */}
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>End Lecture Session?</DialogTitle>
            <DialogDescription>
              Terminating this session will trigger the autonomous pipeline to synthesize Obsidian notes, generate active recall quizzes, and configure spaced repetition schedules.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs font-mono text-muted">
            Total Session Duration: {formatDuration(sessionDuration)} | Ingested Segments: {liveTranscript.length}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEndDialogOpen(false)}>
              Keep Session Live
            </Button>
            <Button variant="primary" onClick={handleEndSession}>
              Confirm & Launch Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
