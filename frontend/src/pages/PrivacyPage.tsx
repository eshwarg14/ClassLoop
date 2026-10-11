import { useState } from 'react';
import { Shield, Lock, Eye, KeyRound, Database, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MemoryTable } from '@/components/privacy/MemoryTable';
import { useToast } from '@/components/ui/Toast';
import type { MemoryItem } from '@/lib/api';

const defaultMockMemories: MemoryItem[] = [
  {
    id: 'mem-1',
    lecture_id: 'lec-1',
    source_title: 'Linear Algebra & Defective Matrices',
    content: 'Student query regarding algebraic vs geometric multiplicity in 2x2 deficient matrices.',
    visibility: 'private',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    vector_id: 'vec_7a9f_linear',
  },
  {
    id: 'mem-2',
    lecture_id: 'lec-1',
    source_title: 'Linear Algebra & Defective Matrices',
    content: 'Professor explanation of Jordan block decomposition and generalized eigenvectors.',
    visibility: 'class',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    vector_id: 'vec_8b1c_jordan',
  },
  {
    id: 'mem-3',
    lecture_id: 'lec-102',
    source_title: 'Thermodynamics & Carnot Limits',
    content: 'Microscopic entropy state counts and Boltzmann constant relation.',
    visibility: 'ephemeral',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 20).toISOString(),
    vector_id: 'vec_3c4d_carnot',
  },
];

export function PrivacyPage() {
  const { toast } = useToast();
  const [memories, setMemories] = useState<MemoryItem[]>(defaultMockMemories);

  const handleUpdateVisibility = (id: string, visibility: MemoryItem['visibility']) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, visibility } : m))
    );
    toast.success('Visibility Updated', `Memory #${id.slice(0, 6)} updated to ${visibility}.`);
  };

  const handleForget = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    toast.info('Memory Erased', 'Vector embedding completely expunged from Qdrant store.');
  };

  const handleBulkForget = (ids: string[]) => {
    setMemories((prev) => prev.filter((m) => !ids.includes(m.id)));
    toast.info('Memories Expunged', `${ids.length} vector embeddings purged from store.`);
  };

  const handleForgetAll = (confirmation: string) => {
    if (confirmation === 'FORGET') {
      setMemories([]);
      toast.error('Complete Memory Wipe', 'All vector embeddings and contextual history erased.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-surface/80 border border-border backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold font-heading text-foreground">
              Privacy & Vector Memory Vault
            </h1>
            <p className="text-xs text-muted font-mono mt-0.5">
              Inspect, classify, and permanently purge vectors stored in your local Qdrant memory.
            </p>
          </div>
        </div>

        <Badge variant="calm" size="md" className="self-start md:self-auto gap-1.5 font-mono">
          <Lock className="w-3.5 h-3.5" />
          AES-GCM Zero-Knowledge Storage
        </Badge>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="raised" className="p-4 bg-surface/90 border-border/80 space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted">Vector DB Ingestion</span>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xl font-bold font-mono text-foreground">{memories.length} Items</span>
            <Database className="w-5 h-5 text-accent" />
          </div>
          <p className="text-[11px] text-muted pt-1">Encrypted cosine vectors</p>
        </Card>

        <Card variant="raised" className="p-4 bg-surface/90 border-border/80 space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted">Ephemeral Auto-Purge</span>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xl font-bold font-mono text-confusion-warning">
              {memories.filter((m) => m.visibility === 'ephemeral').length} Active
            </span>
            <RefreshCw className="w-5 h-5 text-confusion-warning" />
          </div>
          <p className="text-[11px] text-muted pt-1">24-hour TTL expiration policy</p>
        </Card>

        <Card variant="raised" className="p-4 bg-surface/90 border-border/80 space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted">Cohort Data Sharing</span>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xl font-bold font-mono text-confusion-calm">Disabled</span>
            <CheckCircle2 className="w-5 h-5 text-confusion-calm" />
          </div>
          <p className="text-[11px] text-muted pt-1">Only aggregated confusion metrics shared</p>
        </Card>
      </div>

      {/* Memory Table */}
      <MemoryTable
        memories={memories}
        onUpdateVisibility={handleUpdateVisibility}
        onForget={handleForget}
        onBulkForget={handleBulkForget}
        onForgetAll={handleForgetAll}
      />
    </div>
  );
}
