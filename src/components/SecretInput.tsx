import { useState } from 'react';
import { Key, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecretInputProps {
  projectId: string;
  secretKey: string;
  description: string;
  onSaved?: (key: string) => void;
}

const SecretInput = ({ projectId, secretKey, description, onSaved }: SecretInputProps) => {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('project_secrets' as any).upsert(
        { project_id: projectId, key: secretKey, value: value.trim() },
        { onConflict: 'project_id,key' }
      );
      if (error) throw error;
      setSaved(true);
      toast({ title: 'Saved', description: `${secretKey} has been securely stored.` });
      onSaved?.(secretKey);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{secretKey}</span>
        <span className="text-xs text-muted-foreground">configured</span>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">{secretKey}</span>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {description}
        {description.includes('http') && (
          <a
            href={description.match(/https?:\/\/[^\s)]+/)?.[0] || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </p>
      <div className="flex gap-2">
        <Input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={`Paste your ${secretKey} here…`}
          className="font-mono text-xs"
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        />
        <Button size="sm" onClick={handleSave} disabled={!value.trim() || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
};

export default SecretInput;
