import { NavLink } from 'react-router-dom';
import { Radio, Library, MessageSquareCode, ShieldCheck, Settings, GitFork } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks/useStore';

export function Sidebar() {
  const isSessionActive = useStore((s) => s.isSessionActive);

  const navItems = [
    {
      to: '/',
      label: 'Live Stream',
      icon: Radio,
      badge: isSessionActive ? 'LIVE' : undefined,
    },
    {
      to: '/pipeline',
      label: 'Pipeline Flow',
      icon: GitFork,
    },
    {
      to: '/library',
      label: 'Lecture Library',
      icon: Library,
    },
    {
      to: '/ask',
      label: 'Ask Intel',
      icon: MessageSquareCode,
    },
    {
      to: '/privacy',
      label: 'Privacy Vault',
      icon: ShieldCheck,
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-16 md:w-56 border-r border-border bg-surface/50 backdrop-blur-sm flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
      <div className="py-4 space-y-1 px-2 md:px-3">
        <div className="hidden md:block px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-muted font-semibold">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative',
                  isActive
                    ? 'bg-accent/15 text-accent font-semibold border border-accent/30 shadow-sm'
                    : 'text-muted hover:text-foreground hover:bg-raised'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                      isActive ? 'text-accent' : 'text-muted group-hover:text-foreground',
                      item.badge === 'LIVE' && 'text-confusion-danger animate-pulse'
                    )}
                  />
                  <span className="hidden md:inline truncate">{item.label}</span>

                  {item.badge && (
                    <span className="hidden md:inline ml-auto text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-confusion-danger/20 text-confusion-danger border border-confusion-danger/40 animate-pulse font-bold">
                      {item.badge}
                    </span>
                  )}

                  {/* Mobile tooltip dot */}
                  {isActive && (
                    <span className="md:hidden absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 border-t border-border/60 text-center md:text-left">
        <div className="hidden md:block text-[11px] text-muted/70 font-mono">
          ClassLoop v0.1
        </div>
        <div className="text-[9px] text-muted/50 font-mono truncate hidden md:block">
          Autonomous Intel
        </div>
      </div>
    </aside>
  );
}
