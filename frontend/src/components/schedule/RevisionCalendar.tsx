import { useMemo } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { RevisionEvent } from '@/lib/api';

interface RevisionCalendarProps {
  events: RevisionEvent[];
  startDate?: Date;
  className?: string;
}

export function RevisionCalendar({ events, startDate = new Date(), className }: RevisionCalendarProps) {
  // Generate a 14-day timeline view
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-muted flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-accent" />
          <span>14-Day Spaced Repetition Horizon</span>
        </h4>
        <div className="flex items-center gap-3 text-[11px] font-mono text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-confusion-calm" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> Scheduled</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-confusion-danger" /> Overdue</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
        {days.map((day, idx) => {
          const isToday = isSameDay(day, new Date());
          const dayEvents = events.filter((e) => isSameDay(new Date(e.scheduled_date), day));

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex flex-col justify-between min-h-[95px] transition-all ${
                isToday
                  ? 'border-accent/60 bg-accent/5 ring-1 ring-accent/30'
                  : 'border-border bg-surface/60 hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={`font-mono ${isToday ? 'font-bold text-accent' : 'text-muted'}`}>
                  {format(day, 'EEE')}
                </span>
                <span className={`font-mono text-[11px] ${isToday ? 'font-bold text-foreground' : 'text-muted/70'}`}>
                  {format(day, 'd MMM')}
                </span>
              </div>

              <div className="space-y-1.5 mt-2">
                {dayEvents.map((evt) => {
                  const isDone = evt.status === 'completed';
                  const isOverdue = evt.status === 'overdue';

                  return (
                    <div
                      key={evt.id}
                      className={`p-1.5 rounded-lg border text-[10px] font-mono flex items-center justify-between gap-1 ${
                        isDone
                          ? 'bg-confusion-calm/10 border-confusion-calm/30 text-confusion-calm'
                          : isOverdue
                          ? 'bg-confusion-danger/10 border-confusion-danger/30 text-confusion-danger'
                          : 'bg-accent/10 border-accent/30 text-accent'
                      }`}
                      title={`${evt.lecture_title} - Day +${evt.interval_day} Review`}
                    >
                      <span className="truncate font-semibold">Day +{evt.interval_day}</span>
                      {isDone ? (
                        <CheckCircle2 className="w-3 h-3 text-confusion-calm shrink-0" />
                      ) : (
                        <Clock className="w-3 h-3 shrink-0" />
                      )}
                    </div>
                  );
                })}

                {dayEvents.length === 0 && (
                  <div className="text-[10px] font-mono text-muted/30 text-center py-2">
                    Idle
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
