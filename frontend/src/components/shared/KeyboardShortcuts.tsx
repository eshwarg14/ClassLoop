import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkConfusing?: () => void;
  onOpenCommandPalette: () => void;
}

export function KeyboardShortcuts({
  open,
  onOpenChange,
  onMarkConfusing,
  onOpenCommandPalette,
}: KeyboardShortcutsProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside an input, textarea or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // '?' for shortcuts dialog
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onOpenChange(true);
        return;
      }

      // 'm' or 'M' for mark confusing
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onMarkConfusing?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette, onOpenChange, onMarkConfusing]);

  const shortcuts = [
    { key: 'Cmd / Ctrl + K', description: 'Open Quick Find Command Palette' },
    { key: 'M', description: 'Flag currently active segment as confusing' },
    { key: '?', description: 'Open Keyboard Shortcuts helper' },
    { key: 'Esc', description: 'Close any active modal dialog' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quickly navigate and control ClassLoop Observatory from your keyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
            >
              <span className="text-xs text-foreground/80">{sc.description}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-raised border border-border text-foreground shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
