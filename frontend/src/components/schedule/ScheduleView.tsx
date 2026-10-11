import { Download, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RevisionCalendar } from './RevisionCalendar';
import { formatDate } from '@/lib/utils';
import type { RevisionEvent } from '@/lib/api';

interface ScheduleViewProps {
  events: RevisionEvent[];
  lectureTitle: string;
  className?: string;
}

export function ScheduleView({ events, lectureTitle, className }: ScheduleViewProps) {
  const handleDownloadICS = () => {
    // Generate valid RFC-5545 iCalendar content
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ClassLoop//Observatory Study Intelligence//EN',
      'CALSCALE:GREGORIAN',
    ];

    events.forEach((evt) => {
      const dt = new Date(evt.scheduled_date);
      const dtStr = dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:${evt.id}@classloop.local`,
        `DTSTAMP:${dtStr}`,
        `DTSTART:${dtStr}`,
        `SUMMARY:ClassLoop Review: ${evt.lecture_title} (Day +${evt.interval_day})`,
        `DESCRIPTION:Automated spaced repetition session for ${evt.lecture_title}. Focus on flagged concepts and active recall quiz.`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${lectureTitle.toLowerCase().replace(/\s+/g, '_')}_schedule.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getPriorityBadge = (priority: RevisionEvent['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge variant="danger" size="sm">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning" size="sm">Medium</Badge>;
      case 'low':
      default:
        return <Badge variant="default" size="sm">Normal</Badge>;
    }
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Top action header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold font-heading text-foreground">
            Spaced Repetition Schedule
          </h3>
          <p className="text-xs text-muted">
            Optimized memory retention intervals: Day 1, Day 3, and Day 7 reviews.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={handleDownloadICS}>
          <Download className="w-4 h-4 mr-1.5" />
          <span>Export .ics Calendar</span>
        </Button>
      </div>

      {/* Calendar Grid View */}
      <Card variant="raised" className="p-5 bg-surface/90">
        <RevisionCalendar events={events} />
      </Card>

      {/* Structured Events List */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">
          Upcoming Review Milestones
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {events.map((evt) => (
            <Card key={evt.id} variant="surface" className="p-4 space-y-3 border-border/80">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-foreground">
                  Day +{evt.interval_day} Interval
                </span>
                {getPriorityBadge(evt.priority)}
              </div>

              <div className="text-xs font-mono text-muted flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span>{formatDate(evt.scheduled_date)}</span>
              </div>

              <p className="text-xs text-muted/80 leading-relaxed">
                {evt.interval_day === 1
                  ? 'Immediate consolidation review: reinforce neural pathways within 24 hours.'
                  : evt.interval_day === 3
                  ? 'Intermediate recall check: test memory decay and retake quiz.'
                  : 'Long-term storage anchor: transfer concepts into permanent semantic memory.'}
              </p>

              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono">
                <span className="text-muted">Status</span>
                <span className="capitalize text-foreground font-semibold flex items-center gap-1">
                  {evt.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-confusion-calm" />}
                  {evt.status === 'pending' && <Clock className="w-3 h-3 text-accent" />}
                  {evt.status === 'overdue' && <AlertCircle className="w-3 h-3 text-confusion-danger" />}
                  {evt.status}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
