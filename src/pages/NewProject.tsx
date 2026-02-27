import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Navbar from '@/components/Navbar';
import { useWizard } from '@/contexts/WizardContext';
import { useToast } from '@/hooks/use-toast';
import type { WizardAnswers } from '@/lib/types';

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-prompt`;

const allSteps = [
  {
    key: 'buildType' as const,
    question: 'What are you building?',
    multi: false,
    options: ['SaaS / Dashboard', 'Marketplace', 'CRM / Internal Tool', 'Booking Platform', 'AI App', 'E-Commerce', 'Landing Page', 'Other'],
  },
  {
    key: 'codeSource' as const,
    question: 'Do you already have code?',
    multi: false,
    options: ['Starting from scratch', 'GitHub repo', 'Existing project', 'ZIP / Files', 'Not sure'],
  },
  {
    key: 'priorities' as const,
    question: 'What matters most right now?',
    multi: true,
    max: 2,
    options: ['Lowest cost', 'Fast launch', 'Beautiful UI', 'Scalability', 'Security', 'Advanced features'],
  },
  {
    key: 'dayOneFeatures' as const,
    question: 'What do you need on day one?',
    multi: true,
    options: ['Auth', 'Database', 'Admin panel', 'Payments', 'File uploads', 'AI features', 'Custom domain', 'Team collaboration'],
  },
];

type Phase = 'prompt' | 'analyzing' | 'questions';

const NewProject = () => {
  const navigate = useNavigate();
  const { setAnswers: saveToContext } = useWizard();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>('prompt');
  const [prompt, setPrompt] = useState('');
  const [answers, setAnswers] = useState<WizardAnswers>({
    buildType: '', codeSource: '', priorities: [], dayOneFeatures: [],
  });
  const [remainingSteps, setRemainingSteps] = useState(allSteps);
  const [stepIdx, setStepIdx] = useState(0);

  const analyzePrompt = async () => {
    if (!prompt.trim()) return;
    setPhase('analyzing');

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Analysis failed' }));
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
        setPhase('prompt');
        return;
      }

      const { extracted, missingQuestions } = await resp.json();

      // Merge extracted answers
      const merged: WizardAnswers = {
        buildType: extracted.buildType || '',
        codeSource: extracted.codeSource || '',
        priorities: extracted.priorities || [],
        dayOneFeatures: extracted.dayOneFeatures || [],
        projectName: extracted.projectName || undefined,
        description: extracted.description || undefined,
        prompt: prompt.trim(),
      };
      setAnswers(merged);

      // Filter to only missing questions
      const missing = (missingQuestions || []) as string[];
      const filtered = allSteps.filter(s => missing.includes(s.key));

      if (filtered.length === 0) {
        // All extracted — go straight to plan
        saveToContext(merged);
        navigate('/project/new/plan');
      } else {
        setRemainingSteps(filtered);
        setStepIdx(0);
        setPhase('questions');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      setPhase('prompt');
    }
  };

  const current = remainingSteps[stepIdx];

  const toggle = (option: string) => {
    if (!current) return;
    const key = current.key;
    if (current.multi) {
      const arr = answers[key] as string[];
      const max = (current as any).max;
      if (arr.includes(option)) {
        setAnswers({ ...answers, [key]: arr.filter(o => o !== option) });
      } else if (!max || arr.length < max) {
        setAnswers({ ...answers, [key]: [...arr, option] });
      }
    } else {
      setAnswers({ ...answers, [key]: option });
    }
  };

  const isSelected = (option: string) => {
    if (!current) return false;
    const val = answers[current.key];
    return Array.isArray(val) ? val.includes(option) : val === option;
  };

  const canProceed = () => {
    if (!current) return false;
    const val = answers[current.key];
    return Array.isArray(val) ? val.length > 0 : !!val;
  };

  const handleNext = () => {
    if (stepIdx < remainingSteps.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      saveToContext(answers);
      navigate('/project/new/plan');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      analyzePrompt();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container flex max-w-2xl flex-col items-center py-12">
        <AnimatePresence mode="wait">
          {/* Phase 1: Prompt */}
          {phase === 'prompt' && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full"
            >
              <h1 className="mb-2 text-center font-display text-2xl font-bold">What do you want to build?</h1>
              <p className="mb-8 text-center text-sm text-muted-foreground">
                Describe your project and we'll figure out the rest
              </p>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. I want to build a SaaS dashboard with user auth, Stripe payments, and an admin panel for managing users..."
                className="min-h-[140px] text-sm"
                autoFocus
              />
              <div className="mt-4 flex justify-end">
                <Button onClick={analyzePrompt} disabled={!prompt.trim()} size="lg">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze & Continue
                </Button>
              </div>
            </motion.div>
          )}

          {/* Phase 2: Analyzing */}
          {phase === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-16"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your project description…</p>
            </motion.div>
          )}

          {/* Phase 3: Selective questions */}
          {phase === 'questions' && current && (
            <motion.div
              key={`q-${stepIdx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {/* Progress */}
              <div className="mb-8 flex items-center gap-2 justify-center">
                {remainingSteps.map((_, i) => (
                  <div key={i} className={`h-1.5 w-10 rounded-full transition-colors ${i <= stepIdx ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>

              <p className="mb-2 text-center text-xs text-muted-foreground">
                We couldn't determine this from your description:
              </p>
              <h1 className="mb-1 text-center font-display text-2xl font-bold">{current.question}</h1>
              <p className="mb-8 text-center text-sm text-muted-foreground">
                {current.multi ? `Select ${(current as any).max ? `up to ${(current as any).max}` : 'all that apply'}` : 'Choose one'}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {current.options.map(option => (
                  <button
                    key={option}
                    onClick={() => toggle(option)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all ${
                      isSelected(option) ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {option}
                    {isSelected(option) && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex w-full justify-between">
                <Button variant="ghost" onClick={() => stepIdx > 0 ? setStepIdx(stepIdx - 1) : setPhase('prompt')}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />Back
                </Button>
                <Button onClick={handleNext} disabled={!canProceed()}>
                  {stepIdx === remainingSteps.length - 1 ? (
                    <><Sparkles className="mr-1.5 h-4 w-4" />Generate Plan</>
                  ) : (
                    <>Next<ArrowRight className="ml-1.5 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NewProject;
