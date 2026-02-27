import { useState } from 'react';
import { Settings, Key, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const mockSecrets = [
  { key: 'SUPABASE_URL', value: 'https://xxx.supabase.co', masked: true },
  { key: 'SUPABASE_ANON_KEY', value: 'eyJhbG...', masked: true },
  { key: 'STRIPE_SECRET_KEY', value: 'sk_test_...', masked: true },
];

const SettingsPage = () => {
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {/* Project Config */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Project Configuration</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project Name</Label>
            <Input defaultValue="SaaS Dashboard" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input defaultValue="Analytics dashboard with real-time metrics" />
          </div>
          <Button size="sm">Save Changes</Button>
        </div>
      </div>

      {/* Secrets */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold">Environment Variables</h3>
          </div>
          <Button size="sm" variant="outline"><Plus className="mr-1.5 h-3.5 w-3.5" />Add</Button>
        </div>
        <div className="space-y-2">
          {mockSecrets.map(secret => (
            <div key={secret.key} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm font-mono font-medium flex-1">{secret.key}</span>
              <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                {showValues[secret.key] ? secret.value : '••••••••••'}
              </span>
              <button onClick={() => setShowValues(v => ({ ...v, [secret.key]: !v[secret.key] }))} className="text-muted-foreground hover:text-foreground">
                {showValues[secret.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
