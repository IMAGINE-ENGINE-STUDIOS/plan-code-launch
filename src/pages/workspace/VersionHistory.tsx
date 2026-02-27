import { motion } from 'framer-motion';
import { History, RotateCcw, GitCommit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockVersions } from '@/lib/mock-data';

const VersionHistory = () => (
  <div className="container max-w-2xl py-8">
    <div className="mb-6 flex items-center gap-2">
      <History className="h-5 w-5 text-primary" />
      <h2 className="font-display text-xl font-bold">Version History</h2>
    </div>
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {mockVersions.map((v, i) => (
        <motion.div
          key={v.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="relative flex gap-4 pb-6"
        >
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
            <GitCommit className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm font-semibold text-primary">{v.version}</span>
                <p className="mt-0.5 text-sm text-foreground">{v.note}</p>
              </div>
              <Button variant="ghost" size="sm">
                <RotateCcw className="mr-1 h-3 w-3" />Rollback
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {v.author} · {new Date(v.createdAt).toLocaleDateString()}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default VersionHistory;
