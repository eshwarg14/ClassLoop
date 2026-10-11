import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function OnboardingChecklist() {
  const { onboarding, updateOnboarding, setDemoMode, setDemoPlaying } = useStore();

  if (onboarding.dismissed) return null;

  const items = [
    {
      id: 'omi',
      title: 'Configure Omi Audio Webhook',
      description: 'Connect wearable transcription stream to /api/transcripts/omi',
      done: onboarding.omiConnected,
      link: '/settings',
    },
    {
      id: 'qdrant',
      title: 'Verify Qdrant Vector DB',
      description: 'Ensure memory collections and lecture embeddings are active',
      done: onboarding.qdrantConnected,
      link: '/settings',
    },
    {
      id: 'lyzr',
      title: 'Check Lyzr Pipeline Agents',
      description: 'Orchestrator, Detector, Content & Scheduler pipeline',
      done: onboarding.lyzrConnected,
      link: '/settings',
    },
    {
      id: 'demo',
      title: 'Run Interactive Demo Replay',
      description: 'Simulate live stream with confusion detection in action',
      done: onboarding.demoCompleted,
      action: () => {
        setDemoMode(true);
        setDemoPlaying(true);
        updateOnboarding({ demoCompleted: true });
      },
    },
  ];

  const completedCount = items.filter((i) => i.done).length;

  return (
    <Card variant="raised" className="p-5 border-accent/30 bg-surface/90 relative overflow-hidden mb-6">
      <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold font-heading text-foreground">
              ClassLoop Observatory Onboarding
            </h3>
            <p className="text-xs text-muted">
              {completedCount} of {items.length} steps complete
            </p>
          </div>
        </div>

        <button
          onClick={() => updateOnboarding({ dismissed: true })}
          className="text-muted hover:text-foreground p-1 transition-colors"
          title="Dismiss checklist"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border/70 bg-surface/50 hover:bg-raised transition-colors"
          >
            {item.done ? (
              <CheckCircle2 className="w-4 h-4 text-confusion-calm shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-muted/60 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-foreground tracking-tight">{item.title}</h4>
              <p className="text-[11px] text-muted line-clamp-1 mt-0.5">{item.description}</p>
            </div>

            {item.link ? (
              <Link to={item.link}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ArrowRight className="w-3.5 h-3.5 text-muted hover:text-foreground" />
                </Button>
              </Link>
            ) : item.action ? (
              <Button variant="secondary" size="sm" onClick={item.action} className="h-7 px-2 text-[10px]">
                Start Demo
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
