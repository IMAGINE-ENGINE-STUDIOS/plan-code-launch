import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Shield, Zap, DollarSign, Code2, Layers, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { mockAnalysis } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { AnalysisFinding } from '@/lib/types';

const iconMap = { architecture: Layers, cost: DollarSign, performance: Zap, quality: Code2, security: Shield };
const severityIcon = { info: Info, warning: AlertTriangle, error: AlertCircle };
const severityColor = { info: 'text-[hsl(var(--info))]', warning: 'text-[hsl(var(--warning))]', error: 'text-destructive' };
const severityBg = { info: 'bg-[hsl(var(--info))]/10', warning: 'bg-[hsl(var(--warning))]/10', error: 'bg-destructive/10' };

const FindingCard = ({ finding, index, onDismiss }: { finding: AnalysisFinding; index: number; onDismiss: () => void }) => {
  const Icon = iconMap[finding.category];
  const SevIcon = severityIcon[finding.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">{finding.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColor[finding.severity]} ${severityBg[finding.severity]}`}>
            <SevIcon className="h-3 w-3" />
            {finding.severity}
          </span>
        </div>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{finding.description}</p>
      <p className="text-sm text-secondary-foreground"><span className="font-medium">Recommendation:</span> {finding.recommendation}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onDismiss}>
          <CheckCircle2 className="mr-1.5 h-3 w-3" />Dismiss
        </Button>
      </div>
    </motion.div>
  );
};

const AnalysisMode = () => {
  const { toast } = useToast();
  const [findings, setFindings] = useState(mockAnalysis);
  const [scanning, setScanning] = useState(false);

  const handleRescan = async () => {
    setScanning(true);
    await new Promise(r => setTimeout(r, 2000));
    setFindings(mockAnalysis);
    setScanning(false);
    toast({ title: 'Scan complete', description: `Found ${mockAnalysis.length} findings.` });
  };

  const handleDismiss = (index: number) => {
    setFindings(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Dismissed', description: 'Finding removed from report.' });
  };

  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const infoCount = findings.filter(f => f.severity === 'info').length;

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Analysis Report</h2>
        </div>
        <Button size="sm" variant="outline" onClick={handleRescan} disabled={scanning}>
          {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          {scanning ? 'Scanning…' : 'Re-scan'}
        </Button>
      </div>

      {/* Summary badges */}
      <div className="mb-6 flex items-center gap-3">
        {errorCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <AlertCircle className="h-3 w-3" />{errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--warning))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--warning))]">
            <AlertTriangle className="h-3 w-3" />{warningCount} warning{warningCount > 1 ? 's' : ''}
          </span>
        )}
        {infoCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--info))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--info))]">
            <Info className="h-3 w-3" />{infoCount} info
          </span>
        )}
        {findings.length === 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--success))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--success))]">
            <CheckCircle2 className="h-3 w-3" />All clear
          </span>
        )}
      </div>

      <div className="space-y-4">
        {findings.map((f, i) => (
          <FindingCard key={`${f.title}-${i}`} finding={f} index={i} onDismiss={() => handleDismiss(i)} />
        ))}
        {findings.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
            <p className="text-sm text-muted-foreground">No issues found. Your project looks great!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisMode;
