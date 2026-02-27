import { useState } from 'react';
import { Send, FileCode, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const mockDiff = `@@ -12,6 +12,8 @@
 import { Button } from '@/components/ui/button';
+import { Card } from '@/components/ui/card';
+import { Badge } from '@/components/ui/badge';
 
 export default function Dashboard() {
-  return <div>Dashboard</div>;
+  return <Card className="p-6"><h1>Dashboard</h1></Card>;
 }`;

const changedFiles = ['src/pages/Dashboard.tsx', 'src/components/MetricsCard.tsx', 'src/lib/api.ts'];

const EditMode = () => {
  const [message, setMessage] = useState('');

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col lg:flex-row">
      {/* Chat */}
      <div className="flex flex-1 flex-col border-r border-border">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-primary/10 p-4 text-sm">
              <p className="mb-1 font-medium text-primary">AI</p>
              <p className="text-foreground">I've updated the Dashboard to use Card components and added a metrics section. Here's the diff:</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
                {mockDiff.split('\n').map((line, i) => (
                  <div key={i} className={line.startsWith('+') ? 'text-success' : line.startsWith('-') ? 'text-destructive' : 'text-muted-foreground'}>
                    {line.startsWith('+') && <Plus className="mr-1 inline h-3 w-3" />}
                    {line.startsWith('-') && <Minus className="mr-1 inline h-3 w-3" />}
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          </div>
        </div>
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe changes..." className="flex-1" />
            <Button size="icon"><Send className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* Changed Files */}
      <div className="w-full border-t border-border p-4 lg:w-64 lg:border-t-0">
        <h3 className="mb-3 text-sm font-semibold">Changed Files</h3>
        <div className="space-y-1">
          {changedFiles.map(f => (
            <div key={f} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
              <FileCode className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EditMode;
