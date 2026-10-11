import { useState } from 'react';
import { Trash2, Shield, Eye, Clock, Lock, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { formatDate } from '@/lib/utils';
import type { MemoryItem } from '@/lib/api';

interface MemoryTableProps {
  memories: MemoryItem[];
  onUpdateVisibility: (id: string, visibility: MemoryItem['visibility']) => void;
  onForget: (id: string) => void;
  onBulkForget: (ids: string[]) => void;
  onForgetAll: (confirmation: string) => void;
  className?: string;
}

export function MemoryTable({
  memories,
  onUpdateVisibility,
  onForget,
  onBulkForget,
  onForgetAll,
  className,
}: MemoryTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [forgetAllDialogOpen, setForgetAllDialogOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');

  const filtered = memories.filter((m) =>
    m.source_title.toLowerCase().includes(search.toLowerCase()) ||
    m.content.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((m) => m.id));
    }
  };

  const getVisibilityIcon = (v: MemoryItem['visibility']) => {
    switch (v) {
      case 'private':
        return <Lock className="w-3.5 h-3.5 text-accent" />;
      case 'class':
        return <Users className="w-3.5 h-3.5 text-confusion-calm" />;
      case 'ephemeral':
        return <Clock className="w-3.5 h-3.5 text-confusion-warning" />;
    }
  };

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Search and Bulk Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter memories by keyword or title..."
          className="w-full sm:w-72 h-9 px-3 rounded-lg bg-surface border border-border text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent font-sans"
        />

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedIds.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onBulkForget(selectedIds);
                setSelectedIds([]);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Forget Selected ({selectedIds.length})</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setForgetAllDialogOpen(true)}
            className="text-confusion-danger hover:bg-confusion-danger/10 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            <span>Forget Everything</span>
          </Button>
        </div>
      </div>

      {/* Memories Table */}
      <div className="rounded-xl border border-border bg-surface/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-raised/50 font-mono text-[11px] text-muted uppercase tracking-wider">
                <th className="p-3 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                  />
                </th>
                <th className="p-3">Source & Chunk Content</th>
                <th className="p-3">Visibility Level</th>
                <th className="p-3">Created</th>
                <th className="p-3">Retention / Expiry</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted font-mono">
                    No memories found in the vector vault.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isSelected = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-raised/40 transition-colors ${
                        isSelected ? 'bg-accent/5' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-border"
                        />
                      </td>

                      <td className="p-3 max-w-md">
                        <div className="font-semibold text-foreground tracking-tight font-sans mb-0.5">
                          {item.source_title}
                        </div>
                        <p className="text-muted/80 text-[11px] line-clamp-2 leading-relaxed">
                          {item.content}
                        </p>
                      </td>

                      <td className="p-3">
                        <select
                          value={item.visibility}
                          onChange={(e) =>
                            onUpdateVisibility(item.id, e.target.value as MemoryItem['visibility'])
                          }
                          className="px-2 py-1 rounded bg-surface border border-border text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                        >
                          <option value="private">Private (Vault Only)</option>
                          <option value="class">Class (Cohort Aggregate)</option>
                          <option value="ephemeral">Ephemeral (24h Auto-purge)</option>
                        </select>
                      </td>

                      <td className="p-3 font-mono text-muted text-[11px]">
                        {formatDate(item.created_at)}
                      </td>

                      <td className="p-3 font-mono text-[11px]">
                        {item.visibility === 'ephemeral' ? (
                          <span className="flex items-center gap-1 text-confusion-warning">
                            <Clock className="w-3 h-3" />
                            <span>Auto-purges 24h</span>
                          </span>
                        ) : (
                          <span className="text-muted/70">Persistent</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onForget(item.id)}
                          className="h-8 w-8 text-muted hover:text-confusion-danger hover:bg-confusion-danger/10"
                          title="Forget this memory immediately"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Typed Confirmation Modal for Complete Memory Purge */}
      <Dialog open={forgetAllDialogOpen} onOpenChange={setForgetAllDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-confusion-danger flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-confusion-danger" />
              Confirm Complete Memory Purge
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all vectors, transcripts, and model memory from Qdrant. This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <p className="text-xs text-foreground/80">
              Please type <span className="font-mono font-bold text-confusion-danger">FORGET</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="Type FORGET here"
              className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-foreground font-mono text-xs uppercase"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setForgetAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmPhrase !== 'FORGET'}
              onClick={() => {
                onForgetAll(confirmPhrase);
                setForgetAllDialogOpen(false);
                setConfirmPhrase('');
              }}
            >
              Purge All Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
