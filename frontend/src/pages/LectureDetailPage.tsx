import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  HelpCircle,
  Calendar,
  Layers,
  ArrowLeft,
  Share2,
  Clock,
  Flame,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { HeatmapTimeline } from '@/components/lecture/HeatmapTimeline';
import { NotesView } from '@/components/notes/NotesView';
import { QuizView } from '@/components/quiz/QuizView';
import { ScheduleView } from '@/components/schedule/ScheduleView';
import { useLecture, useLectureNotes, useLectureQuiz, useLectureSchedule } from '@/hooks/useLecture';
import { useStore } from '@/hooks/useStore';
import { formatDuration, formatDate } from '@/lib/utils';
import type { TranscriptChunk, LectureNotes, LectureQuiz, RevisionEvent } from '@/lib/api';

export function LectureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState('notes');
  const [activeScrubberTime, setActiveScrubberTime] = useState<number>(0);

  const { liveTranscript } = useStore();
  const { data: lectureData } = useLecture(id);
  const { data: notesData } = useLectureNotes(id);
  const { data: quizData } = useLectureQuiz(id);
  const { data: scheduleData } = useLectureSchedule(id);

  // Prefer backend lecture chunks if available, then live store, then fallback demo data
  const backendChunks = (lectureData as unknown as { chunks?: TranscriptChunk[] })?.chunks;
  const fallbackChunks: TranscriptChunk[] =
    backendChunks && backendChunks.length > 0
      ? backendChunks
      : liveTranscript.length > 0
      ? liveTranscript
      : [
          {
            id: 'chunk-1',
            lecture_id: id || 'demo-1',
            chunk_index: 0,
            text: "Introduction to invariant subspaces and characteristic polynomials.",
            start_time: 0,
            end_time: 30,
            confusion_score: 0.15,
            reasons: [],
          },
          {
            id: 'chunk-2',
            lecture_id: id || 'demo-1',
            chunk_index: 1,
            text: "Student question regarding determinant vanishing conditions.",
            start_time: 30,
            end_time: 65,
            confusion_score: 0.55,
            reasons: ['Question', 'Pause'],
          },
          {
            id: 'chunk-3',
            lecture_id: id || 'demo-1',
            chunk_index: 2,
            text: "Defective matrices where algebraic multiplicity exceeds geometric multiplicity.",
            start_time: 65,
            end_time: 110,
            confusion_score: 0.88,
            reasons: ['Question', 'Rephrase'],
            is_flagged: true,
          },
          {
            id: 'chunk-4',
            lecture_id: id || 'demo-1',
            chunk_index: 3,
            text: "Jordan Canonical Form decomposition and generalized eigenvectors.",
            start_time: 110,
            end_time: 155,
            confusion_score: 0.65,
            reasons: ['Pause'],
          },
        ];

  const defaultNotes: LectureNotes = notesData || {
    lecture_id: id || 'demo-1',
    title: lectureData?.title || 'Linear Algebra: Eigenvalue Defect & Invariant Subspaces',
    created_at: new Date().toISOString(),
    markdown: `# Linear Algebra: Eigenvalue Defect & Invariant Subspaces

## Executive Summary
This lecture introduces **eigenvalues, eigenvectors**, and the critical edge cases where square matrices fail to possess a complete set of linearly independent eigenvectors, commonly called **defective matrices**.

---

## Core Principles

### 1. The Characteristic Equation
For any linear operator represented by matrix $A \\in \\mathbb{R}^{n \\times n}$:
\`\`\`
det(A - \\lambda I) = 0
\`\`\`
Roots of this polynomial define the eigenvalues $\\lambda_i$.

> **Explained simply**
> An eigenvector is a special arrow that does not change direction when the matrix transforms space; it only stretches or shrinks by the eigenvalue factor $\\lambda$.

---

## Confusing Concept Highlight: Defective Multiplicity

When the polynomial has repeated roots, two notions of multiplicity arise:
- **Algebraic Multiplicity (AM):** How many times $\\lambda$ appears as a root.
- **Geometric Multiplicity (GM):** The dimension of the nullspace $N(A - \\lambda I)$ (the actual number of independent eigenvectors).

> **Explained simply**
> If AM > GM, the matrix does not have enough independent directions to form a coordinate grid. You cannot diagonalize it with standard eigenvectors; you must use Jordan chains!

### 2. Jordan Canonical Form
When standard diagonalization is impossible, we construct generalized eigenvectors:
\`\`\`
(A - \\lambda I)^k v = 0
\`\`\`
This produces a block-diagonal Jordan matrix with 1s on the super-diagonal.

---

## Action Items for Revision
- Review 2x2 shear matrix examples.
- Compute the null space of $(A - 2I)$ for defect verification.
- Complete the 4-question active recall quiz below.
`,
  };

  const defaultQuiz: LectureQuiz = quizData || {
    lecture_id: id || 'demo-1',
    title: 'Active Recall: Defective Matrices & Multiplicity',
    created_at: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        question: 'What mathematical condition defines an n x n matrix as "defective"?',
        options: [
          'Its determinant is equal to zero',
          'It has fewer than n linearly independent eigenvectors',
          'All of its eigenvalues are complex numbers',
          'Its trace is greater than its rank',
        ],
        correct_index: 1,
        explanation: 'A matrix is defective if its geometric multiplicity is strictly less than its algebraic multiplicity for at least one eigenvalue, leaving fewer than n independent eigenvectors.',
        citation_chunk_id: 'chunk-3',
      },
      {
        id: 'q2',
        question: 'What is the relationship between algebraic multiplicity (AM) and geometric multiplicity (GM)?',
        options: [
          'GM is always strictly greater than AM',
          'AM and GM are completely independent unrelated integers',
          '1 <= GM <= AM for any eigenvalue',
          'GM + AM always equals n',
        ],
        correct_index: 2,
        explanation: 'For any eigenvalue, the geometric multiplicity is at least 1 and cannot exceed the algebraic multiplicity (1 <= GM <= AM).',
        citation_chunk_id: 'chunk-3',
      },
      {
        id: 'q3',
        question: 'If an n x n matrix cannot be diagonalized, what is the closest canonical form it can be transformed into?',
        options: [
          'Hessenberg matrix form',
          'Jordan canonical form',
          'Vandermonde form',
          'Singular value threshold form',
        ],
        correct_index: 1,
        explanation: 'Every square matrix over algebraically closed fields is similar to a block-diagonal Jordan canonical form.',
        citation_chunk_id: 'chunk-4',
      },
      {
        id: 'q4',
        question: 'Why does det(A - lambda * I) = 0 need to hold for an eigenvector to exist?',
        options: [
          'Because the system (A - lambda * I)x = 0 must have a non-trivial nullspace',
          'Because all eigenvalues must be invertible',
          'Because the trace of A must cancel with lambda',
          'To satisfy the Cauchy-Schwarz inequality',
        ],
        correct_index: 0,
        explanation: 'For a nonzero vector x to satisfy (A - lambda * I)x = 0, the operator must not be invertible, which requires its determinant to vanish.',
        citation_chunk_id: 'chunk-2',
      },
    ],
  };

  const defaultSchedule: RevisionEvent[] = scheduleData && scheduleData.length > 0 ? scheduleData : [
    {
      id: 'rev-1',
      lecture_id: id || 'demo-1',
      lecture_title: lectureData?.title || 'Linear Algebra: Eigenvalue Defect',
      interval_day: 1,
      scheduled_date: new Date(Date.now() + 86400000).toISOString(),
      status: 'pending',
      priority: 'high',
    },
    {
      id: 'rev-3',
      lecture_id: id || 'demo-1',
      lecture_title: lectureData?.title || 'Linear Algebra: Eigenvalue Defect',
      interval_day: 3,
      scheduled_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      status: 'pending',
      priority: 'medium',
    },
    {
      id: 'rev-7',
      lecture_id: id || 'demo-1',
      lecture_title: lectureData?.title || 'Linear Algebra: Eigenvalue Defect',
      interval_day: 7,
      scheduled_date: new Date(Date.now() + 86400000 * 7).toISOString(),
      status: 'pending',
      priority: 'low',
    },
  ];

  const meanConfusionPct = lectureData?.mean_confusion !== undefined
    ? Math.round(lectureData.mean_confusion * 100)
    : 28;
  const peakConfusionPct = lectureData?.peak_confusion !== undefined
    ? Math.round(lectureData.peak_confusion * 100)
    : 88;
  const flaggedCount = lectureData?.flagged_count !== undefined
    ? lectureData.flagged_count
    : fallbackChunks.filter((c) => c.is_flagged || c.confusion_score >= 0.7).length;
  const totalDuration = lectureData?.duration || 155;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/library')} className="self-start">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to Library</span>
        </Button>

        <div className="flex items-center gap-2">
          <Badge variant="outline" size="sm" className="font-mono">
            {formatDate(lectureData?.created_at || new Date())}
          </Badge>
          <Badge variant="calm" size="sm" className="font-mono">
            Processed & Ready
          </Badge>
        </div>
      </div>

      {/* Lecture Title & Quick Stats */}
      <div className="p-6 rounded-2xl bg-surface/80 border border-border backdrop-blur-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-heading text-foreground">
              {lectureData?.title || defaultNotes.title}
            </h1>
            <p className="text-xs text-muted font-mono mt-1">
              Subject: {lectureData?.subject || 'Computer Science & Mathematics'} | Duration: {formatDuration(totalDuration)} | Flagged Segments: {flaggedCount}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-raised border border-border text-center">
              <span className="block text-xs font-mono text-muted">Mean Confusion</span>
              <span className="text-sm font-bold font-mono text-confusion-calm">{meanConfusionPct}%</span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-raised border border-border text-center">
              <span className="block text-xs font-mono text-muted">Peak Spike</span>
              <span className="text-sm font-bold font-mono text-confusion-danger">{peakConfusionPct}%</span>
            </div>
          </div>
        </div>

        {/* Heatmap timeline scrubber */}
        <div className="pt-2">
          <HeatmapTimeline
            chunks={fallbackChunks}
            currentTime={activeScrubberTime}
            duration={totalDuration}
            onSelectChunk={(c) => setActiveScrubberTime(c.start_time)}
          />
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid grid-cols-4 max-w-lg mb-4">
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </TabsTrigger>
          <TabsTrigger value="quiz" className="gap-2">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Quiz</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Revision</span>
          </TabsTrigger>
          <TabsTrigger value="related" className="gap-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Related</span>
          </TabsTrigger>
        </TabsList>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <NotesView notes={defaultNotes} />
        </TabsContent>

        {/* Quiz Tab */}
        <TabsContent value="quiz">
          <QuizView quiz={defaultQuiz} onCitationClick={(chunkId) => console.log('Jump to chunk', chunkId)} />
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule">
          <ScheduleView events={defaultSchedule} lectureTitle={defaultNotes.title} />
        </TabsContent>

        {/* Related Knowledge Tab */}
        <TabsContent value="related">
          <Card variant="raised" className="p-6 bg-surface/90 border-border/80 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent" />
              <h3 className="text-base font-semibold font-heading text-foreground">
                Cross-Lecture Vector Associations
              </h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Qdrant embeddings connected this lecture to related prerequisite and advanced topics:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-raised border border-border/70 hover:border-accent/40 transition-colors cursor-pointer">
                <div className="flex items-center justify-between text-xs font-mono text-accent mb-1">
                  <span>Prerequisite Concept (92% Match)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground font-heading">
                  Process Synchronization, Mutexes & Semaphores
                </h4>
                <p className="text-xs text-muted mt-1">
                  Recorded earlier in course: Foundational principles for mutual exclusion and critical sections.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-raised border border-border/70 hover:border-accent/40 transition-colors cursor-pointer">
                <div className="flex items-center justify-between text-xs font-mono text-secondary mb-1">
                  <span>Follow-Up Application (87% Match)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground font-heading">
                  Distributed Transactions & Two-Phase Locking
                </h4>
                <p className="text-xs text-muted mt-1">
                  Applying wait-for graph cycle detection and Banker safety checks to distributed databases.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
