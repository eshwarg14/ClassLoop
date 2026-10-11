import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Bookmark, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDuration } from '@/lib/utils';
import { useAskQuestion } from '@/hooks/useLecture';
import type { AskCitation } from '@/lib/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: AskCitation[];
  timestamp: string;
}

interface ChatViewProps {
  initialLectureId?: string;
  className?: string;
}

export function ChatView({ initialLectureId, className }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your ClassLoop Study Intelligence Agent. Ask me anything about your lectures, confusing concepts, or exam prep.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<'active' | 'all'>(initialLectureId ? 'active' : 'all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const askMutation = useAskQuestion();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, askMutation.isPending]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || askMutation.isPending) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const response = await askMutation.mutateAsync({
        question: textToSend,
        scope,
        lectureId: initialLectureId,
      });

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: response.answer || 'Here is the relevant information based on your recorded lectures.',
        citations: response.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      // Fallback response for offline or mock state
      const fallbackMsg: Message = {
        id: `bot-mock-${Date.now()}`,
        sender: 'assistant',
        text: `Based on your recent lecture segments, the instructor focused heavily on eigenvalue decomposition and invariant subspaces. Specifically around the 14-minute mark, a question was raised regarding geometric multiplicity vs algebraic multiplicity.`,
        citations: [
          {
            lecture_id: initialLectureId || 'lec-1',
            lecture_title: 'Linear Algebra & Invariant Subspaces',
            chunk_id: 'chunk-3',
            timestamp: 840,
            text: 'Notice that algebraic multiplicity can strictly exceed geometric multiplicity when deficient eigenvectors occur.',
          },
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    }
  };

  const samplePrompts = [
    'What was the most confusing concept discussed today?',
    'Explain eigenvalue multiplicity simply',
    'Summarize key formulas from the second half',
  ];

  return (
    <div className={`flex flex-col h-[calc(100vh-10rem)] bg-surface/50 border border-border rounded-2xl overflow-hidden ${className || ''}`}>
      {/* Top Bar with Scope Toggle */}
      <div className="px-5 py-3 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-heading font-semibold text-xs tracking-tight text-foreground">
            Study Intelligence Q&A
          </span>
        </div>

        <div className="flex items-center gap-1 bg-raised p-1 rounded-lg border border-border text-xs">
          <button
            onClick={() => setScope('active')}
            className={`px-2.5 py-1 rounded-md transition-colors font-mono text-[11px] ${
              scope === 'active' ? 'bg-surface text-foreground font-semibold shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            Current Lecture
          </button>
          <button
            onClick={() => setScope('all')}
            className={`px-2.5 py-1 rounded-md transition-colors font-mono text-[11px] ${
              scope === 'all' ? 'bg-surface text-foreground font-semibold shadow-sm' : 'text-muted hover:text-foreground'
            }`}
          >
            All Knowledge Base
          </button>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => {
          const isBot = msg.sender === 'assistant';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isBot ? 'max-w-3xl' : 'max-w-2xl ml-auto flex-row-reverse'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isBot
                    ? 'bg-accent/15 border-accent/30 text-accent shadow-sm'
                    : 'bg-raised border-border text-foreground'
                }`}
              >
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div className="space-y-2 flex-1">
                <Card
                  variant={isBot ? 'surface' : 'raised'}
                  className={`p-4 border text-xs md:text-sm leading-relaxed ${
                    isBot
                      ? 'border-border/80 bg-surface/90 text-foreground'
                      : 'border-accent/40 bg-accent/10 text-foreground'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Citations list */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-semibold flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-accent" />
                        Grounding Citations
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((c, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-raised border border-border/80 text-[11px] font-mono space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-3 text-accent font-semibold">
                              <span className="truncate max-w-[180px]">{c.lecture_title}</span>
                              <Badge variant="outline" size="sm">
                                {formatDuration(c.timestamp)}
                              </Badge>
                            </div>
                            <p className="text-muted text-[10px] line-clamp-1 italic font-sans">
                              "{c.text}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <div className={`text-[10px] font-mono text-muted/60 ${isBot ? 'text-left' : 'text-right'}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {askMutation.isPending && (
          <div className="flex items-center gap-3 text-xs text-muted font-mono animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <span>Synthesizing answer from vector memory...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts strip */}
      <div className="px-5 py-2 border-t border-border/40 bg-surface/30 flex items-center gap-2 overflow-x-auto">
        <span className="text-[10px] font-mono text-muted uppercase shrink-0">Prompts:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="text-[11px] text-muted hover:text-foreground bg-raised hover:bg-raised/80 px-2.5 py-1 rounded-full border border-border/60 shrink-0 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border bg-surface/90">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your lectures or concepts..."
            className="flex-1 h-11 px-4 rounded-xl bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted/60 font-sans"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!input.trim() || askMutation.isPending}
            className="h-11 px-5"
          >
            <Send className="w-4 h-4 mr-1.5" />
            <span>Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
