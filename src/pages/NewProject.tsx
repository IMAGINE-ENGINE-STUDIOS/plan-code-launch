import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { useWizard } from '@/contexts/WizardContext';
import type { WizardAnswers } from '@/lib/types';

const steps = [
  {
    question: 'What are you building?',
    key: 'buildType' as const,
    multi: false,
    options: ['SaaS / Dashboard', 'Marketplace', 'CRM / Internal Tool', 'Booking Platform', 'AI App', 'E-Commerce', 'Landing Page', 'Other'],
  },
  {
    question: 'Do you already have code?',
    key: 'codeSource' as const,
    multi: false,
    options: ['Starting from scratch', 'GitHub repo', 'Existing project', 'ZIP / Files', 'Not sure'],
  },
  {
    question: 'What matters most right now?',
    key: 'priorities' as const,
    multi: true,
    max: 2,
    options: ['Lowest cost', 'Fast launch', 'Beautiful UI', 'Scalability', 'Security', 'Advanced features'],
  },
  {
    question: 'What do you need on day one?',
    key: 'dayOneFeatures' as const,
    multi: true,
    options: ['Auth', 'Database', 'Admin panel', 'Payments', 'File uploads', 'AI features', 'Custom domain', 'Team collaboration'],
  },
];

const NewProject = () => {
  const navigate = useNavigate();
  const { setAnswers: saveToContext } = useWizard();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WizardAnswers>({ buildType: '', codeSource: '', priorities: [], dayOneFeatures: [] });

  const current = steps[step];

  const toggle = (option: string) => {
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
    const val = answers[current.key];
    return Array.isArray(val) ? val.includes(option) : val === option;
  };

  const canProceed = () => {
    const val = answers[current.key];
    return Array.isArray(val) ? val.length > 0 : !!val;
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      saveToContext(answers);
      navigate('/project/new/plan');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container flex max-w-2xl flex-col items-center py-12">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 w-10 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
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
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex w-full justify-between">
          <Button variant="ghost" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Back
          </Button>
          <Button onClick={handleNext} disabled={!canProceed()}>
            {step === 3 ? (
              <><Sparkles className="mr-1.5 h-4 w-4" />Generate Plan</>
            ) : (
              <>Next<ArrowRight className="ml-1.5 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewProject;
