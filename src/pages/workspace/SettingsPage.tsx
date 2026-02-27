import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Key, Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const mockSecrets = [
  { key: 'SUPABASE_URL', value: 'https://xxx.supabase.co', masked: true },
  { key: 'SUPABASE_ANON_KEY', value: 'eyJhbG...', masked: true },
  { key: 'STRIPE_SECRET_KEY', value: 'sk_test_...', masked: true },
];

const SettingsPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Sync form when project loads
  useEffect(() => {
    if (project && !initialized) {
      setName(project.name);
      setDescription(project.description ?? '');
      setInitialized(true);
    }
  }, [project, initialized]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('projects').update({ name, description }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Saved', description: 'Project settings updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Project Configuration</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

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
