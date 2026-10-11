import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Award, RotateCcw, ArrowRight, ArrowLeft, ExternalLink, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import type { LectureQuiz } from '@/lib/api';

interface QuizViewProps {
  quiz: LectureQuiz;
  onCitationClick?: (chunkId: string) => void;
  className?: string;
}

export function QuizView({ quiz, onCitationClick, className }: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const questions = quiz.questions || [];
  const currentQuestion = questions[currentIndex];
  const selectedOption = userAnswers[currentIndex];
  const isAnswered = selectedOption !== undefined;

  const handleSelectOption = (optionIndex: number) => {
    if (isAnswered) return; // Cannot change answer after submission
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setUserAnswers({});
    setCurrentIndex(0);
    setIsCompleted(false);
  };

  // Compute final score
  const correctCount = questions.reduce((acc, q, idx) => {
    return userAnswers[idx] === q.correct_index ? acc + 1 : acc;
  }, 0);
  const scorePercent = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

  if (questions.length === 0) {
    return (
      <Card variant="raised" className="p-8 text-center bg-surface/80">
        <HelpCircle className="w-8 h-8 text-muted mx-auto mb-2" />
        <h3 className="text-sm font-semibold font-heading text-foreground">No Quiz Questions Available</h3>
        <p className="text-xs text-muted mt-1">The Content Agent has not generated review questions for this lecture yet.</p>
      </Card>
    );
  }

  if (isCompleted) {
    return (
      <Card variant="raised" className={`p-8 max-w-xl mx-auto text-center space-y-6 bg-surface/90 ${className || ''}`}>
        <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 text-accent flex items-center justify-center mx-auto shadow-glow-sm">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h3 className="text-xl font-bold font-heading text-foreground">Quiz Completed!</h3>
          <p className="text-xs text-muted mt-1">Here is how well you mastered this lecture's core concepts:</p>
        </div>

        <div className="p-6 rounded-2xl bg-raised border border-border/80 flex items-center justify-around">
          <div>
            <span className="block text-3xl font-bold font-mono text-accent">{scorePercent}%</span>
            <span className="text-xs text-muted uppercase font-mono">Accuracy</span>
          </div>
          <div className="w-px h-10 bg-border" />
          <div>
            <span className="block text-3xl font-bold font-mono text-foreground">
              {correctCount} / {questions.length}
            </span>
            <span className="text-xs text-muted uppercase font-mono">Score</span>
          </div>
        </div>

        <Button variant="secondary" onClick={handleRestart} className="w-full">
          <RotateCcw className="w-4 h-4 mr-2" />
          Retake Active Recall Quiz
        </Button>
      </Card>
    );
  }

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className || ''}`}>
      {/* Header and Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-muted">
          <span>Question {currentIndex + 1} of {questions.length}</span>
          <span>{Math.round(progressPercent)}% Completed</span>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Question Card */}
      <Card variant="raised" className="p-6 md:p-8 bg-surface/90 space-y-6">
        <h4 className="text-base font-semibold font-heading text-foreground leading-snug">
          {currentQuestion.question}
        </h4>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((opt, optIdx) => {
            const isSelected = selectedOption === optIdx;
            const isCorrect = optIdx === currentQuestion.correct_index;
            let btnStyle = 'border-border bg-surface hover:bg-raised text-foreground/90';

            if (isAnswered) {
              if (isCorrect) {
                btnStyle = 'border-confusion-calm bg-confusion-calm/15 text-confusion-calm font-medium';
              } else if (isSelected) {
                btnStyle = 'border-confusion-danger bg-confusion-danger/15 text-confusion-danger font-medium';
              } else {
                btnStyle = 'border-border/40 opacity-50 text-muted';
              }
            }

            return (
              <button
                key={optIdx}
                onClick={() => handleSelectOption(optIdx)}
                disabled={isAnswered}
                className={`w-full p-4 rounded-xl border text-left text-xs md:text-sm transition-all flex items-start justify-between gap-3 ${btnStyle}`}
              >
                <span>{opt}</span>
                {isAnswered && isCorrect && (
                  <CheckCircle2 className="w-4 h-4 text-confusion-calm shrink-0 mt-0.5" />
                )}
                {isAnswered && isSelected && !isCorrect && (
                  <XCircle className="w-4 h-4 text-confusion-danger shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation & Citation (revealed when answered) */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-xl bg-raised border border-border/70 space-y-2 text-xs"
            >
              <div className="font-semibold text-foreground font-heading flex items-center justify-between">
                <span>Explanation</span>
                {currentQuestion.citation_chunk_id && (
                  <button
                    onClick={() => onCitationClick?.(currentQuestion.citation_chunk_id!)}
                    className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px]"
                  >
                    <span>View Transcript Citation</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-muted leading-relaxed">{currentQuestion.explanation}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleNext}
            disabled={!isAnswered}
          >
            <span>{currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
