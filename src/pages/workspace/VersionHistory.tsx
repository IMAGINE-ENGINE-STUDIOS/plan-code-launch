import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { History, RotateCcw, GitCommit, Loader2, CheckCircle2, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

const VersionHistory = () => {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [snapshotNote, setSnapshotNote] = useState('');

  // Fetch versions from DB
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['project-versions', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('project_versions' as any) as any)
        .select('id, version_label, note, snapshot, created_at, user_id')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string; version_label: string; note: string;
        snapshot: Record<string, string>; created_at: string; user_id: string;
      }>;
    },
    enabled: !!projectId,
  });

  // Create snapshot mutation
  const createSnapshot = useMutation({
    mutationFn: async (note: string) => {
      // Load current project files
      const { data: files, error: filesError } = await supabase
        .from('project_files')
        .select('file_path, content')
        .eq('project_id', projectId!);
      if (filesError) throw filesError;

      const snapshot: Record<string, string> = {};
      (files || []).forEach((f: any) => { snapshot[f.file_path] = f.content; });

      const versionLabel = `v${versions.length + 1}.0.0`;

      const { error } = await (supabase.from('project_versions' as any) as any).insert({
        project_id: projectId!,
        user_id: user!.id,
        version_label: versionLabel,
        note: note || 'Manual snapshot',
        snapshot,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-versions', projectId] });
      toast({ title: 'Snapshot created', description: 'Version saved successfully.' });
      setSnapshotNote('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Rollback mutation
  const handleRollback = async (version: typeof versions[0]) => {
    setRollingBack(version.id);
    try {
      const snapshot = version.snapshot || {};
      // Delete existing files and replace with snapshot
      await supabase.from('project_files').delete().eq('project_id', projectId!);

      const entries = Object.entries(snapshot);
      if (entries.length > 0) {
        const rows = entries.map(([file_path, content]) => ({
          project_id: projectId!,
          file_path,
          content,
        }));
        // Insert in batches of 50
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const { error } = await supabase.from('project_files').insert(batch);
          if (error) throw error;
        }
      }

      toast({ title: 'Rolled back', description: `Project restored to ${version.version_label}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRollingBack(null);
    }
  };

  const activeVersion = versions[0]?.id;

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Version History</h2>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />Create Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Version Snapshot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Input
                value={snapshotNote}
                onChange={e => setSnapshotNote(e.target.value)}
                placeholder="What changed? e.g. 'Added payment integration'"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={() => createSnapshot.mutate(snapshotNote)} disabled={createSnapshot.isPending}>
                  {createSnapshot.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                  Save Snapshot
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <History className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No versions yet. Create a snapshot to start tracking changes.</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

          {versions.map((v, i) => {
            const isCurrent = v.id === activeVersion;
            const fileCount = Object.keys(v.snapshot || {}).length;
            return (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative flex gap-4 pb-6"
              >
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card ${isCurrent ? 'border-primary' : 'border-border'}`}>
                  {isCurrent ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className={`flex-1 rounded-lg border bg-card p-4 ${isCurrent ? 'border-primary/30' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-primary">{v.version_label}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Latest
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">{fileCount} files</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground">{v.note}</p>
                    </div>
                    {!isCurrent && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={rollingBack === v.id}>
                            {rollingBack === v.id ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="mr-1 h-3 w-3" />
                            )}
                            Rollback
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Rollback to {v.version_label}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will restore {fileCount} files to version {v.version_label} ("{v.note}"). Current files will be replaced.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRollback(v)}>
                              Rollback
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()} · {new Date(v.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
