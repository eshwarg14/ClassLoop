import { RotateCcw, Activity, Sparkles, Clock, Volume2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { confusionColor, confusionLabel } from '@/lib/utils';
import type { AppSettings, BehaviourWeights } from '@/lib/api';

interface BehaviourSettingsProps {
  settings: AppSettings['behaviour'];
  onChange: (updated: Partial<AppSettings['behaviour']>) => void;
  className?: string;
}

const defaultWeights: BehaviourWeights = {
  question: 0.35,
  rephrase: 0.25,
  pause: 0.15,
  vocal_stress: 0.15,
  manual_override: 0.1,
};

// Sample OS Deadlocks lecture segments for real-time live preview scoring
const sampleDeadlockSegments = [
  {
    id: 'seg-1',
    speaker: 'Prof. Tanenbaum',
    timestamp: '04:12',
    text: 'A set of processes is in a deadlock state when every process in the set is waiting for an event that only another process in the set can cause.',
    signals: { question: 0.0, rephrase: 0.0, pause: 0.1, vocal_stress: 0.1, manual_override: 0.0 },
    triggers: ['Definitions'],
  },
  {
    id: 'seg-2',
    speaker: 'Student Maya',
    timestamp: '05:45',
    text: 'Wait, so is starvation the exact same thing as a deadlock, or can a process starve without a deadlock occurring?',
    signals: { question: 1.0, rephrase: 0.0, pause: 0.4, vocal_stress: 0.7, manual_override: 0.0 },
    triggers: ['Question', 'Vocal Strain'],
  },
  {
    id: 'seg-3',
    speaker: 'Prof. Tanenbaum',
    timestamp: '06:20',
    text: 'To put it another way, starvation is indefinite delay due to scheduling bias, whereas deadlock is a permanent circular wait.',
    signals: { question: 0.0, rephrase: 1.0, pause: 0.3, vocal_stress: 0.2, manual_override: 0.0 },
    triggers: ['Rephrase', 'Contrast'],
  },
  {
    id: 'seg-4',
    speaker: 'Prof. Tanenbaum',
    timestamp: '08:10',
    text: 'Notice that if any ONE of the four Coffman conditions is broken (mutual exclusion, hold and wait, no preemption, or circular wait), deadlock is mathematically impossible.',
    signals: { question: 0.2, rephrase: 0.4, pause: 0.8, vocal_stress: 0.5, manual_override: 0.0 },
    triggers: ['Acoustic Pause', 'Key Principle'],
  },
];

export function BehaviourSettings({ settings, onChange, className }: BehaviourSettingsProps) {
  const weights = settings.weights || defaultWeights;

  const handleWeightChange = (key: keyof BehaviourWeights, val: number) => {
    onChange({
      weights: {
        ...weights,
        [key]: val,
      },
    });
  };

  const handleResetWeights = () => {
    onChange({ weights: defaultWeights });
  };

  const sumWeights = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  // Calculate live score for a sample segment based on active slider weights
  const computeScore = (signals: typeof sampleDeadlockSegments[0]['signals']) => {
    const raw =
      weights.question * signals.question +
      weights.rephrase * signals.rephrase +
      weights.pause * signals.pause +
      weights.vocal_stress * signals.vocal_stress +
      weights.manual_override * signals.manual_override;
    return Math.min(Math.max(raw / sumWeights, 0), 1);
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Confusion Weights Card */}
      <Card variant="raised" className="bg-surface/90 border-border/80 p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold font-heading text-foreground">
              Confusion Scoring Matrix Weights
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Adjust how the Detector agent balances question density, rephrase markers, and vocal pauses.
            </p>
          </div>

          <Button variant="ghost" size="sm" onClick={handleResetWeights} className="text-xs">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            <span>Reset Defaults</span>
          </Button>
        </div>

        <div className="space-y-5">
          <Slider
            label="Question Trigger Weight (Student Queries)"
            valueDisplay={`${Math.round(weights.question * 100)}%`}
            value={[weights.question * 100]}
            max={100}
            step={5}
            onValueChange={([val]) => handleWeightChange('question', val / 100)}
          />

          <Slider
            label="Rephrase Marker Weight ('In other words', 'To put it another way')"
            valueDisplay={`${Math.round(weights.rephrase * 100)}%`}
            value={[weights.rephrase * 100]}
            max={100}
            step={5}
            onValueChange={([val]) => handleWeightChange('rephrase', val / 100)}
          />

          <Slider
            label="Acoustic Pause / Silence Hesitation"
            valueDisplay={`${Math.round(weights.pause * 100)}%`}
            value={[weights.pause * 100]}
            max={100}
            step={5}
            onValueChange={([val]) => handleWeightChange('pause', val / 100)}
          />

          <Slider
            label="Vocal Stress & Cadence Deceleration"
            valueDisplay={`${Math.round(weights.vocal_stress * 100)}%`}
            value={[weights.vocal_stress * 100]}
            max={100}
            step={5}
            onValueChange={([val]) => handleWeightChange('vocal_stress', val / 100)}
          />

          <Slider
            label="Manual User Flag Boost"
            valueDisplay={`${Math.round(weights.manual_override * 100)}%`}
            value={[weights.manual_override * 100]}
            max={100}
            step={5}
            onValueChange={([val]) => handleWeightChange('manual_override', val / 100)}
          />
        </div>

        <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-mono text-muted">
          <span>Cumulative Matrix Normalization</span>
          <span className="font-semibold text-accent">Sum: {Math.round(sumWeights * 100)}%</span>
        </div>
      </Card>

      {/* Live Preview on Sample Lecture */}
      <Card variant="raised" className="bg-surface/90 border-border/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="text-base font-semibold font-heading text-foreground">
              Live Preview: Operating Systems: Deadlocks Lecture
            </h3>
          </div>
          <Badge variant="outline" size="sm" className="font-mono">
            Interactive Scoring
          </Badge>
        </div>

        <p className="text-xs text-muted">
          See in real time how moving the confusion weight sliders above affects detection on real sample lecture segments:
        </p>

        <div className="space-y-3 pt-1">
          {sampleDeadlockSegments.map((seg) => {
            const score = computeScore(seg.signals);
            const color = confusionColor(score);
            const label = confusionLabel(score);

            return (
              <div
                key={seg.id}
                className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="font-semibold text-foreground">{seg.speaker}</span>
                    <span className="text-muted">[{seg.timestamp}]</span>
                    {seg.triggers.map((trig, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-raised text-muted border border-border/60">
                        {trig}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-foreground/85 leading-relaxed font-sans">
                    "{seg.text}"
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 font-mono">
                  <span
                    className="text-base font-bold transition-colors"
                    style={{ color }}
                  >
                    {Math.round(score * 100)}%
                  </span>
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
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
            );
          })}
        </div>
      </Card>

      {/* Ingestion & Pipeline Triggers */}
      <Card variant="raised" className="bg-surface/90 border-border/80 p-6 space-y-5">
        <h3 className="text-base font-semibold font-heading text-foreground">
          Pipeline Automation, Ingestion & Ephemeral Retention
        </h3>

        <div className="space-y-5">
          <Switch
            label="Demo Mode Simulation"
            description="Run offline simulations without requiring active live microphone streaming or live wearable hardware."
            checked={settings.demo_mode}
            onCheckedChange={(checked) => onChange({ demo_mode: checked })}
          />

          <Switch
            label="Auto-trigger Pipeline on Session End"
            description="Immediately execute Orchestrator, Detector, Content & Scheduler pipelines when lecture terminates."
            checked={settings.auto_trigger_pipeline}
            onCheckedChange={(checked) => onChange({ auto_trigger_pipeline: checked })}
          />

          <div className="pt-2">
            <Slider
              label="Ephemeral Memory TTL (Retention Window)"
              valueDisplay={`${settings.ephemeral_ttl_hours || 24} hours`}
              value={[settings.ephemeral_ttl_hours || 24]}
              min={1}
              max={168}
              step={1}
              onValueChange={([val]) => onChange({ ephemeral_ttl_hours: val })}
            />
          </div>

          <div className="pt-2">
            <Slider
              label="Audio Chunk Ingestion Length"
              valueDisplay={`${settings.chunk_interval_seconds} seconds`}
              value={[settings.chunk_interval_seconds]}
              min={10}
              max={60}
              step={5}
              onValueChange={([val]) => onChange({ chunk_interval_seconds: val })}
            />
          </div>

          <div className="pt-2">
            <Slider
              label="Session Silence Inactivity Timeout"
              valueDisplay={`${Math.floor(settings.timeout_seconds / 60)} minutes (${settings.timeout_seconds}s)`}
              value={[settings.timeout_seconds]}
              min={60}
              max={1800}
              step={60}
              onValueChange={([val]) => onChange({ timeout_seconds: val })}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
