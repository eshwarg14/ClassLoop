import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Radio,
  Library,
  MessageSquareCode,
  ShieldCheck,
  Settings,
  GitFork,
  Moon,
  Sun,
  Flame,
  Search,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useStore } from '@/hooks/useStore';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/Dialog';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const { isSessionActive, markChunkFlagged, liveTranscript } = useStore();

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay />
      <DialogContent className="p-0 overflow-hidden max-w-lg bg-surface border border-border rounded-xl shadow-2xl">
        <Command className="flex h-full w-full flex-col overflow-hidden rounded-xl bg-surface text-foreground font-sans">
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted" />
            <Command.Input
              placeholder="Search views, actions, or shortcuts..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 text-foreground font-sans"
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-xs text-muted">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-[10px] font-mono uppercase text-muted px-2 py-1.5">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/'))}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <Radio className="h-4 w-4 text-accent" />
                <span>Live Lecture Observatory</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/pipeline'))}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <GitFork className="h-4 w-4 text-accent" />
                <span>Pipeline Agent Flow</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/library'))}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <Library className="h-4 w-4 text-accent" />
                <span>Lecture Library</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/ask'))}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <MessageSquareCode className="h-4 w-4 text-accent" />
                <span>Ask Study Intelligence</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/privacy'))}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>Privacy & Memory Vault</span>
              </Command.Item>

              <Command.Item
                onSelect={() => runCommand(() => navigate('/settings'))}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <Settings className="h-4 w-4 text-accent" />
                <span>Settings & Integrations</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Session Actions" className="text-[10px] font-mono uppercase text-muted px-2 py-1.5 mt-2">
              {isSessionActive && liveTranscript.length > 0 && (
                <Command.Item
                  onSelect={() =>
                    runCommand(() => {
                      const latest = liveTranscript[liveTranscript.length - 1];
                      if (latest) markChunkFlagged(latest.id);
                    })
                  }
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-confusion-danger hover:bg-confusion-danger/10 cursor-pointer transition-colors"
                >
                  <Flame className="h-4 w-4 text-confusion-danger" />
                  <span>Flag Current Segment as Confusing (M)</span>
                </Command.Item>
              )}

              <Command.Item
                onSelect={() => runCommand(() => toggleTheme())}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-raised cursor-pointer transition-colors"
              >
                <Sun className="h-4 w-4 text-warning" />
                <span>Toggle Theme Mode (Light / Dark)</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
