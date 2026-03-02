import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, ArrowLeft, Search, FileCode2, Loader2,
  Download, CheckCircle2, FolderTree, AlertCircle, Database, CloudDownload, Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';

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

type SupabaseScanFile = { file_path: string; content: string; size: number };

const IMPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-github-repo`;

const ImportProject = () => {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // GitHub state
  const [repoUrl, setRepoUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  // Supabase pull state
  const [sbUrl, setSbUrl] = useState('');
  const [sbAnonKey, setSbAnonKey] = useState('');
  const [sbServiceKey, setSbServiceKey] = useState('');
  const [sbProjectId, setSbProjectId] = useState('');
  const [sbScanning, setSbScanning] = useState(false);
  const [sbImporting, setSbImporting] = useState(false);
  const [sbFiles, setSbFiles] = useState<SupabaseScanFile[]>([]);
  const [sbProjectName, setSbProjectName] = useState('');
  const [sbError, setSbError] = useState('');

  const isValidUrl = repoUrl.includes('github.com/');

  // ─── GitHub methods ───
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

      // Extract dependencies from package.json if present
      let detectedDeps: Record<string, string> = {};
      const pkgJsonContent = data.files['package.json'] || data.files['/package.json'];
      if (pkgJsonContent) {
        try {
          const pkgJson = JSON.parse(pkgJsonContent);
          detectedDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
        } catch {}
      }

      const { data: project, error: projErr } = await supabase.from('projects').insert({
        name: `${data.repo} (imported)`,
        description: `Imported from github.com/${data.owner}/${data.repo}`,
        user_id: user.id,
        status: 'active',
        source_repo: `https://github.com/${data.owner}/${data.repo}`,
        dependencies: detectedDeps,
      } as any).select('id').single();

      if (projErr || !project) throw new Error(projErr?.message || 'Failed to create project');

      const fileRows = Object.entries(data.files).map(([file_path, content]) => ({
        project_id: project.id,
        file_path: file_path.startsWith('/') ? file_path : `/${file_path}`,
        content,
      }));

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

  // ─── Supabase pull methods ───
  const scanSupabase = async () => {
    if (!sbUrl || (!sbAnonKey && !sbServiceKey)) return;
    setSbScanning(true);
    setSbError('');
    setSbFiles([]);
    setSbProjectName('');

    try {
      const remoteClient = createClient(sbUrl, sbServiceKey || sbAnonKey);

      // Try to find the project — check if project_files table exists
      // First try to get a project name
      const { data: projects, error: projErr } = await remoteClient
        .from('projects')
        .select('id, name, description')
        .order('updated_at', { ascending: false })
        .limit(1);

      let targetProjectId = sbProjectId;

      if (projects && projects.length > 0) {
        if (!targetProjectId) targetProjectId = projects[0].id;
        const targetProject = sbProjectId
          ? projects.find((p: any) => p.id === sbProjectId) || projects[0]
          : projects[0];
        setSbProjectName(targetProject.name || 'Unnamed Project');
      }

      // Pull project_files
      let query = remoteClient.from('project_files').select('file_path, content');
      if (targetProjectId) {
        query = query.eq('project_id', targetProjectId);
      }

      const { data: files, error: filesErr } = await query.order('file_path').limit(500);

      if (filesErr) throw new Error(filesErr.message);
      if (!files || files.length === 0) throw new Error('No project files found. Make sure the project has files and you have access.');

      const mapped: SupabaseScanFile[] = files.map((f: any) => ({
        file_path: f.file_path,
        content: f.content || '',
        size: new Blob([f.content || '']).size,
      }));

      setSbFiles(mapped);
      if (!sbProjectName && mapped.length > 0) {
        setSbProjectName('Remote Project');
      }
    } catch (e: any) {
      setSbError(e.message);
    } finally {
      setSbScanning(false);
    }
  };

  const importFromSupabase = async () => {
    if (!user || sbFiles.length === 0) return;
    setSbImporting(true);

    try {
      const { data: project, error: projErr } = await supabase.from('projects').insert({
        name: `${sbProjectName} (pulled)`,
        description: `Pulled from remote Supabase instance`,
        user_id: user.id,
        status: 'active',
      }).select('id').single();

      if (projErr || !project) throw new Error(projErr?.message || 'Failed to create project');

      // Also try to pull plans, chat_messages, project_secrets from the remote
      const remoteClient = createClient(sbUrl, sbServiceKey || sbAnonKey);

      // Insert files
      const fileRows = sbFiles.map(f => ({
        project_id: project.id,
        file_path: f.file_path,
        content: f.content,
      }));

      for (let i = 0; i < fileRows.length; i += 20) {
        const batch = fileRows.slice(i, i + 20);
        const { error: insertErr } = await supabase.from('project_files').insert(batch);
        if (insertErr) console.error('File insert error:', insertErr);
      }

      // Try to pull plans from remote
      const targetProjectId = sbProjectId || undefined;
      if (targetProjectId) {
        const { data: plans } = await remoteClient
          .from('plans')
          .select('sections')
          .eq('project_id', targetProjectId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (plans && plans.length > 0) {
          await supabase.from('plans').insert({
            project_id: project.id,
            sections: plans[0].sections,
          });
        }

        // Try to pull chat history
        const { data: messages } = await remoteClient
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('project_id', targetProjectId)
          .order('created_at', { ascending: true })
          .limit(200);

        if (messages && messages.length > 0) {
          const msgRows = messages.map((m: any) => ({
            project_id: project.id,
            user_id: user.id,
            role: m.role,
            content: m.content,
          }));
          for (let i = 0; i < msgRows.length; i += 20) {
            const batch = msgRows.slice(i, i + 20);
            await supabase.from('chat_messages').insert(batch);
          }
        }
      }

      toast({ title: 'Pull complete', description: `${sbFiles.length} files pulled from remote project` });
      navigate(`/project/${project.id}/edit`);
    } catch (e: any) {
      toast({ title: 'Pull failed', description: e.message, variant: 'destructive' });
    } finally {
      setSbImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="min-h-screen space-bg">
      <Navbar />
      <div className="container max-w-2xl py-8">
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-3.5 w-3.5" />Back</Link>
        </Button>

        <div className="mb-6 flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Import Project</h1>
        </div>

        <Tabs defaultValue="github" className="w-full">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="github" className="flex-1 gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> GitHub
            </TabsTrigger>
            <TabsTrigger value="supabase" className="flex-1 gap-1.5">
              <Database className="h-3.5 w-3.5" /> Pull from Supabase
            </TabsTrigger>
          </TabsList>

          {/* ─── GitHub Tab ─── */}
          <TabsContent value="github">
            <p className="mb-6 text-sm text-muted-foreground">
              Paste a public GitHub repo URL to import its source files. Works best with Imagine Engine-generated projects.
            </p>

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
                      {scanResult.files.map((f) => (
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

            <div className="mt-8 rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Best results with
              </h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Public repos built with React + TypeScript + Tailwind CSS</li>
                <li>• Imagine Engine-exported projects (full compatibility)</li>
                <li>• Projects under 80 source files</li>
                <li>• Standard src/ folder structure</li>
              </ul>
            </div>
          </TabsContent>

          {/* ─── Supabase Pull Tab ─── */}
          <TabsContent value="supabase">
            <p className="mb-6 text-sm text-muted-foreground">
              Pull any Lovable project directly from its Supabase backend. Provide the project's Supabase URL and a key with read access to <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">project_files</code>.
            </p>

            <div className="space-y-3 mb-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Supabase URL</label>
                <Input
                  value={sbUrl}
                  onChange={e => setSbUrl(e.target.value)}
                  placeholder="https://xyzproject.supabase.co"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Service Role Key <span className="text-primary">(recommended)</span> or Anon Key
                </label>
                <Input
                  type="password"
                  value={sbServiceKey}
                  onChange={e => setSbServiceKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Service role key bypasses RLS to read all project files. Find it in Supabase → Settings → API.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Project ID <span className="text-muted-foreground">(optional — pulls latest if empty)</span>
                </label>
                <Input
                  value={sbProjectId}
                  onChange={e => setSbProjectId(e.target.value)}
                  placeholder="uuid of the project to pull"
                />
              </div>
            </div>

            <Button onClick={scanSupabase} disabled={!sbUrl || (!sbAnonKey && !sbServiceKey) || sbScanning} className="w-full mb-6">
              {sbScanning ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
              Scan Remote Project
            </Button>

            {sbError && (
              <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {sbError}
              </div>
            )}

            <AnimatePresence>
              {sbFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <div className="flex items-center justify-between bg-muted/50 px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{sbProjectName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{sbFiles.length} files</span>
                  </div>

                  <ScrollArea className="h-64">
                    <div className="p-2">
                      {sbFiles.map(f => (
                        <div key={f.file_path} className="flex items-center justify-between rounded px-3 py-1.5 text-xs hover:bg-muted/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-mono">{f.file_path}</span>
                          </div>
                          <span className="text-muted-foreground shrink-0 ml-2">{formatSize(f.size)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <Button onClick={importFromSupabase} disabled={sbImporting} className="w-full">
                      {sbImporting ? (
                        <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Pulling {sbFiles.length} files…</>
                      ) : (
                        <><CloudDownload className="mr-1.5 h-4 w-4" />Pull & Start Building</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                What gets pulled
              </h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• All source files from <code className="rounded bg-muted px-1 py-0.5 font-mono">project_files</code></li>
                <li>• Latest plan from <code className="rounded bg-muted px-1 py-0.5 font-mono">plans</code> table</li>
                <li>• Chat history from <code className="rounded bg-muted px-1 py-0.5 font-mono">chat_messages</code></li>
                <li>• Full compatibility — continue editing immediately</li>
              </ul>
              <div className="mt-3 flex items-start gap-1.5 rounded-md bg-primary/5 border border-primary/20 p-2.5">
                <Key className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  Use the <strong className="text-foreground">service role key</strong> from the source project's Supabase dashboard (Settings → API) to bypass RLS and pull all files regardless of ownership.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ImportProject;
