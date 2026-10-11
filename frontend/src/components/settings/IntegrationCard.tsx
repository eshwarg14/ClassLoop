import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Radio, Database, Cpu, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api, type IntegrationStatus, type SecretMetadata } from '@/lib/api';

export interface FieldConfig {
  key: string;
  label: string;
  placeholder?: string;
  isSecret?: boolean;
  value: string;
  metadata?: SecretMetadata;
  type?: 'text' | 'select';
  options?: { label: string; value: string }[];
}

interface IntegrationCardProps {
  id: 'omi' | 'lyzr' | 'qdrant' | 'embeddings';
  title: string;
  description: string;
  fields: FieldConfig[];
  metadata?: Record<string, SecretMetadata>;
  onFieldChange: (key: string, value: string) => void;
  extraContent?: React.ReactNode;
  className?: string;
}

const serviceIcons = {
  omi: Radio,
  lyzr: Cpu,
  qdrant: Database,
  embeddings: Sparkles,
};

export function IntegrationCard({
  id,
  title,
  description,
  fields,
  metadata = {},
  onFieldChange,
  extraContent,
  className,
}: IntegrationCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<IntegrationStatus | null>(null);

  const Icon = serviceIcons[id] || Sparkles;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testIntegration(id);
      setTestResult(res);
    } catch (err: unknown) {
      setTestResult({
        name: title,
        status: 'error',
        connected: false,
        error: err instanceof Error ? err.message : 'Connection test request failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const isSuccess = testResult && (testResult.connected || testResult.status === 'ok');

  return (
    <Card variant="raised" className={`overflow-hidden bg-surface/90 border-border/80 ${className || ''}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-0.5">{description}</CardDescription>
          </div>
        </div>

        {testResult && (
          <div>
            {isSuccess ? (
              <Badge variant="calm" size="sm" className="gap-1">
                <CheckCircle2 className="w-3 h-3 text-confusion-calm" />
                <span>{testResult.latency_ms !== undefined ? `${testResult.latency_ms}ms Connected` : 'Connected'}</span>
              </Badge>
            ) : (
              <Badge variant="danger" size="sm" className="gap-1" title={testResult.error}>
                <AlertCircle className="w-3 h-3 text-confusion-danger" />
                <span>Error</span>
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {extraContent}

        {fields.map((field) => {
          const fieldMeta = field.metadata || metadata[field.key];
          const isConfigured = fieldMeta?.set;

          return (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground/90 font-mono">
                  {field.label}
                </label>

                {isConfigured && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-confusion-calm/15 text-confusion-calm border border-confusion-calm/30">
                    Set (ends in ...{fieldMeta.last4}) | source: {fieldMeta.source}
                  </span>
                )}
              </div>

              {field.type === 'select' ? (
                <select
                  value={field.value}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  className="w-full h-10 px-3.5 py-2 rounded-lg bg-surface text-foreground border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder={
                    isConfigured
                      ? `**************** (Leave blank to keep existing ${fieldMeta.source} secret)`
                      : field.placeholder || `Enter ${field.key}...`
                  }
                  value={field.value}
                  isSecret={field.isSecret}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                />
              )}
            </div>
          );
        })}

        {testResult && !isSuccess && testResult.error && (
          <div className="p-3 rounded-lg bg-confusion-danger/10 border border-confusion-danger/30 text-confusion-danger text-xs font-mono">
            Error: {testResult.error}
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-between pt-3">
        <span className="text-[11px] font-mono text-muted/70">
          {testResult?.details ? testResult.details : testResult?.last_tested ? 'Verified' : 'Unverified'}
        </span>

        <Button
          variant="secondary"
          size="sm"
          loading={testing}
          onClick={handleTest}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          <span>Test Endpoint</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
