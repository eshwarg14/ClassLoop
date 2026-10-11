import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, BookOpen, Clock, Flame, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDuration, formatDate, confusionColor } from '@/lib/utils';
import { useLectures } from '@/hooks/useLecture';
import type { Lecture } from '@/lib/api';

const defaultLibraryLectures: Lecture[] = [
  {
    id: 'demo-lecture-1',
    title: 'Linear Algebra: Eigenvalue Defect & Invariant Subspaces',
    subject: 'Mathematics 204',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    duration: 155,
    status: 'ready',
    mean_confusion: 0.28,
    peak_confusion: 0.88,
    confusion_trend: [0.12, 0.18, 0.58, 0.44, 0.78, 0.88, 0.72, 0.65],
    flagged_count: 1,
    visibility: 'private',
    summary: 'Explores defective matrices where algebraic multiplicity exceeds geometric multiplicity, leading to Jordan canonical forms.',
  },
  {
    id: 'lec-102',
    title: 'Thermodynamics: Entropy & Carnot Efficiency Limits',
    subject: 'Physics 180',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    duration: 3200,
    status: 'ready',
    mean_confusion: 0.42,
    peak_confusion: 0.74,
    confusion_trend: [0.2, 0.35, 0.45, 0.6, 0.74, 0.55, 0.4, 0.3],
    flagged_count: 3,
    visibility: 'class',
    summary: 'Derives the maximum theoretical work obtainable from reversible heat engines and introduces microscopic statistical entropy.',
  },
  {
    id: 'lec-103',
    title: 'Algorithms: Red-Black Tree Balancing Invariants',
    subject: 'Computer Science 201',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    duration: 2900,
    status: 'ready',
    mean_confusion: 0.62,
    peak_confusion: 0.92,
    confusion_trend: [0.3, 0.45, 0.65, 0.85, 0.92, 0.7, 0.6, 0.5],
    flagged_count: 5,
    visibility: 'private',
    summary: 'Analyzes tree rotations, color flipping rules, and proof of O(log n) worst-case height bounds for self-balancing search trees.',
  },
];

export function LibraryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'active'>('all');

  const { data: apiLectures } = useLectures();

  // Combine api lectures or fallback to default library list
  const lectures: Lecture[] = (apiLectures && apiLectures.length > 0) ? apiLectures : defaultLibraryLectures;

  const filteredLectures = lectures.filter((lec) => {
    const matchesSearch =
      lec.title.toLowerCase().includes(search.toLowerCase()) ||
      (lec.subject && lec.subject.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = statusFilter === 'all' || lec.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface/80 border border-border">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            <h1 className="text-base font-bold font-heading text-foreground">
              Lecture Knowledge Library
            </h1>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Archived sessions, synthesized Obsidian notes, active recall quizzes, and confusion heatmaps.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => navigate('/')}>
          <Sparkles className="w-4 h-4 mr-1.5" />
          <span>Start New Session</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lectures by title or subject..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border text-xs font-mono w-full sm:w-auto justify-end">
          {(['all', 'ready', 'active'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                statusFilter === filter
                  ? 'bg-raised text-foreground font-semibold shadow-sm'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {filter === 'all' ? 'All Lectures' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Lectures Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredLectures.map((lecture) => {
          const meanColor = confusionColor(lecture.mean_confusion);

          return (
            <Card
              key={lecture.id}
              variant="raised"
              className="flex flex-col justify-between hover:border-accent/40 transition-all group bg-surface/90 cursor-pointer"
              onClick={() => navigate(`/lectures/${lecture.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between text-xs font-mono text-muted mb-1.5">
                  <span className="text-accent font-semibold">{lecture.subject || 'General'}</span>
                  <span>{formatDate(lecture.created_at)}</span>
                </div>
                <CardTitle className="text-base group-hover:text-accent transition-colors line-clamp-1">
                  {lecture.title}
                </CardTitle>
                <CardDescription className="line-clamp-2 mt-1">
                  {lecture.summary || 'Synthesized lecture notes, active recall questions, and spaced reviews.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                {/* Mini Heatmap Strip */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                    <span>Confusion Map</span>
                    <span style={{ color: meanColor }}>
                      Avg: {Math.round(lecture.mean_confusion * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-raised rounded-full overflow-hidden flex gap-[1px] p-[1px]">
                    {(lecture.confusion_trend || [0.1, 0.2, 0.4, 0.6, 0.8, 0.5, 0.3]).map((score, i) => (
                      <div
                        key={i}
                        className="h-full flex-1 rounded-[1px]"
                        style={{ backgroundColor: confusionColor(score) }}
                      />
                    ))}
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                  <div className="p-2 rounded-lg bg-raised border border-border/60">
                    <span className="text-[10px] text-muted block">Duration</span>
                    <span className="font-semibold text-foreground">
                      {formatDuration(lecture.duration || 120)}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-raised border border-border/60">
                    <span className="text-[10px] text-muted block">Peak Spike</span>
                    <span className="font-semibold text-confusion-danger">
                      {Math.round(lecture.peak_confusion * 100)}%
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-raised border border-border/60">
                    <span className="text-[10px] text-muted block">Flags</span>
                    <span className="font-semibold text-warning">
                      {lecture.flagged_count}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-between pt-3 border-t border-border/50">
                <Badge variant={lecture.status === 'ready' ? 'calm' : 'default'} size="sm">
                  {lecture.status.toUpperCase()}
                </Badge>

                <span className="text-xs text-accent flex items-center gap-1 font-mono font-medium group-hover:translate-x-1 transition-transform">
                  View Review <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
