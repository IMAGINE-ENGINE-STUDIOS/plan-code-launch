import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Key, Plus, Trash2, Eye, EyeOff, Loader2, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Secret = { key: string; value: string };

const SettingsPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  // Local secrets state (mock — no backend table for secrets)
  const [secrets, setSecrets] = useState<Secret[]>([
    { key: 'SUPABASE_URL', value: 'https://xxx.supabase.co' },
    { key: 'SUPABASE_ANON_KEY', value: 'eyJhbG...' },
    { key: 'STRIPE_SECRET_KEY', value: 'sk_test_...' },
  ]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Delete related data first
      await supabase.from('chat_messages').delete().eq('project_id', id!);
      await supabase.from('plans').delete().eq('project_id', id!);
      const { error } = await supabase.from('projects').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Deleted', description: 'Project has been deleted.' });
      window.location.href = '/dashboard';
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const addSecret = () => {
    if (!newKey.trim()) return;
    if (secrets.some(s => s.key === newKey.trim())) {
      toast({ title: 'Duplicate', description: 'A secret with that key already exists.', variant: 'destructive' });
      return;
    }
    setSecrets(prev => [...prev, { key: newKey.trim(), value: newValue }]);
    setNewKey('');
    setNewValue('');
    toast({ title: 'Added', description: `Secret ${newKey.trim()} added.` });
  };

  const removeSecret = (key: string) => {
    setSecrets(prev => prev.filter(s => s.key !== key));
    toast({ title: 'Removed', description: `Secret ${key} removed.` });
  };

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
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Env Vars */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="font-display font-semibold">Environment Variables</h3>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="mr-1.5 h-3.5 w-3.5" />Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Environment Variable</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Key</Label>
                  <Input value={newKey} onChange={e => setNewKey(e.target.value.toUpperCase())} placeholder="API_KEY" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="sk_live_..." type="password" className="font-mono" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={addSecret} disabled={!newKey.trim()}>Add Secret</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {secrets.map(secret => (
            <div key={secret.key} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <span className="text-sm font-mono font-medium flex-1">{secret.key}</span>
              <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                {showValues[secret.key] ? secret.value : '••••••••••'}
              </span>
              <button onClick={() => setShowValues(v => ({ ...v, [secret.key]: !v[secret.key] }))} className="text-muted-foreground hover:text-foreground transition-colors">
                {showValues[secret.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => removeSecret(secret.key)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-display font-semibold text-destructive">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete this project and all its data. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete Project
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{name}" and all associated data including chat history and plans. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default SettingsPage;
