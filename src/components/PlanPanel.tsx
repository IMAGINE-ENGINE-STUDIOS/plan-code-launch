import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CheckCircle2, Loader2, Sparkles, Pencil, Trash2, Rocket, Save,
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

interface PlanPanelProps {
  projectId: string;
  projectName?: string;
  projectDescription?: string;
  onBuildPlan: (queue: string[]) => void;
}

const PlanPanel = ({ projectId, projectName, projectDescription, onBuildPlan }: PlanPanelProps) => {
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

    const context = projectName
      ? `The project is called "${projectName}"${projectDescription ? ` and is described as: "${projectDescription}"` : ''}.`
      : '';

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
              content: `${context}\n\nCreate a structured development plan for the following new features / improvements to this existing project: "${prompt}"\n\nRespond with ONLY a JSON array of sections. Each section has: title (string), content (string describing the section), items (array of task strings). Return 4-8 sections covering the full scope. Example format:\n[{"title":"User Profiles","content":"Add profile management","items":["Profile settings page","Avatar upload","Display name editing"]}]\n\nNo markdown, no code blocks, just the JSON array.`,
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
    const queue = sections.map(s => {
      const tasks = s.items?.join(', ') || '';
      return `Build: ${s.title} — ${s.content}${tasks ? `. Tasks: ${tasks}` : ''}`;
    });
    onBuildPlan(queue);
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4">
        {/* Prompt Input */}
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Describe the features or improvements you want to add to this project.
          </p>
          <div className="flex gap-2">
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generatePlan(); } }}
              placeholder="e.g. Add user profiles with avatar upload, notification settings, and activity history..."
              className="min-h-[50px] resize-none text-sm"
              rows={2}
            />
            <Button onClick={generatePlan} disabled={isGenerating || !prompt.trim()} size="icon" className="shrink-0">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isGenerating && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Generating plan...</span>
          </div>
        )}

        {/* Plan Sections */}
        {sections.length > 0 && !isGenerating && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{sections.length} sections</span>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={savePlan}>
                  <Save className="mr-1 h-3 w-3" /> Save
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={buildPlan}>
                  <Rocket className="mr-1 h-3 w-3" /> Build
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <AnimatePresence>
                {sections.map((section, i) => (
                  <motion.div
                    key={`${section.title}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    {editingIndex === i ? (
                      <div className="space-y-2">
                        <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Section title" className="text-xs font-semibold" />
                        <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="Description" className="text-xs" rows={2} />
                        <Textarea value={editItems} onChange={e => setEditItems(e.target.value)} placeholder="Tasks (one per line)" className="text-xs font-mono" rows={3} />
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs" onClick={saveEdit}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingIndex(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1 flex items-start justify-between">
                          <h4 className="text-sm font-semibold">{section.title}</h4>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(i)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSection(i)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{section.content}</p>
                        {section.items && section.items.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {section.items.map((item, j) => (
                              <li key={j} className="flex items-start gap-1.5 text-xs text-secondary-foreground">
                                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
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
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Sparkles className="mb-2 h-6 w-6" />
            <p className="text-xs">Describe features to plan above</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default PlanPanel;
