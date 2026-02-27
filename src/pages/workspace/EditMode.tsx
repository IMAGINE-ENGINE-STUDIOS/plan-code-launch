import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Send, Trash2, Loader2, Sparkles, CheckCircle2,
  Maximize2, Minimize2, Monitor, Tablet, Smartphone, Terminal, X, MousePointer2, AlertTriangle, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import SandpackPreview from '@/components/SandpackPreview';
import CodeViewer from '@/components/CodeViewer';
import CommandQueue from '@/components/CommandQueue';
import { parseFileChanges, hasFileChanges } from '@/lib/parse-file-changes';
import { stripCodeBlocks } from '@/lib/strip-code-blocks';

type Msg = { role: 'user' | 'assistant'; content: string };
type DbMsg = { id: string; role: string; content: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const suggestions = [
  'Build the homepage with a hero section and navigation',
  'Add a user authentication page with login and signup',
  'Create a dashboard with data cards and charts',
];

type ProjectData = { name: string; description: string; day_one_features: string[] };

type Viewport = { label: string; width: string; icon: typeof Monitor };
const VIEWPORTS: Viewport[] = [
  { label: 'Desktop', width: '100%', icon: Monitor },
  { label: 'Tablet', width: '768px', icon: Tablet },
  { label: 'Mobile', width: '375px', icon: Smartphone },
];

const EditMode = () => {
  const { id: projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeViewport, setActiveViewport] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);
  const [lastFixedError, setLastFixedError] = useState('');
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const autoFixCountRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<(text: string) => Promise<void>>();

  // Load project data
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('projects')
      .select('name, description, day_one_features')
      .eq('id', projectId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProject({
            name: data.name,
            description: data.description,
            day_one_features: data.day_one_features || [],
          });
        }
      });
  }, [projectId]);

  // Load persisted files from project_files table
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

  // Load persisted messages + replay file changes on top
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(
            data
              .filter((m: DbMsg) => m.role === 'user' || m.role === 'assistant')
              .map((m: DbMsg) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
          );
          const allFiles: Record<string, string> = {};
          data.forEach((m: DbMsg) => {
            if (m.role === 'assistant') Object.assign(allFiles, parseFileChanges(m.content));
          });
          if (Object.keys(allFiles).length > 0) setPreviewFiles(prev => ({ ...prev, ...allFiles }));
        }
      });
  }, [projectId]);

  // Load queue from URL params (from PlanMode)
  useEffect(() => {
    const queueParam = searchParams.get('queue');
    if (queueParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(queueParam));
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQueue(parsed);
          // Clean up URL
          searchParams.delete('queue');
          setSearchParams(searchParams, { replace: true });
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Console messages from Sandpack iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'console' && e.data?.log) {
        setConsoleLogs(prev => [...prev.slice(-199), `[${e.data.method || 'log'}] ${e.data.log}`]);
      }
      // Visual select mode
      if (e.data?.type === 'element-selected' && selectMode) {
        const { tag, text, classes } = e.data;
        const desc = text ? ` with text "${text.slice(0, 50)}"` : '';
        const cls = classes ? ` (classes: ${classes})` : '';
        setInput(`Edit the <${tag}>${desc}${cls} — `);
        setSelectMode(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectMode]);

  // Auto-process queue when streaming finishes
  useEffect(() => {
    if (!isStreaming && queue.length > 0 && sendRef.current) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      sendRef.current(next);
    }
  }, [isStreaming, queue]);

  const saveMessage = useCallback(
    async (role: string, content: string) => {
      if (!projectId || !session?.user?.id) return;
      await supabase.from('chat_messages').insert({
        project_id: projectId,
        user_id: session.user.id,
        role,
        content,
      });
    },
    [projectId, session]
  );

  const applyFilesToPreview = useCallback((content: string) => {
    const files = parseFileChanges(content);
    if (Object.keys(files).length === 0) return;
    setPreviewFiles(prev => ({ ...prev, ...files }));
    // Persist changed files to project_files
    if (projectId && session?.user?.id) {
      Object.entries(files).forEach(async ([file_path, fileContent]) => {
        await supabase.from('project_files').upsert(
          { project_id: projectId, file_path, content: fileContent },
          { onConflict: 'project_id,file_path' }
        );
      });
    }
  }, [projectId, session]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !session) return;

    const userMsg: Msg = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    await saveMessage('user', userMsg.content);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          projectId,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        toast({ title: 'Error', description: err.error || `Error ${resp.status}`, variant: 'destructive' });
        setIsStreaming(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            if (content) upsertAssistant(content);
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      await saveMessage('assistant', assistantSoFar);
      applyFilesToPreview(assistantSoFar);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, isStreaming, session, projectId, saveMessage, applyFilesToPreview, toast]);

  // Keep ref updated
  useEffect(() => { sendRef.current = sendMessage; }, [sendMessage]);

  // Auto-start queue processing on mount if queue loaded from URL
  useEffect(() => {
    if (queue.length > 0 && !isStreaming && messages.length === 0 && sendRef.current) {
      const timer = setTimeout(() => {
        if (queue.length > 0 && sendRef.current) {
          const next = queue[0];
          setQueue(prev => prev.slice(1));
          sendRef.current(next);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [queue, isStreaming, messages.length]);

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    if (isStreaming) {
      // Add to queue instead of blocking
      setQueue(prev => [...prev, text.trim()]);
      setInput('');
      toast({ title: 'Queued', description: `Added to queue (position ${queue.length + 1})` });
    } else {
      sendMessage(text);
    }
  };

  const clearChat = async () => {
    if (!projectId) return;
    await supabase.from('chat_messages').delete().eq('project_id', projectId);
    setMessages([]);
    setPreviewFiles({});
    setConsoleLogs([]);
    setQueue([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  const getFileCount = (content: string) => Object.keys(parseFileChanges(content)).length;

  const removeFromQueue = (index: number) => setQueue(prev => prev.filter((_, i) => i !== index));

  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    // Post message to Sandpack iframe
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        iframe.contentWindow?.postMessage({ type: 'toggle-select-mode', active: !selectMode }, '*');
      } catch {}
    });
  };

  // ─── Auto Error Correction ───
  const MAX_AUTO_FIXES = 3;

  const handlePreviewError = useCallback((error: string) => {
    if (!autoFixEnabled || isStreaming || isAutoFixing) return;
    if (error === lastFixedError) return; // Don't retry the same error
    if (autoFixCountRef.current >= MAX_AUTO_FIXES) {
      toast({
        title: 'Auto-fix limit reached',
        description: 'Reached max auto-fix attempts. Please fix manually or describe the issue.',
        variant: 'destructive',
      });
      return;
    }

    // Build a list of current file names for context
    const fileList = Object.keys(previewFiles).slice(0, 20).join(', ');
    const fixPrompt = `The preview is showing an error. Fix it without changing the app's features, structure, or UI design. Preserve all existing functionality.\n\nError: ${error.slice(0, 500)}\n\nCurrent files: ${fileList}\n\nIMPORTANT: Only fix the error. Do NOT remove features, components, or UI elements. Output the corrected file(s) only.`;

    setLastFixedError(error);
    setIsAutoFixing(true);
    autoFixCountRef.current += 1;

    // Add auto-fix message to chat visually
    setConsoleLogs(prev => [...prev.slice(-199), `[auto-fix] Detected error, attempting fix #${autoFixCountRef.current}…`]);

    // Queue the fix (will run after current streaming if any)
    if (sendRef.current) {
      sendRef.current(fixPrompt).finally(() => setIsAutoFixing(false));
    } else {
      setIsAutoFixing(false);
    }
  }, [autoFixEnabled, isStreaming, isAutoFixing, lastFixedError, previewFiles, toast]);

  // Reset auto-fix counter when user sends a manual message
  const handleSubmitWithReset = (text: string) => {
    autoFixCountRef.current = 0;
    setLastFixedError('');
    handleSubmit(text);
  };

  const vp = VIEWPORTS[activeViewport];

  // ─── Fullscreen Preview ───
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{project?.name || 'Preview'}</span>
            <span className="text-xs text-muted-foreground">— {vp.label}</span>
          </div>
          <div className="flex items-center gap-1">
            {VIEWPORTS.map((v, i) => (
              <Button key={v.label} variant={i === activeViewport ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setActiveViewport(i)} title={v.label}>
                <v.icon className="h-3.5 w-3.5" />
              </Button>
            ))}
            <div className="mx-2 h-4 w-px bg-border" />
            <Button variant={showConsole ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setShowConsole(!showConsole)} title="Console">
              <Terminal className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-start overflow-hidden bg-muted/30 p-4">
          <div className="h-full overflow-hidden rounded-lg border border-border shadow-2xl transition-all duration-300" style={{ width: vp.width, maxWidth: '100%' }}>
            {project && <SandpackPreview files={previewFiles} projectName={project.name} onError={handlePreviewError} />}
          </div>
        </div>
        {showConsole && (
          <div className="border-t border-border bg-card">
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Console</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConsoleLogs([])}><Trash2 className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowConsole(false)}><X className="h-3 w-3" /></Button>
              </div>
            </div>
            <ScrollArea className="h-40">
              <div className="px-4 pb-2 font-mono text-[11px] text-muted-foreground">
                {consoleLogs.length === 0 ? <p className="py-4 text-center">No console output</p> : consoleLogs.map((log, i) => <div key={i} className="border-b border-border/30 py-1 last:border-0">{log}</div>)}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  }

  // ─── Normal Layout ───
  return (
    <div className="h-[calc(100vh-10rem)]">
      <ResizablePanelGroup direction="horizontal">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={25} minSize={18}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-semibold">AI Chat</span>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 py-12">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Describe what to build</p>
                  <div className="flex flex-col gap-2">
                    {suggestions.map(s => (
                      <button key={s} onClick={() => handleSubmitWithReset(s)} className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m, i) => {
                    const fileCount = m.role === 'assistant' ? getFileCount(m.content) : 0;
                    const displayContent = m.role === 'assistant' ? stripCodeBlocks(m.content) : m.content;
                    return (
                      <div key={i} className={`rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'}`}>
                        <div className="mb-1 flex items-center gap-1.5">
                          <p className="text-xs font-medium text-muted-foreground">{m.role === 'user' ? 'You' : 'AI'}</p>
                          {fileCount > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              <CheckCircle2 className="h-3 w-3" />{fileCount} file{fileCount > 1 ? 's' : ''} applied
                            </span>
                          )}
                        </div>
                        {m.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{displayContent}</ReactMarkdown></div>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                    );
                  })}
                  {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{isAutoFixing ? 'Auto-fixing error…' : 'Building...'}
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            {/* Command Queue */}
            <CommandQueue queue={queue} onRemove={removeFromQueue} onClear={() => setQueue([])} />

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitWithReset(input); } }}
                  placeholder={isStreaming ? 'Type to queue next prompt…' : 'Describe what to build… (Enter to send)'}
                  className="min-h-[40px] max-h-[120px] resize-none text-sm"
                  rows={1}
                />
                <Button size="icon" onClick={() => handleSubmitWithReset(input)} disabled={!input.trim()}>
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              {isStreaming && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {isAutoFixing ? '🔧 Auto-fixing detected error…' : 'AI is building… new prompts will be queued automatically'}
                </p>
              )}
              {/* Auto-fix toggle */}
              <div className="mt-2 flex items-center justify-between">
                <button
                  onClick={() => setAutoFixEnabled(prev => !prev)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    autoFixEnabled
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <Wrench className="h-3 w-3" />
                  Auto-fix {autoFixEnabled ? 'ON' : 'OFF'}
                </button>
                {autoFixCountRef.current > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <AlertTriangle className="h-3 w-3" />
                    {autoFixCountRef.current}/{MAX_AUTO_FIXES} fixes used
                  </span>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Live Preview */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">Preview</span>
                <span className="text-xs text-muted-foreground">{vp.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {VIEWPORTS.map((v, i) => (
                  <Button key={v.label} variant={i === activeViewport ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setActiveViewport(i)} title={v.label}>
                    <v.icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
                <div className="mx-1.5 h-4 w-px bg-border" />
                <Button
                  variant={selectMode ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleSelectMode}
                  title="Select element to edit"
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant={showConsole ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setShowConsole(!showConsole)} title="Console">
                  <Terminal className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsFullscreen(true)} title="Fullscreen">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Select mode banner */}
            {selectMode && (
              <div className="flex items-center justify-between bg-primary/10 px-4 py-1.5 text-xs text-primary">
                <span className="flex items-center gap-1.5">
                  <MousePointer2 className="h-3 w-3" />
                  Click an element in the preview to target it for editing
                </span>
                <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px]" onClick={() => setSelectMode(false)}>
                  Cancel
                </Button>
              </div>
            )}

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-1 items-start justify-center overflow-hidden bg-muted/20 p-2">
                <div className="h-full overflow-hidden rounded-lg border border-border transition-all duration-300" style={{ width: vp.width, maxWidth: '100%' }}>
                  {project ? (
                    <SandpackPreview files={previewFiles} projectName={project.name} onError={handlePreviewError} />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  )}
                </div>
              </div>

              {showConsole && (
                <div className="border-t border-border bg-card">
                  <div className="flex items-center justify-between px-4 py-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Console</span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConsoleLogs([])}><Trash2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowConsole(false)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <ScrollArea className="h-32">
                    <div className="px-4 pb-2 font-mono text-[11px] text-muted-foreground">
                      {consoleLogs.length === 0 ? <p className="py-3 text-center">No console output</p> : consoleLogs.map((log, i) => <div key={i} className="border-b border-border/30 py-1 last:border-0">{log}</div>)}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Code Viewer */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <CodeViewer files={previewFiles} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default EditMode;
