import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CheckCircle2, Loader2, Send, Sparkles, Pencil, Trash2, Rocket, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { PlanSection } from '@/lib/types';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const PlanMode = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sections, setSections] = useState<PlanSection[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editItems, setEditItems] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing plan
  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('plans')
      .select('sections')
      .eq('project_id', projectId)
      .single()
      .then(({ data }) => {
        if (data?.sections) {
          setSections((data.sections as unknown) as PlanSection[]);
          setHasSaved(true);
        }
      });
  }, [projectId]);

  const generatePlan = async () => {
    if (!prompt.trim() || isGenerating || !session) return;
    setIsGenerating(true);
    setSections([]);

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Create a structured development plan for: "${prompt}"\n\nRespond with ONLY a JSON array of sections. Each section has: title (string), content (string describing the section), items (array of task strings). Return 4-8 sections covering the full scope. Example format:\n[{"title":"Authentication","content":"User auth system","items":["Login page","Signup page","Password reset"]}]\n\nNo markdown, no code blocks, just the JSON array.`,
            },
          ],
          projectId,
        }),
      });

      if (!resp.ok) throw new Error('Failed to generate plan');

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullText += content;
          } catch {}
        }
      }

      // Extract JSON from response
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as PlanSection[];
        setSections(parsed);
        setHasSaved(false);
      } else {
        toast({ title: 'Error', description: 'Could not parse plan. Try again.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlan = useCallback(async () => {
    if (!projectId || !session) return;
    const { error } = hasSaved
      ? await supabase.from('plans').update({ sections: sections as any }).eq('project_id', projectId)
      : await supabase.from('plans').insert({ project_id: projectId, sections: sections as any });
    if (error) {
      toast({ title: 'Error saving plan', description: error.message, variant: 'destructive' });
    } else {
      setHasSaved(true);
      toast({ title: 'Plan saved' });
    }
  }, [projectId, session, sections, hasSaved, toast]);

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditTitle(sections[i].title);
    setEditContent(sections[i].content);
    setEditItems(sections[i].items?.join('\n') || '');
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    setSections(prev =>
      prev.map((s, i) =>
        i === editingIndex
          ? { ...s, title: editTitle, content: editContent, items: editItems.split('\n').filter(Boolean) }
          : s
      )
    );
    setEditingIndex(null);
    setHasSaved(false);
  };

  const removeSection = (i: number) => {
    setSections(prev => prev.filter((_, idx) => idx !== i));
    setHasSaved(false);
  };

  const buildPlan = () => {
    const queue = sections
      .map(s => {
        const tasks = s.items?.join(', ') || '';
        return `Build: ${s.title} — ${s.content}${tasks ? `. Tasks: ${tasks}` : ''}`;
      });
    const encoded = encodeURIComponent(JSON.stringify(queue));
    navigate(`/project/${projectId}/edit?queue=${encoded}`);
  };

  return (
    <div className="container max-w-3xl py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Project Plan</h2>
      </div>

      {/* Prompt Input */}
      <div className="mb-8 rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          Describe what you want to build and the AI will create a structured plan.
        </p>
        <div className="flex gap-2">
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generatePlan(); } }}
            placeholder="e.g. A project management app with boards, tasks, team collaboration, and reporting..."
            className="min-h-[60px] resize-none text-sm"
            rows={2}
          />
          <Button onClick={generatePlan} disabled={isGenerating || !prompt.trim()} className="shrink-0">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isGenerating && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Generating plan...</span>
        </div>
      )}

      {/* Plan Sections */}
      {sections.length > 0 && !isGenerating && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{sections.length} sections</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={savePlan}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
              <Button size="sm" onClick={buildPlan}>
                <Rocket className="mr-1.5 h-3.5 w-3.5" /> Build This Plan
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {sections.map((section, i) => (
                <motion.div
                  key={`${section.title}-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  {editingIndex === i ? (
                    <div className="space-y-3">
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Section title" className="text-sm font-semibold" />
                      <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Description" className="text-sm" rows={2} />
                      <Textarea value={editItems} onChange={e => setEditItems(e.target.value)} placeholder="Tasks (one per line)" className="text-sm font-mono" rows={4} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingIndex(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-2 flex items-start justify-between">
                        <h3 className="font-display font-semibold">{section.title}</h3>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(i)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSection(i)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{section.content}</p>
                      {section.items && section.items.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {section.items.map((item, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-secondary-foreground">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Empty state */}
      {sections.length === 0 && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Sparkles className="mb-3 h-8 w-8" />
          <p className="text-sm">Describe your project above to generate a plan</p>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  );
};

export default PlanMode;
