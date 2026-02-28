import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, FileText, Rocket, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import { useWizard } from '@/contexts/WizardContext';
import { useAuth } from '@/contexts/AuthContext';
import { generatePlan } from '@/lib/generate-plan';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const PlanReview = () => {
  const navigate = useNavigate();
  const { answers } = useWizard();
  const { user } = useAuth();
  const { toast } = useToast();
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (!answers.buildType && !answers.prompt) {
      navigate('/new-project', { replace: true });
    }
  }, [answers.buildType, answers.prompt, navigate]);

  if (!answers.buildType && !answers.prompt) {
    return null;
  }

  const plan = generatePlan(answers);

  const handleBuild = async () => {
    if (!user) return;
    setBuilding(true);

    try {
      // Insert project
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: answers.projectName || `${answers.buildType} Project`,
          description: answers.description || `Built from ${answers.codeSource}`,
          build_type: answers.buildType,
          code_source: answers.codeSource,
          priorities: answers.priorities,
          day_one_features: answers.dayOneFeatures,
        })
        .select()
        .single();

      if (projErr) throw projErr;

      // Insert plan
      const { error: planErr } = await supabase
        .from('plans')
        .insert({
          project_id: project.id,
          sections: plan as any,
        });

      if (planErr) throw planErr;

      // Build a comprehensive build prompt from the plan
      const buildCommands: string[] = [];

      // First command: Build the complete app foundation
      const features = plan.find(s => s.title === 'MVP Features');
      const routes = plan.find(s => s.title === 'Routes');
      const summary = plan.find(s => s.title === 'Summary');
      const dataModel = plan.find(s => s.title === 'Data Model');

      const featureList = features?.items?.join(', ') || answers.dayOneFeatures.join(', ') || 'core app';
      const routeList = routes?.items?.join('; ') || '';
      const dataList = dataModel?.items?.join(', ') || '';

      // Single comprehensive build prompt
      const buildPrompt = [
        `Build the complete "${answers.projectName || answers.buildType}" application.`,
        summary?.content ? `\n\nOverview: ${summary.content}` : '',
        `\n\nRequired features (ALL must be fully functional with real handlers, no placeholder buttons):\n- ${features?.items?.join('\n- ') || featureList}`,
        routeList ? `\n\nRoutes to implement:\n- ${routes?.items?.join('\n- ')}` : '',
        dataList ? `\n\nData model:\n- ${dataModel?.items?.join('\n- ')}` : '',
        answers.description ? `\n\nApp description: ${answers.description}` : '',
        `\n\nIMPORTANT: Build a COMPLETE, production-quality application. Every button must work. Every page must be fully implemented with real content, not placeholders. Include proper navigation between all routes. Use localStorage for data persistence. Include loading states, empty states, and error handling everywhere.`,
      ].filter(Boolean).join('');

      buildCommands.push(buildPrompt);

      // Navigate to Edit tab with queue
      const queueParam = encodeURIComponent(JSON.stringify(buildCommands));
      navigate(`/project/${project.id}/edit?queue=${queueParam}`, { replace: true });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setBuilding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-3xl py-8">
        <div className="mb-6 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Your Project Plan</h2>
        </div>
        <p className="mb-8 text-sm text-muted-foreground">
          We've generated a plan based on your answers. Review it below, then hit <strong>Build Project</strong> to get started.
        </p>

        <div className="space-y-5">
          {plan.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-lg border border-border bg-card p-5"
            >
              <h3 className="mb-2 font-display font-semibold">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.content}</p>
              {section.items && (
                <ul className="mt-3 space-y-1.5">
                  {section.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-secondary-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/new-project')}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Questions
          </Button>
          <Button size="lg" onClick={handleBuild} disabled={building}>
            {building ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Building…
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                Build Project
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanReview;
