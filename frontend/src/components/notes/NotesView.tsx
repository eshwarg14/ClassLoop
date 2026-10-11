import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, Copy, Check, Lightbulb, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { LectureNotes } from '@/lib/api';

interface NotesViewProps {
  notes: LectureNotes;
  className?: string;
}

export function NotesView({ notes, className }: NotesViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(notes.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([notes.markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${notes.title.toLowerCase().replace(/\s+/g, '_')}_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Top action toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-accent" />
          <h3 className="text-base font-semibold font-heading text-foreground">
            Synthesized Obsidian Notes
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 text-confusion-calm" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy MD'}</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            <span>Download .md</span>
          </Button>
        </div>
      </div>

      {/* Structured markdown card */}
      <Card variant="raised" className="p-6 md:p-8 space-y-6 bg-surface/90">
        <div className="prose prose-invert max-w-none text-foreground text-sm leading-relaxed">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-xl md:text-2xl font-bold font-heading text-foreground mb-4 pb-2 border-b border-border">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold font-heading text-foreground mt-6 mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-accent inline-block" />
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-semibold font-heading text-foreground/90 mt-4 mb-2">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="mb-3 text-foreground/80 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-foreground/80">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-foreground/80">{children}</ol>,
              li: ({ children }) => <li className="text-foreground/85">{children}</li>,
              blockquote: ({ children }) => {
                // Check if this blockquote is an "Explained simply" callout
                return (
                  <div className="my-4 p-4 rounded-xl border border-accent/40 bg-accent/10 relative overflow-hidden">
                    <div className="flex items-center gap-2 text-xs font-semibold font-heading text-accent mb-1.5">
                      <Lightbulb className="w-4 h-4 text-accent" />
                      <span>EXPLAINED SIMPLY</span>
                    </div>
                    <div className="text-xs text-foreground/90 italic leading-relaxed">
                      {children}
                    </div>
                  </div>
                );
              },
              code: ({ children }) => (
                <code className="px-1.5 py-0.5 rounded bg-raised border border-border/80 font-mono text-xs text-accent">
                  {children}
                </code>
              ),
            }}
          >
            {notes.markdown}
          </ReactMarkdown>
        </div>
      </Card>
    </div>
  );
}
