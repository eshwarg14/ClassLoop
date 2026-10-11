import { useStore } from '@/hooks/useStore';
import { cn } from '@/lib/utils';

export function ConnectionIndicator() {
  const connectionStatus = useStore((s) => s.connectionStatus);

  const statusConfig = {
    connected: {
      color: 'bg-confusion-calm',
      pulse: 'shadow-glow-calm',
      label: 'Live Stream Active',
    },
    connecting: {
      color: 'bg-confusion-warning animate-pulse',
      pulse: 'shadow-glow-warning',
      label: 'Reconnecting...',
    },
    disconnected: {
      color: 'bg-muted/40',
      pulse: '',
      label: 'Disconnected',
    },
    error: {
      color: 'bg-confusion-danger',
      pulse: 'shadow-glow-danger',
      label: 'Connection Error',
    },
  };

  const current = statusConfig[connectionStatus] || statusConfig.disconnected;

  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface border border-border text-xs font-mono"
      title={`Stream Status: ${current.label}`}
    >
      <span className={cn('w-2 h-2 rounded-full', current.color, current.pulse)} />
      <span className="text-[11px] text-muted hidden sm:inline">{current.label}</span>
    </div>
  );
}
