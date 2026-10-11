import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Sliders,
  Palette,
  KeyRound,
  ShieldAlert,
  Save,
  CheckCircle2,
  Database,
  Copy,
  Check,
  ExternalLink,
  Download,
  RotateCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { IntegrationCard, type FieldConfig } from '@/components/settings/IntegrationCard';
import { BehaviourSettings } from '@/components/settings/BehaviourSettings';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { useToast } from '@/components/ui/Toast';
import { getAdminToken, setAdminToken, api, type AppSettings, type SettingsKeyMetadata } from '@/lib/api';

const defaultSettings: AppSettings = {
  integrations: {
    OMI_WEBHOOK_SECRET: '',
    OMI_API_KEY: '',
    OMI_APP_ID: '',
    LYZR_API_KEY: '',
    LYZR_BASE_URL: 'https://agent-prod.studio.lyzr.ai',
    LYZR_ORCHESTRATOR_AGENT_ID: '',
    LYZR_DETECTOR_AGENT_ID: '',
    LYZR_CONTENT_AGENT_ID: '',
    LYZR_SCHEDULER_AGENT_ID: '',
    QDRANT_URL: '',
    QDRANT_API_KEY: '',
    QDRANT_COLLECTION: 'org_memory',
    EMBEDDING_PROVIDER: 'fastembed',
    EMBEDDING_MODEL: 'BAAI/bge-small-en-v1.5',
    EMBEDDING_API_KEY: '',
    EMBEDDING_BASE_URL: '',
  },
  behaviour: {
    weights: {
      question: 0.35,
      rephrase: 0.25,
      pause: 0.15,
      vocal_stress: 0.15,
      manual_override: 0.1,
    },
    demo_mode: false,
    ephemeral_ttl_hours: 24,
    timeout_seconds: 600,
    chunk_interval_seconds: 15,
    auto_trigger_pipeline: true,
  },
  appearance: {
    theme: 'dark',
    reduced_motion: false,
    accent_preset: 'indigo',
  },
};

