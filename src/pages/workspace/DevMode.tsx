import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, File, Folder,
  Smartphone, Tablet, Monitor, Circle, Loader2, Wrench, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import SandpackPreview from '@/components/SandpackPreview';
import { type TreeNode, getFileContents, buildFileTree } from '@/lib/file-tree';
import { parseFileChanges } from '@/lib/parse-file-changes';

// ─── File Tree Item ───
const FileTreeItem = ({
  node, depth = 0, selectedPath, onSelect,
}: {
  node: TreeNode; depth?: number; selectedPath: string | null; onSelect: (path: string) => void;
}) => {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = node.type === 'file' && node.path === selectedPath;

  const handleClick = () => {
    if (node.type === 'dir') setOpen(!open);
    else onSelect(node.path);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
          isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'dir' ? (
          open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : <File className="h-3 w-3 text-muted-foreground" />}
        {node.type === 'dir' && <Folder className="h-3 w-3 text-primary" />}
        <span className={node.type === 'dir' ? 'font-medium' : 'text-muted-foreground'}>
          {node.name}
        </span>
      </button>
      {node.type === 'dir' && open && node.children?.map(c => (
        <FileTreeItem key={c.path} node={c} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
};

// ─── Viewport presets ───
const viewports = [
  { key: 'mobile', icon: Smartphone, width: 375, label: 'Mobile' },
  { key: 'tablet', icon: Tablet, width: 768, label: 'Tablet' },
  { key: 'desktop', icon: Monitor, width: 1280, label: 'Desktop' },
] as const;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const MAX_AUTO_FIXES = 3;

const DevMode = () => {
  const { id: projectId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();

  // File state
  const fileContents = useMemo(() => getFileContents(), []);
  const fileTree = useMemo(() => buildFileTree(Array.from(fileContents.keys())), [fileContents]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Preview state
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});

  // Project status
  const [projectStatus, setProjectStatus] = useState<string>('draft');

  // Auto-fix state
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [lastFixedError, setLastFixedError] = useState('');
  const autoFixCountRef = useRef(0);
  const [fixLog, setFixLog] = useState<string[]>([]);

  // Load project status
  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('status').eq('id', projectId).single()
      .then(({ data }) => { if (data) setProjectStatus(data.status); });
  }, [projectId]);

  // Load persisted files
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('project_files')
      .select('file_path, content')
      .eq('project_id', projectId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const files: Record<string, string> = {};
          data.forEach((f: any) => { files[f.file_path] = f.content; });
          setPreviewFiles(files);
        }
      });
  }, [projectId]);

  const selectedContent = selectedFile ? fileContents.get(selectedFile) ?? '' : '';
  const lines = selectedContent.split('\n');
  const currentViewport = viewports.find(v => v.key === viewport)!;

  const statusColor: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    building: 'bg-primary/20 text-primary',
    compatible: 'bg-primary/20 text-primary',
    published: 'bg-primary/20 text-primary',
    needs_attention: 'bg-destructive/20 text-destructive',
  };

  // ─── Auto Error Fix ───
  const handlePreviewError = useCallback(async (error: string) => {
    if (!autoFixEnabled || isAutoFixing || !session) return;
    if (error === lastFixedError) return;
    if (autoFixCountRef.current >= MAX_AUTO_FIXES) {
      setFixLog(prev => [...prev, `⚠ Max auto-fix attempts (${MAX_AUTO_FIXES}) reached. Manual intervention needed.`]);
      toast({
        title: 'Auto-fix limit reached',
        description: 'Reached max auto-fix attempts. Switch to Edit mode to fix manually.',
        variant: 'destructive',
      });
      return;
    }

    setLastFixedError(error);
    setIsAutoFixing(true);
    autoFixCountRef.current += 1;

    const fixNum = autoFixCountRef.current;
    setFixLog(prev => [...prev, `🔧 Fix #${fixNum}: Detected error — ${error.slice(0, 120)}…`]);

    const fileList = Object.keys(previewFiles).slice(0, 20).join(', ');
    const fileContext = Object.entries(previewFiles)
      .slice(0, 10)
      .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 3000)}`)
      .join('\n\n');

    const fixPrompt = `The preview is showing an error. Fix it without changing the app's features, structure, or UI design. Preserve all existing functionality.\n\nError: ${error.slice(0, 500)}\n\nCurrent files: ${fileList}\n\nFile contents:\n${fileContext}\n\nIMPORTANT: Only fix the error. Do NOT remove features, components, or UI elements. Output the corrected file(s) only using fenced code blocks with file path like \`\`\`tsx:src/App.tsx`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: fixPrompt }],
          projectId,
        }),
      });

      if (!resp.ok || !resp.body) {
        setFixLog(prev => [...prev, `❌ Fix #${fixNum} failed: HTTP ${resp.status}`]);
        setIsAutoFixing(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Apply fixes
      const fixes = parseFileChanges(fullResponse);
      const fixedCount = Object.keys(fixes).length;
      if (fixedCount > 0) {
        setPreviewFiles(prev => ({ ...prev, ...fixes }));
        // Persist
        if (projectId && session?.user?.id) {
          Object.entries(fixes).forEach(async ([file_path, fileContent]) => {
            await supabase.from('project_files').upsert(
              { project_id: projectId, file_path, content: fileContent },
              { onConflict: 'project_id,file_path' }
            );
          });
        }
        setFixLog(prev => [...prev, `✅ Fix #${fixNum} applied: ${fixedCount} file(s) updated`]);
      } else {
        setFixLog(prev => [...prev, `⚠ Fix #${fixNum}: AI responded but no code changes detected`]);
      }
    } catch (e: any) {
      setFixLog(prev => [...prev, `❌ Fix #${fixNum} error: ${e.message}`]);
    } finally {
      setIsAutoFixing(false);
    }
  }, [autoFixEnabled, isAutoFixing, session, lastFixedError, previewFiles, projectId, toast]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
        <Circle className="h-2 w-2 fill-primary text-primary" />
        <span className="text-xs font-medium">Dev Environment</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor[projectStatus] ?? ''}`}>
          {projectStatus}
        </Badge>
        <div className="flex-1" />
        {/* Auto-fix controls */}
        <button
          onClick={() => { setAutoFixEnabled(prev => !prev); autoFixCountRef.current = 0; setLastFixedError(''); }}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            autoFixEnabled ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
          }`}
        >
          <Wrench className="h-3 w-3" />
          Auto-fix {autoFixEnabled ? 'ON' : 'OFF'}
        </button>
        {isAutoFixing && (
          <span className="flex items-center gap-1 text-[10px] text-primary">
            <Loader2 className="h-3 w-3 animate-spin" /> Fixing…
          </span>
        )}
        {autoFixCountRef.current > 0 && !isAutoFixing && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            {autoFixCountRef.current}/{MAX_AUTO_FIXES} fixes used
          </span>
        )}
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Explorer */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col">
            <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Explorer
            </div>
            <ScrollArea className="flex-1 px-1">
              {fileTree.map(node => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  selectedPath={selectedFile}
                  onSelect={setSelectedFile}
                />
              ))}
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Code Editor */}
        <ResizablePanel defaultSize={35} minSize={20}>
          <div className="flex h-full flex-col">
            {selectedFile ? (
              <>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <File className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">{selectedFile}</span>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="p-4 text-xs leading-5">
                    <code>
                      {lines.map((line, i) => (
                        <div key={i} className="flex">
                          <span className="inline-block w-10 text-right pr-4 text-muted-foreground/50 select-none">
                            {i + 1}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">Select a file to view</p>
              </div>
            )}

            {/* Fix log (compact, replaces console) */}
            {fixLog.length > 0 && (
              <div className="border-t border-border bg-card">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">Auto-fix Log</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setFixLog([])}>
                    <span className="text-[10px]">✕</span>
                  </Button>
                </div>
                <ScrollArea className="max-h-28">
                  <div className="px-3 pb-2 font-mono text-[10px] text-muted-foreground space-y-0.5">
                    {fixLog.map((entry, i) => (
                      <div key={i}>{entry}</div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Live Preview with Sandpack */}
        <ResizablePanel defaultSize={50} minSize={25}>
          <div className="flex h-full flex-col">
            {/* Preview toolbar */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
              {viewports.map(vp => (
                <Button
                  key={vp.key}
                  variant={viewport === vp.key ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setViewport(vp.key as typeof viewport)}
                  title={vp.label}
                >
                  <vp.icon className="h-3.5 w-3.5" />
                </Button>
              ))}
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground">{currentViewport.width}px</span>
            </div>

            {/* Preview */}
            <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-4">
              <div
                className="bg-background border border-border rounded-lg overflow-hidden shadow-lg transition-all duration-300 h-full"
                style={{ width: `${Math.min(currentViewport.width, 800)}px` }}
              >
                <SandpackPreview
                  files={previewFiles}
                  projectName="preview"
                  onError={handlePreviewError}
                />
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DevMode;
