import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, Shield, Zap, DollarSign, Code2, Layers, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { AnalysisFinding } from '@/lib/types';

const iconMap = { architecture: Layers, cost: DollarSign, performance: Zap, quality: Code2, security: Shield };
const severityIcon = { info: Info, warning: AlertTriangle, error: AlertCircle };
const severityColor = { info: 'text-[hsl(var(--info))]', warning: 'text-[hsl(var(--warning))]', error: 'text-destructive' };
const severityBg = { info: 'bg-[hsl(var(--info))]/10', warning: 'bg-[hsl(var(--warning))]/10', error: 'bg-destructive/10' };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ANALYSIS_PROMPT = `Analyze the following project files for issues. Return ONLY a JSON array of findings with this schema:
[{"category":"security"|"performance"|"quality"|"architecture"|"cost","severity":"error"|"warning"|"info","title":"string","description":"string","recommendation":"string"}]
Be thorough. Check for: missing error handling, security issues, performance problems, code quality, architecture concerns, cost optimization. Return valid JSON only, no markdown fences.`;

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
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColor[finding.severity]} ${severityBg[finding.severity]}`}>
          <SevIcon className="h-3 w-3" />
          {finding.severity}
        </span>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{finding.description}</p>
      <p className="text-sm text-secondary-foreground"><span className="font-medium">Recommendation:</span> {finding.recommendation}</p>
      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={onDismiss}>
          <CheckCircle2 className="mr-1.5 h-3 w-3" />Dismiss
        </Button>
      </div>
    </motion.div>
  );
};

const AnalysisMode = () => {
  const { id: projectId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();
  const [findings, setFindings] = useState<AnalysisFinding[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = async () => {
    if (!session || !projectId) return;
    setScanning(true);
    try {
      // Load project files
      const { data: files } = await supabase
        .from('project_files')
        .select('file_path, content')
        .eq('project_id', projectId);

      if (!files || files.length === 0) {
        toast({ title: 'No files', description: 'No project files to analyze. Build something first!', variant: 'destructive' });
        setScanning(false);
        return;
      }

      const fileContext = files
        .slice(0, 15)
        .map((f: any) => `--- ${f.file_path} ---\n${f.content.slice(0, 3000)}`)
        .join('\n\n');

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${ANALYSIS_PROMPT}\n\nFiles:\n${fileContext}` }],
          projectId,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      // Stream response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

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
            if (content) fullResponse += content;
          } catch { break; }
        }
      }

      // Parse JSON from response
      const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AnalysisFinding[];
        setFindings(parsed.filter(f => f.title && f.category && f.severity));
        setDismissed(new Set());
        toast({ title: 'Scan complete', description: `Found ${parsed.length} findings.` });
      } else {
        toast({ title: 'Scan complete', description: 'AI returned no structured findings.' });
        setFindings([]);
      }
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    } finally {
      setScanning(false);
      setHasScanned(true);
    }
  };

  const handleDismiss = (index: number) => {
    const f = visibleFindings[index];
    setDismissed(prev => new Set(prev).add(`${f.title}-${f.category}`));
    toast({ title: 'Dismissed', description: 'Finding removed from report.' });
  };

  const visibleFindings = findings.filter(f => !dismissed.has(`${f.title}-${f.category}`));
  const errorCount = visibleFindings.filter(f => f.severity === 'error').length;
  const warningCount = visibleFindings.filter(f => f.severity === 'warning').length;
  const infoCount = visibleFindings.filter(f => f.severity === 'info').length;

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Analysis Report</h2>
        </div>
        <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning}>
          {scanning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          {scanning ? 'Scanning…' : hasScanned ? 'Re-scan' : 'Run Analysis'}
        </Button>
      </div>

      {!hasScanned && !scanning ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Shield className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Click "Run Analysis" to scan your project files with AI.</p>
        </div>
      ) : (
        <>
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
            {visibleFindings.length === 0 && hasScanned && (
              <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--success))]/10 px-3 py-1 text-xs font-medium text-[hsl(var(--success))]">
                <CheckCircle2 className="h-3 w-3" />All clear
              </span>
            )}
          </div>

          <div className="space-y-4">
            {visibleFindings.map((f, i) => (
              <FindingCard key={`${f.title}-${i}`} finding={f} index={i} onDismiss={() => handleDismiss(i)} />
            ))}
            {visibleFindings.length === 0 && hasScanned && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
                <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
                <p className="text-sm text-muted-foreground">No issues found. Your project looks great!</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AnalysisMode;
