import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { History, RotateCcw, GitCommit, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockVersions } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const VersionHistory = () => {
  const { toast } = useToast();
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState(mockVersions[0]?.id);

  const handleRollback = async (versionId: string, versionLabel: string) => {
    setRollingBack(versionId);
    await new Promise(r => setTimeout(r, 1500));
    setActiveVersion(versionId);
    setRollingBack(null);
    toast({ title: 'Rolled back', description: `Project restored to ${versionLabel}` });
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Version History</h2>
      </div>
      <div className="relative space-y-0">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

        {mockVersions.map((v, i) => {
          const isCurrent = v.id === activeVersion;
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="relative flex gap-4 pb-6"
            >
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card ${isCurrent ? 'border-primary' : 'border-border'}`}>
                {isCurrent ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div className={`flex-1 rounded-lg border bg-card p-4 ${isCurrent ? 'border-primary/30' : 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{v.version}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground">{v.note}</p>
                  </div>
                  {!isCurrent && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={rollingBack === v.id}>
                          {rollingBack === v.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1 h-3 w-3" />
                          )}
                          Rollback
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rollback to {v.version}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will restore the project to version {v.version} ("{v.note}"). Any changes made after this version will be preserved in the history.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRollback(v.id, v.version)}>
                            Rollback
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {v.author} · {new Date(v.createdAt).toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default VersionHistory;
