import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Key, Plus, Trash2, Eye, EyeOff, Loader2, Save, AlertTriangle, Tags, Cpu, Download, ExternalLink, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const AI_MODELS = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Best)' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'openai/gpt-5', label: 'GPT-5 (Powerful)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (Balanced)' },
];

const SettingsPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // ─── Project info ───
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
  const [stackInput, setStackInput] = useState('');
  const [stack, setStack] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [priorityInput, setPriorityInput] = useState('');
  const [aiModel, setAiModel] = useState('google/gemini-2.5-flash');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (project && !initialized) {
      setName(project.name);
      setDescription(project.description ?? '');
      setStack(project.stack ?? []);
      setPriorities(project.priorities ?? []);
      setAiModel((project as any).ai_model ?? 'google/gemini-2.5-flash');
      setInitialized(true);
    }
  }, [project, initialized]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('projects').update({
        name, description, stack, priorities, ai_model: aiModel,
      } as any).eq('id', id!);
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
      await supabase.from('chat_messages').delete().eq('project_id', id!);
      await supabase.from('plans').delete().eq('project_id', id!);
      await (supabase.from('project_secrets' as any) as any).delete().eq('project_id', id!);
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

  const addTag = (list: string[], setList: (v: string[]) => void, value: string) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
  };

  const removeTag = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  // ─── Secrets ───
  const { data: secrets = [], isLoading: secretsLoading } = useQuery({
    queryKey: ['project-secrets', id],
    queryFn: async () => {
      const { data, error } = await (supabase.from('project_secrets' as any) as any)
        .select('id, key, value, created_at')
        .eq('project_id', id!);
      if (error) throw error;
      return data as Array<{ id: string; key: string; value: string; created_at: string }>;
    },
    enabled: !!id,
  });

  const addSecretMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from('project_secrets' as any) as any).insert({
        project_id: id!, key: newKey.trim(), value: newValue,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-secrets', id] });
      toast({ title: 'Added', description: `Secret ${newKey.trim()} added.` });
      setNewKey(''); setNewValue('');
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const removeSecretMutation = useMutation({
    mutationFn: async (secretId: string) => {
      const { error } = await (supabase.from('project_secrets' as any) as any).delete().eq('id', secretId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-secrets', id] });
      toast({ title: 'Removed', description: 'Secret removed.' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ─── Check if Gemini key is configured ───
  const hasGeminiKey = secrets.some(s => s.key === 'GOOGLE_GEMINI_API_KEY');

  // ─── Export ───
  const handleExport = async () => {
    if (!session || !id) return;
    setIsExporting(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ projectId: id }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Exported', description: 'Project ZIP downloaded successfully.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Quick add Gemini key ───
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingGeminiKey, setSavingGeminiKey] = useState(false);

  const saveGeminiKey = async () => {
    if (!geminiKeyInput.trim() || !id) return;
    setSavingGeminiKey(true);
    try {
      const { error } = await (supabase.from('project_secrets' as any) as any).upsert(
        { project_id: id, key: 'GOOGLE_GEMINI_API_KEY', value: geminiKeyInput.trim() },
        { onConflict: 'project_id,key' }
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['project-secrets', id] });
      toast({ title: 'Saved', description: 'Gemini API key configured. AI calls will now use Google directly.' });
      setGeminiKeyInput('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingGeminiKey(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {/* AI Provider */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">AI Provider</h3>
          {hasGeminiKey ? (
            <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">Gemini Direct</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Default Gateway</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {hasGeminiKey
            ? 'AI calls use your Google Gemini API key directly — fully independent, no gateway dependency.'
            : 'AI calls route through the default gateway. Add a Gemini API key to go fully independent.'}
        </p>

        {!hasGeminiKey && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Get a free API key from Google AI Studio →
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={geminiKeyInput}
                onChange={e => setGeminiKeyInput(e.target.value)}
                placeholder="Paste your Gemini API key…"
                className="font-mono text-xs flex-1"
                onKeyDown={e => { if (e.key === 'Enter') saveGeminiKey(); }}
              />
              <Button size="sm" onClick={saveGeminiKey} disabled={!geminiKeyInput.trim() || savingGeminiKey}>
                {savingGeminiKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Key'}
              </Button>
            </div>
          </div>
        )}
      </div>

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

          {/* Stack tags */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Tags className="h-3.5 w-3.5" />Tech Stack</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {stack.map((tag, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button onClick={() => removeTag(stack, setStack, i)} className="ml-0.5 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={stackInput}
                onChange={e => setStackInput(e.target.value)}
                placeholder="Add technology…"
                className="flex-1"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(stack, setStack, stackInput); setStackInput(''); } }}
              />
              <Button size="sm" variant="outline" onClick={() => { addTag(stack, setStack, stackInput); setStackInput(''); }}>Add</Button>
            </div>
          </div>

          {/* Priorities */}
          <div className="space-y-1.5">
            <Label>Priorities</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {priorities.map((tag, i) => (
                <Badge key={i} variant="outline" className="gap-1 text-xs">
                  {tag}
                  <button onClick={() => removeTag(priorities, setPriorities, i)} className="ml-0.5 hover:text-destructive">×</button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={priorityInput}
                onChange={e => setPriorityInput(e.target.value)}
                placeholder="Add priority…"
                className="flex-1"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(priorities, setPriorities, priorityInput); setPriorityInput(''); } }}
              />
              <Button size="sm" variant="outline" onClick={() => { addTag(priorities, setPriorities, priorityInput); setPriorityInput(''); }}>Add</Button>
            </div>
          </div>

          {/* AI Model */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" />AI Model</Label>
            <Select value={aiModel} onValueChange={setAiModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Export */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Export Project</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Download your entire project as a ZIP file with package.json, vite config, and all source files. Ready to run locally with <code className="text-xs bg-muted px-1 py-0.5 rounded">npm install && npm run dev</code>.
        </p>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={isExporting}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export as ZIP
        </Button>
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
              <DialogHeader><DialogTitle>Add Environment Variable</DialogTitle></DialogHeader>
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
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => addSecretMutation.mutate()} disabled={!newKey.trim() || addSecretMutation.isPending}>
                    {addSecretMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add Secret
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {secretsLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading secrets…
            </div>
          ) : secrets.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No environment variables configured.</p>
          ) : (
            secrets.map(secret => (
              <div key={secret.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <span className="text-sm font-mono font-medium flex-1">{secret.key}</span>
                <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                  {showValues[secret.id] ? secret.value : '••••••••••'}
                </span>
                <button onClick={() => setShowValues(v => ({ ...v, [secret.id]: !v[secret.id] }))} className="text-muted-foreground hover:text-foreground transition-colors">
                  {showValues[secret.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => removeSecretMutation.mutate(secret.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
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
            <Button variant="destructive" size="sm"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete Project</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{name}" and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
