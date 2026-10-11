import { Moon, Sun, Search, Radio, Compass, HelpCircle } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useStore } from '@/hooks/useStore';
import { ConnectionIndicator } from '@/components/shared/ConnectionIndicator';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
}

export function Header({ onOpenCommandPalette, onOpenShortcuts }: HeaderProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { isSessionActive, sessionDuration } = useStore();

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-glow-sm">
          <Compass className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-base tracking-tight text-foreground">
              ClassLoop
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30 font-semibold tracking-wider">
              Observatory
            </span>
          </div>
        </div>

        {/* Live indicator if session is running */}
        {isSessionActive && (
          <div className="ml-4 hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-confusion-danger/15 border border-confusion-danger/30 text-confusion-danger text-xs font-mono font-medium animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            <span>SESSION LIVE ({Math.floor(sessionDuration / 60)}m)</span>
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        <ConnectionIndicator />

        {/* Command palette search trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-raised hover:bg-raised/80 text-muted hover:text-foreground text-xs transition-colors"
          title="Search commands and navigate"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick Find</span>
          <kbd className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-border/80 font-mono text-muted">
            {isMac ? 'Cmd+K' : 'Ctrl+K'}
          </kbd>
        </button>

        {/* Keyboard shortcuts helper */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          className="text-muted hover:text-foreground"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
          className="text-muted hover:text-foreground"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-warning" />
          ) : (
            <Moon className="w-4 h-4 text-accent" />
          )}
        </Button>
      </div>
    </header>
  );
}
