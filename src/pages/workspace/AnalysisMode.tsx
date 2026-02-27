import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Shield, Zap, DollarSign, Code2, Layers } from 'lucide-react';
import { mockAnalysis } from '@/lib/mock-data';
import type { AnalysisFinding } from '@/lib/types';

const iconMap = { architecture: Layers, cost: DollarSign, performance: Zap, quality: Code2, security: Shield };
const severityIcon = { info: Info, warning: AlertTriangle, error: AlertCircle };
const severityColor = { info: 'text-info', warning: 'text-warning', error: 'text-destructive' };

const FindingCard = ({ finding, index }: { finding: AnalysisFinding; index: number }) => {
  const Icon = iconMap[finding.category];
  const SevIcon = severityIcon[finding.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">{finding.title}</h3>
        </div>
        <SevIcon className={`h-4 w-4 ${severityColor[finding.severity]}`} />
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{finding.description}</p>
      <p className="text-sm text-secondary-foreground"><span className="font-medium">Recommendation:</span> {finding.recommendation}</p>
    </motion.div>
  );
};

const AnalysisMode = () => (
  <div className="container max-w-3xl py-8">
    <h2 className="mb-6 font-display text-xl font-bold flex items-center gap-2">
      <Shield className="h-5 w-5 text-primary" /> Analysis Report
    </h2>
    <div className="space-y-4">
      {mockAnalysis.map((f, i) => <FindingCard key={i} finding={f} index={i} />)}
    </div>
  </div>
);

export default AnalysisMode;
