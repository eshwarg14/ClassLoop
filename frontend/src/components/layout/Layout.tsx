import * as React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { KeyboardShortcuts } from '@/components/shared/KeyboardShortcuts';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useStore } from '@/hooks/useStore';
import { useToast } from '@/components/ui/Toast';

export function Layout() {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const { liveTranscript, markChunkFlagged, isSessionActive } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleMarkConfusing = React.useCallback(() => {
    if (!isSessionActive || liveTranscript.length === 0) {
      toast.info('No Active Session', 'Start or replay a lecture before marking confusion.');
      return;
    }
    const latest = liveTranscript[liveTranscript.length - 1];
    if (latest) {
      markChunkFlagged(latest.id);
      toast.warning('Segment Flagged', 'Marked timestamp as confusing. Highlighted for autonomous pipeline.');
    }
  }, [isSessionActive, liveTranscript, markChunkFlagged, toast]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-accent/25">
      {/* Top Header */}
      <Header
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Main Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Global Keyboard Shortcuts Dialog & Listener */}
      <KeyboardShortcuts
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onMarkConfusing={handleMarkConfusing}
      />
    </div>
  );
}
