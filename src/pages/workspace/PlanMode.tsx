import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PlanSection } from '@/lib/types';

const PlanMode = () => {
  const { id } = useParams();

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('sections')
        .eq('project_id', id!)
        .single();
      if (error) throw error;
      return (data.sections as unknown) as PlanSection[];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Project Plan</h2>
      </div>
      <div className="space-y-6">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
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
    </div>
  );
};

export default PlanMode;
