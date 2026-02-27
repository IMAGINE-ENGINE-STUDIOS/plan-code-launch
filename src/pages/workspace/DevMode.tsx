import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, File, Folder, Terminal, X,
  Smartphone, Tablet, Monitor, Send, Trash2, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { supabase } from '@/integrations/supabase/client';
import { type TreeNode, getFileContents, buildFileTree } from '@/lib/file-tree';

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

// ─── Console Log Type ───
type LogEntry = {
  id: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'system';
  message: string;
  timestamp: Date;
};

// ─── Viewport presets ───
const viewports = [
  { key: 'mobile', icon: Smartphone, width: 375, label: 'Mobile' },
  { key: 'tablet', icon: Tablet, width: 768, label: 'Tablet' },
  { key: 'desktop', icon: Monitor, width: 1280, label: 'Desktop' },
] as const;

let logIdCounter = 0;

const DevMode = () => {
  const { id: projectId } = useParams();

  // File state
  const fileContents = useMemo(() => getFileContents(), []);
  const fileTree = useMemo(() => buildFileTree(Array.from(fileContents.keys())), [fileContents]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Preview state
  const [viewport, setViewport] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [previewRoute, setPreviewRoute] = useState('/');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Console state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [command, setCommand] = useState('');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Project status
  const [projectStatus, setProjectStatus] = useState<string>('draft');

  // Load project status
  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('status').eq('id', projectId).single()
      .then(({ data }) => { if (data) setProjectStatus(data.status); });
  }, [projectId]);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev.slice(-200), { id: ++logIdCounter, level, message, timestamp: new Date() }]);
  }, []);

  // Initial system log
  useEffect(() => {
    addLog('system', 'Dev console ready. Type /help for commands.');
  }, [addLog]);

  // ─── Command handler ───
  const handleCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    addLog('info', `> ${trimmed}`);

    if (trimmed === '/help') {
      addLog('system', 'Available commands: /status, /build, /deploy, /clear');
    } else if (trimmed === '/status') {
      addLog('system', `Project status: ${projectStatus} | ${new Date().toLocaleTimeString()}`);
    } else if (trimmed === '/build') {
      addLog('system', '🔨 Starting build...');
      if (projectId) {
        await supabase.from('projects').update({ status: 'building' }).eq('id', projectId);
        setProjectStatus('building');
      }
      setTimeout(() => addLog('info', '[build] Compiling TypeScript...'), 500);
      setTimeout(() => addLog('info', '[build] Bundling assets...'), 1200);
      setTimeout(() => {
        addLog('system', '✅ Build completed successfully');
        if (projectId) {
          supabase.from('projects').update({ status: 'compatible' }).eq('id', projectId);
          setProjectStatus('compatible');
        }
      }, 2200);
    } else if (trimmed === '/deploy') {
      addLog('system', '🚀 Deploy initiated. Go to the Publish tab to configure deployment.');
    } else if (trimmed === '/clear') {
      setLogs([]);
    } else {
      addLog('warn', `Unknown command: ${trimmed}. Type /help for commands.`);
    }
  }, [addLog, projectId, projectStatus]);

  const selectedContent = selectedFile ? fileContents.get(selectedFile) ?? '' : '';
  const lines = selectedContent.split('\n');
  const currentViewport = viewports.find(v => v.key === viewport)!;

  const previewUrl = `${window.location.origin}${previewRoute}`;

  const levelColor: Record<string, string> = {
    log: 'text-foreground',
    info: 'text-[hsl(var(--info))]',
    warn: 'text-[hsl(var(--warning))]',
    error: 'text-destructive',
    system: 'text-primary',
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    building: 'bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]',
    compatible: 'bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]',
    published: 'bg-primary/20 text-primary',
    needs_attention: 'bg-destructive/20 text-destructive',
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
        <Circle className="h-2 w-2 fill-primary text-primary" />
        <span className="text-xs font-medium">Dev Environment</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor[projectStatus] ?? ''}`}>
          {projectStatus}
        </Badge>
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

        {/* Editor + Console */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <ResizablePanelGroup direction="vertical">
            {/* Code Editor */}
            <ResizablePanel defaultSize={70} minSize={30}>
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
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Console */}
            <ResizablePanel defaultSize={30} minSize={15}>
              <div className="flex h-full flex-col bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">Console</span>
                    <span className="text-[10px] text-muted-foreground">({logs.length})</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLogs([])}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 font-mono text-xs space-y-0.5">
                    {logs.map(log => (
                      <div key={log.id} className={`flex gap-2 ${levelColor[log.level]}`}>
                        <span className="text-muted-foreground/40 shrink-0">
                          {log.timestamp.toLocaleTimeString('en', { hour12: false })}
                        </span>
                        <span className="break-all">{log.message}</span>
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </div>
                </ScrollArea>
                <form
                  className="flex items-center gap-2 border-t border-border px-3 py-1.5"
                  onSubmit={e => { e.preventDefault(); handleCommand(command); setCommand(''); }}
                >
                  <span className="text-xs text-muted-foreground">{'>'}</span>
                  <Input
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    placeholder="Type a command (/help)"
                    className="h-7 border-0 bg-transparent px-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button variant="ghost" size="icon" type="submit" className="h-6 w-6">
                    <Send className="h-3 w-3" />
                  </Button>
                </form>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        <ResizableHandle />

        {/* Preview */}
        <ResizablePanel defaultSize={40} minSize={20}>
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
              <Input
                value={previewRoute}
                onChange={e => setPreviewRoute(e.target.value)}
                className="h-7 w-32 text-xs font-mono"
                placeholder="/"
              />
              <span className="text-[10px] text-muted-foreground">{currentViewport.width}px</span>
            </div>

            {/* Preview iframe container */}
            <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-4">
              <div
                className="bg-background border border-border rounded-lg overflow-hidden shadow-lg transition-all duration-300"
                style={{ width: `${Math.min(currentViewport.width, 800)}px`, height: '100%' }}
              >
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  className="h-full w-full"
                  title="App Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms"
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