export function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('integrations');
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [metadata, setMetadata] = useState<SettingsKeyMetadata>({});
  const [adminToken, setAdminTokenInput] = useState(getAdminToken());
  const [isSaved, setIsSaved] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isReindexing, setIsReindexing] = useState(false);

  const isDefaultToken = adminToken === 'change-me' || adminToken === 'admin-loop-token';
  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'}/webhook/omi`;

  // Fetch settings metadata on mount
  useEffect(() => {
    let mounted = true;
    api.getSettingsMetadata()
      .then((meta) => {
        if (mounted && meta) {
          setMetadata(meta);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch server settings metadata, using default', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleFieldChange = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      integrations: {
        ...prev.integrations,
        [key]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    setAdminToken(adminToken);

    // Only send fields that were actually typed by the user to avoid overwriting with empty
    const payload: Record<string, string> = {};
    Object.entries(settings.integrations).forEach(([k, v]) => {
      if (v && v.trim().length > 0) {
        payload[k] = v.trim();
      }
    });

    try {
      if (Object.keys(payload).length > 0) {
        await api.saveSettings(payload);
        // Refresh metadata
        const updatedMeta = await api.getSettingsMetadata();
        setMetadata(updatedMeta);
      }
      setIsSaved(true);
      toast.success('Configuration Saved', 'Credentials encrypted with Fernet and updated in database.');
      setTimeout(() => setIsSaved(false), 2500);
    } catch (err: unknown) {
      toast.error('Save Failed', err instanceof Error ? err.message : 'Could not save settings to server.');
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.info('Copied Webhook URL', webhookUrl);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleExportData = async () => {
    try {
      const data = await api.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `classloop_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data Exported', 'Full JSON backup downloaded successfully.');
    } catch {
      toast.error('Export Error', 'Failed to generate JSON backup.');
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const res = await api.reindexQdrant();
      toast.success('Qdrant Reindexed', res.message || 'Collection re-indexed successfully.');
    } catch {
      toast.error('Reindex Error', 'Failed to trigger collection re-indexing.');
    } finally {
      setIsReindexing(false);
    }
  };

  const handleDeleteEverything = async () => {
    if (deleteConfirmation !== 'DELETE') return;
    try {
      await api.deleteAllData(deleteConfirmation);
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
      toast.error('System Cleared', 'All lectures, vector embeddings, and cached transcripts removed.');
    } catch {
      toast.error('Delete Failed', 'Confirmation mismatch or server error.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface/80 border border-border backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold font-heading text-foreground">
              Observatory Settings & Integrations
            </h1>
            <p className="text-xs text-muted font-mono mt-0.5">
              Manage multi-agent swarms, audio webhooks, vector stores, and scoring weights.
            </p>
          </div>
        </div>

        <Button variant="primary" size="sm" onClick={handleSaveAll}>
          {isSaved ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          <span>{isSaved ? 'Saved!' : 'Save Configuration'}</span>
        </Button>
      </div>

      {/* Warning banner when using default ADMIN_TOKEN */}
      {isDefaultToken && (
        <Card variant="raised" className="p-4 bg-confusion-warning/10 border-confusion-warning/40 flex items-start sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-confusion-warning shrink-0" />
            <div>
              <h4 className="text-xs font-semibold font-heading text-foreground">
                Default Admin Token Active ({adminToken})
              </h4>
              <p className="text-[11px] text-muted">
                You are currently authenticating with the default development token (<span className="font-mono text-foreground font-semibold">ADMIN_TOKEN={adminToken}</span>). Set a secure custom key in the Security tab.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('security')}
            className="text-xs text-confusion-warning hover:bg-confusion-warning/20 shrink-0"
          >
            Update Token
          </Button>
        </Card>
      )}

      {/* Settings Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 max-w-xl mb-6">
          <TabsTrigger value="integrations" className="gap-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="behaviour" className="gap-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>Behaviour</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="w-3.5 h-3.5" />
            <span>Data</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Omi Integration Card */}
            <IntegrationCard
              id="omi"
              title="Omi Audio Streaming"
              description="Real-time wearable transcription ingestion endpoint"
              metadata={metadata}
              onFieldChange={handleFieldChange}
              extraContent={
                <div className="p-3.5 rounded-xl bg-raised border border-border/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">Target Webhook URL</span>
                    <button
                      onClick={handleCopyWebhook}
                      className="text-accent hover:underline flex items-center gap-1 font-semibold"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-confusion-calm" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-xs text-foreground bg-surface px-3 py-1.5 rounded border border-border break-all">
                    {webhookUrl}
                  </div>
                  <div className="text-[11px] text-muted flex items-center gap-1 pt-0.5">
                    <ExternalLink className="w-3 h-3 text-accent" />
                    <span>How to register in Omi app: Settings &gt; Integrations &gt; Webhook &gt; Paste URL</span>
                  </div>
                </div>
              }
              fields={[
                {
                  key: 'OMI_WEBHOOK_SECRET',
                  label: 'OMI_WEBHOOK_SECRET',
                  placeholder: 'HMAC signature verification secret',
                  isSecret: true,
                  value: settings.integrations.OMI_WEBHOOK_SECRET,
                },
                {
                  key: 'OMI_API_KEY',
                  label: 'OMI_API_KEY',
                  placeholder: 'omi_api_key_...',
                  isSecret: true,
                  value: settings.integrations.OMI_API_KEY,
                },
                {
                  key: 'OMI_APP_ID',
                  label: 'OMI_APP_ID',
                  placeholder: 'omi_app_id_...',
                  value: settings.integrations.OMI_APP_ID,
                },
              ]}
            />

            {/* Lyzr Multi-Agent Swarm */}
            <IntegrationCard
              id="lyzr"
              title="Lyzr Multi-Agent Swarm"
              description="Orchestrator, Detector, Content & Scheduler pipelines"
              metadata={metadata}
              onFieldChange={handleFieldChange}
              fields={[
                {
                  key: 'LYZR_API_KEY',
                  label: 'LYZR_API_KEY',
                  placeholder: 'lyzr_sk_live_...',
                  isSecret: true,
                  value: settings.integrations.LYZR_API_KEY,
                },
                {
                  key: 'LYZR_BASE_URL',
                  label: 'LYZR_BASE_URL',
                  placeholder: 'https://api.lyzr.ai',
                  value: settings.integrations.LYZR_BASE_URL,
                },
                {
                  key: 'LYZR_ORCHESTRATOR_AGENT_ID',
                  label: 'LYZR_ORCHESTRATOR_AGENT_ID',
                  placeholder: 'agt_orchestrator_...',
                  value: settings.integrations.LYZR_ORCHESTRATOR_AGENT_ID,
                },
                {
                  key: 'LYZR_DETECTOR_AGENT_ID',
                  label: 'LYZR_DETECTOR_AGENT_ID',
                  placeholder: 'agt_detector_...',
                  value: settings.integrations.LYZR_DETECTOR_AGENT_ID,
                },
                {
                  key: 'LYZR_CONTENT_AGENT_ID',
                  label: 'LYZR_CONTENT_AGENT_ID',
                  placeholder: 'agt_content_...',
                  value: settings.integrations.LYZR_CONTENT_AGENT_ID,
                },
                {
                  key: 'LYZR_SCHEDULER_AGENT_ID',
                  label: 'LYZR_SCHEDULER_AGENT_ID',
                  placeholder: 'agt_scheduler_...',
                  value: settings.integrations.LYZR_SCHEDULER_AGENT_ID,
                },
              ]}
            />

            {/* Qdrant Vector Store */}
            <IntegrationCard
              id="qdrant"
              title="Qdrant Vector Database"
              description="High-speed cosine semantic memory & privacy vault"
              metadata={metadata}
              onFieldChange={handleFieldChange}
              fields={[
                {
                  key: 'QDRANT_URL',
                  label: 'QDRANT_URL',
                  placeholder: 'http://localhost:6333',
                  value: settings.integrations.QDRANT_URL,
                },
                {
                  key: 'QDRANT_API_KEY',
                  label: 'QDRANT_API_KEY',
                  placeholder: 'qdrant_api_key_...',
                  isSecret: true,
                  value: settings.integrations.QDRANT_API_KEY,
                },
                {
                  key: 'QDRANT_COLLECTION',
                  label: 'QDRANT_COLLECTION',
                  placeholder: 'classloop_lectures',
                  value: settings.integrations.QDRANT_COLLECTION,
                },
              ]}
            />

            {/* Embedding Model */}
            <IntegrationCard
              id="embeddings"
              title="Vector Embedder"
              description="Semantic representation model for lecture grounding"
              metadata={metadata}
              onFieldChange={handleFieldChange}
              fields={[
                {
                  key: 'EMBEDDING_PROVIDER',
                  label: 'EMBEDDING_PROVIDER',
                  value: settings.integrations.EMBEDDING_PROVIDER,
                  type: 'select',
                  options: [
                    { label: 'FastEmbed (Local Offline - BAAI/bge-small-en-v1.5)', value: 'fastembed' },
                    { label: 'OpenAI (text-embedding-3-small)', value: 'openai' },
                  ],
                },
                {
                  key: 'EMBEDDING_MODEL',
                  label: 'EMBEDDING_MODEL',
                  placeholder: 'BAAI/bge-small-en-v1.5',
                  value: settings.integrations.EMBEDDING_MODEL,
                },
                {
                  key: 'EMBEDDING_API_KEY',
                  label: 'EMBEDDING_API_KEY',
                  placeholder: 'sk-... (Required for OpenAI provider)',
                  isSecret: true,
                  value: settings.integrations.EMBEDDING_API_KEY,
                },
              ]}
            />
          </div>
        </TabsContent>

        {/* Behaviour Tab */}
        <TabsContent value="behaviour">
          <BehaviourSettings
            settings={settings.behaviour}
            onChange={(updated) =>
              setSettings((prev) => ({
                ...prev,
                behaviour: { ...prev.behaviour, ...updated },
              }))
            }
          />
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <AppearanceSettings
            settings={settings.appearance}
            onChange={(updated) =>
              setSettings((prev) => ({
                ...prev,
                appearance: { ...prev.appearance, ...updated },
              }))
            }
          />
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-6">
          <Card variant="raised" className="p-6 bg-surface/90 border-border/80 space-y-6">
            <div>
              <h3 className="text-base font-semibold font-heading text-foreground">
                Data Maintenance & Backups
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Export comprehensive lecture transcripts, Obsidian notes, quiz question sets, and vector indices.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export Data */}
              <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold font-heading text-foreground">
                    <Download className="w-4 h-4 text-accent" />
                    <span>Export All Data as JSON</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Downloads an unencrypted portable JSON archive containing all recorded lecture transcripts, scored chunks, Obsidian notes, and schedule events.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleExportData} className="w-full">
                  <Download className="w-4 h-4 mr-1.5" />
                  <span>Download Backup JSON</span>
                </Button>
              </div>

              {/* Reindex Qdrant */}
              <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold font-heading text-foreground">
                    <RotateCw className="w-4 h-4 text-secondary" />
                    <span>Reindex Qdrant Collection</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Re-generates embeddings across all stored lecture segments using the configured embedder model to optimize semantic search precision.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={isReindexing}
                  onClick={handleReindex}
                  className="w-full"
                >
                  <RotateCw className="w-4 h-4 mr-1.5" />
                  <span>Reindex Vector Database</span>
                </Button>
              </div>
            </div>

            {/* Guarded Danger Zone */}
            <div className="p-5 rounded-xl border border-confusion-danger/40 bg-confusion-danger/5 space-y-3 pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold font-heading text-confusion-danger">
                <AlertTriangle className="w-4 h-4" />
                <span>Danger Zone: Complete Data Erasure</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Permanently wipes all lectures, database records, and Qdrant memory points. This action cannot be reversed.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span>Delete Everything</span>
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card variant="raised" className="p-6 bg-surface/90 border-border/80 space-y-5">
            <div>
              <h3 className="text-base font-semibold font-heading text-foreground">
                Admin Authentication Key
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Injected into all API requests via the <span className="font-mono text-accent">X-Admin-Token</span> header.
              </p>
            </div>

            <div className="max-w-md space-y-4">
              <Input
                label="Active Admin Token"
                value={adminToken}
                isSecret={true}
                onChange={(e) => setAdminTokenInput(e.target.value)}
                helperText="Must match ADMIN_TOKEN set in backend .env (Default: change-me)"
              />

              <Button variant="primary" size="sm" onClick={handleSaveAll}>
                Update Admin Token
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-confusion-danger flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-confusion-danger" />
              Confirm Complete System Wipe
            </DialogTitle>
            <DialogDescription>
              This will permanently destroy all database records, generated notes, and vector embeddings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <p className="text-xs text-foreground/85">
              Type <span className="font-mono font-bold text-confusion-danger">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type DELETE here"
              className="w-full h-10 px-3 rounded-lg bg-surface border border-border text-foreground font-mono text-xs uppercase"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteConfirmation !== 'DELETE'}
              onClick={handleDeleteEverything}
            >
              Wipe All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
