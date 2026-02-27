import { X, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface CommandQueueProps {
  queue: string[];
  onRemove: (index: number) => void;
  onClear: () => void;
}

const CommandQueue = ({ queue, onRemove, onClear }: CommandQueueProps) => {
  if (queue.length === 0) return null;

  return (
    <div className="border-t border-border bg-muted/30 px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <ListOrdered className="h-3 w-3" />
          Queued ({queue.length})
        </span>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        <AnimatePresence>
          {queue.map((item, i) => (
            <motion.div
              key={`${i}-${item.slice(0, 20)}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1"
            >
              <span className="text-[10px] font-mono text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate text-[11px] text-foreground">{item}</span>
              <button onClick={() => onRemove(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CommandQueue;
