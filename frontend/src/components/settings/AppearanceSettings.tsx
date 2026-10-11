import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { useTheme } from '@/hooks/useTheme';
import type { AppSettings } from '@/lib/api';

interface AppearanceSettingsProps {
  settings: AppSettings['appearance'];
  onChange: (updated: Partial<AppSettings['appearance']>) => void;
  className?: string;
}

const accentPresets = [
  { id: 'indigo', name: 'Observatory Indigo', hex: '#6C7BFF' },
  { id: 'cyan', name: 'Quantum Cyan', hex: '#2DD4BF' },
  { id: 'emerald', name: 'Neural Emerald', hex: '#10B981' },
  { id: 'amber', name: 'Solar Amber', hex: '#F5B84B' },
] as const;

export function AppearanceSettings({ settings, onChange, className }: AppearanceSettingsProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`space-y-6 ${className || ''}`}>
      <Card variant="raised" className="bg-surface/90 border-border/80 p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold font-heading text-foreground">
            Theme & Illumination
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Select light, deep observatory dark, or automatic system appearance.
          </p>
        </div>

        {/* Theme mode options */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'dark', label: 'Observatory Dark', icon: Moon },
            { id: 'light', label: 'Daylight', icon: Sun },
            { id: 'system', label: 'System Match', icon: Monitor },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = theme === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => {
                  setTheme(mode.id as 'dark' | 'light' | 'system');
                  onChange({ theme: mode.id as 'dark' | 'light' | 'system' });
                }}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/15 text-foreground ring-1 ring-accent'
                    : 'border-border bg-surface text-muted hover:text-foreground hover:bg-raised'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-accent' : 'text-muted'}`} />
                <span className="text-xs font-semibold">{mode.label}</span>
              </button>
            );
          })}
        </div>

        {/* Accent preset buttons */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 font-heading">
            <Palette className="w-4 h-4 text-accent" />
            <span>Accent Luminescence Preset</span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {accentPresets.map((preset) => {
              const isSelected = settings.accent_preset === preset.id;

              return (
                <button
                  key={preset.id}
                  onClick={() => onChange({ accent_preset: preset.id })}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-xs font-mono ${
                    isSelected
                      ? 'border-accent bg-accent/10 text-foreground font-semibold ring-1 ring-accent'
                      : 'border-border bg-surface text-muted hover:text-foreground hover:bg-raised'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="truncate">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reduced motion toggle */}
        <div className="pt-4 border-t border-border/50">
          <Switch
            label="Reduce Animations & Motion"
            description="Disable continuous waveform waves and sparkline transitions for low-stimulus environments."
            checked={settings.reduced_motion}
            onCheckedChange={(checked) => onChange({ reduced_motion: checked })}
          />
        </div>
      </Card>
    </div>
  );
}
