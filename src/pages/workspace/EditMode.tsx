import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Trash2, FileCode, Smartphone, Tablet, Monitor, Loader2, Sparkles, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };
type DbMsg = { id: string; role: string; content: string; created_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const changedFiles = ['src/pages/Dashboard.tsx', 'src/components/MetricsCard.tsx', 'src/lib/api.ts'];

const suggestions = [
  'Add a login page with email/password',
  'Create a dashboard with metrics cards',
  'Set up a REST API for user data',
];

const viewports = [
  { value: '375', label: 'Mobile', icon: Smartphone },
  { value: '768', label: 'Tablet', icon: Tablet },
  { value: '1280', label: 'Desktop', icon: Monitor },
] as const;

const EditMode = () => {
  const { id: projectId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewport, setViewport] = useState('1280');
  const [previewRoute, setPreviewRoute] = useState('/');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          setMessages(data.filter((m: DbMsg) => m.role === 'user' || m.role === 'assistant').map((m: DbMsg) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })));
        }
      });
  }, [projectId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveMessage = useCallback(async (role: string, content: string) => {
    if (!projectId || !session?.user?.id) return;
    await supabase.from('chat_messages').insert({
      project_id: projectId,
      user_id: session.user.id,
      role,
      content,
    });
  }, [projectId, session]);

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
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
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
                  <p className="text-sm text-muted-foreground">Ask me anything about your project</p>
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
                    <div key={i} className={`rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-muted/50' : 'bg-primary/5 border border-primary/10'}`}>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{m.role === 'user' ? 'You' : 'AI'}</p>
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
                      Thinking...
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-border p-3">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe changes… (Enter to send)"
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

        {/* Preview Panel */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-border px-4 py-2">
              <ToggleGroup type="single" value={viewport} onValueChange={v => v && setViewport(v)} size="sm">
                {viewports.map(vp => (
                  <ToggleGroupItem key={vp.value} value={vp.value} aria-label={vp.label}>
                    <vp.icon className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={previewRoute}
                  onChange={e => setPreviewRoute(e.target.value)}
                  className="h-6 border-0 bg-transparent p-0 text-xs focus-visible:ring-0"
                  placeholder="/"
                />
              </div>
              <span className="text-xs text-muted-foreground">{viewport}px</span>
            </div>
            <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/20 p-4">
              <div
                className="h-full rounded-lg border border-border bg-background shadow-sm transition-all duration-300"
                style={{ width: `${Math.min(parseInt(viewport), 1280)}px`, maxWidth: '100%' }}
              >
                <iframe
                  src={`${window.location.origin}${previewRoute}`}
                  className="h-full w-full rounded-lg"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  title="Preview"
                />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Changed Files Sidebar */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-4 py-2">
              <span className="text-sm font-semibold">Changed Files</span>
            </div>
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-0.5">
                {changedFiles.map(f => (
                  <div key={f} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
                    <FileCode className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default EditMode;
