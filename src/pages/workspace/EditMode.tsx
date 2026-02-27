import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Trash2, FileCode, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import StackBlitzPreview, { type StackBlitzPreviewHandle } from '@/components/StackBlitzPreview';
import { parseFileChanges, hasFileChanges } from '@/lib/parse-file-changes';

type Msg = { role: 'user' | 'assistant'; content: string };
type DbMsg = { id: string; role: string; content: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const suggestions = [
  'Build the homepage with a hero section and navigation',
  'Add a user authentication page with login and signup',
  'Create a dashboard with data cards and charts',
];

type ProjectData = {
  name: string;
  description: string;
  day_one_features: string[];
};

const EditMode = () => {
  const { id: projectId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [changedFiles, setChangedFiles] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<StackBlitzPreviewHandle>(null);

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

  // Load persisted messages
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
          // Collect changed files from existing messages
          const allFiles = new Set<string>();
          data.forEach((m: DbMsg) => {
            if (m.role === 'assistant') {
              Object.keys(parseFileChanges(m.content)).forEach(f => allFiles.add(f));
            }
          });
          setChangedFiles(Array.from(allFiles));
        }
      });
  }, [projectId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const applyFilesToPreview = useCallback(
    async (content: string) => {
      const files = parseFileChanges(content);
      if (Object.keys(files).length === 0) return;

      // Update changed files list
      setChangedFiles(prev => {
        const updated = new Set(prev);
        Object.keys(files).forEach(f => updated.add(f));
        return Array.from(updated);
      });

      // Apply to StackBlitz
      if (previewRef.current) {
        try {
          await previewRef.current.applyFileChanges(files);
        } catch (err) {
          console.error('Failed to apply files to preview:', err);
        }
      }
    },
    []
  );

  const sendMessage = async (text: string) => {
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

      // Auto-apply file changes to preview
      await applyFilesToPreview(assistantSoFar);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsStreaming(false);
    }
  };

  const clearChat = async () => {
    if (!projectId) return;
    await supabase.from('chat_messages').delete().eq('project_id', projectId);
    setMessages([]);
    setChangedFiles([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)]">
      <ResizablePanelGroup direction="horizontal">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={30} minSize={20}>
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
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 text-sm ${
                        m.role === 'user' ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          {m.role === 'user' ? 'You' : 'AI'}
                        </p>
                        {m.role === 'assistant' && hasFileChanges(m.content) && (
                          <span className="flex items-center gap-0.5 text-xs text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            Applied
                          </span>
                        )}
                      </div>
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Building...
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what to build… (Enter to send)"
                  className="min-h-[40px] max-h-[120px] resize-none text-sm"
                  rows={1}
                />
                <Button size="icon" onClick={() => sendMessage(input)} disabled={isStreaming || !input.trim()}>
                  {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Live Preview Panel */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border px-4 py-2">
              <span className="text-sm font-semibold">Live Preview</span>
              <span className="text-xs text-muted-foreground">
                {project?.name || 'Loading...'}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              {project ? (
                <StackBlitzPreview
                  ref={previewRef}
                  projectName={project.name}
                  projectDescription={project.description}
                  features={project.day_one_features}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Changed Files Sidebar */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-4 py-2">
              <span className="text-sm font-semibold">Changed Files</span>
              <span className="ml-1.5 text-xs text-muted-foreground">({changedFiles.length})</span>
            </div>
            <ScrollArea className="flex-1 p-2">
              {changedFiles.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No files changed yet. Start chatting to build your app.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {changedFiles.map(f => (
                    <div
                      key={f}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
                    >
                      <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default EditMode;
