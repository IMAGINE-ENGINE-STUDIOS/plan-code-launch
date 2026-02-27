import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, ArrowLeft, Search, FileCode2, Loader2,
  Download, CheckCircle2, FolderTree, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

type ScanResult = {
  owner: string;
  repo: string;
  branch: string;
  files: { path: string; size: number }[];
  totalFiles: number;
};

type ImportResult = {
  owner: string;
  repo: string;
  branch: string;
  files: Record<string, string>;
  totalFiles: number;
};

const IMPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-github-repo`;

const ImportProject = () => {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [repoUrl, setRepoUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  const isValidUrl = repoUrl.includes('github.com/');

  const scanRepo = async () => {
    if (!session || !isValidUrl) return;
    setScanning(true);
    setError('');
    setScanResult(null);

    try {
      const res = await fetch(IMPORT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ repoUrl, scanOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setScanResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const importAndBuild = async () => {
    if (!session || !user || !scanResult) return;
    setImporting(true);

    try {
      // Fetch full file contents
      const res = await fetch(IMPORT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ repoUrl, scanOnly: false }),
      });
      const data: ImportResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Import failed');

      // Create project
      const { data: project, error: projErr } = await supabase.from('projects').insert({
        name: `${data.repo} (imported)`,
        description: `Imported from github.com/${data.owner}/${data.repo}`,
        user_id: user.id,
        status: 'active',
        source_repo: `https://github.com/${data.owner}/${data.repo}`,
      }).select('id').single();

      if (projErr || !project) throw new Error(projErr?.message || 'Failed to create project');

      // Save files to project_files
      const fileRows = Object.entries(data.files).map(([file_path, content]) => ({
        project_id: project.id,
        file_path,
        content,
      }));

      // Insert in batches of 20
      for (let i = 0; i < fileRows.length; i += 20) {
        const batch = fileRows.slice(i, i + 20);
        const { error: insertErr } = await supabase.from('project_files').insert(batch);
        if (insertErr) console.error('File insert error:', insertErr);
      }

      toast({ title: 'Import complete', description: `${data.totalFiles} files imported from ${data.repo}` });
      navigate(`/project/${project.id}/edit`);
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl py-8">
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back</Link>
        </Button>

        <div className="mb-6 flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Import from GitHub</h1>
        </div>

        <p className="mb-6 text-sm text-muted-foreground">
          Paste a public GitHub repo URL to import its source files. Works best with Lovable-generated projects.
        </p>

        {/* URL Input */}
        <div className="flex gap-2 mb-6">
          <Input
            value={repoUrl}
            onChange={e => setRepoUrl(e.target.value)}
            placeholder="https://github.com/username/my-project"
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && scanRepo()}
          />
          <Button onClick={scanRepo} disabled={!isValidUrl || scanning}>
            {scanning ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            Scan
          </Button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Scan Results */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between bg-muted/50 px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{scanResult.owner}/{scanResult.repo}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {scanResult.branch}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{scanResult.totalFiles} files</span>
              </div>

              <ScrollArea className="h-64">
                <div className="p-2">
                  {scanResult.files.map((f, i) => (
                    <div key={f.path} className="flex items-center justify-between rounded px-3 py-1.5 text-xs hover:bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono">{f.path}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0 ml-2">{formatSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <Button onClick={importAndBuild} disabled={importing} className="w-full">
                  {importing ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Importing {scanResult.totalFiles} files…</>
                  ) : (
                    <><Download className="mr-1.5 h-4 w-4" />Import & Start Building</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tips */}
        <div className="mt-8 rounded-lg border border-border bg-muted/20 p-4">
          <h3 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Best results with
          </h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• Public repos built with React + TypeScript + Tailwind CSS</li>
            <li>• Lovable-exported projects (full compatibility)</li>
            <li>• Projects under 80 source files</li>
            <li>• Standard src/ folder structure</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImportProject;
