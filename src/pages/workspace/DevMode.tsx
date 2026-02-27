import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Terminal } from 'lucide-react';
import { mockFileTree } from '@/lib/mock-data';

type TreeNode = { name: string; type: 'file' | 'dir'; children?: TreeNode[] };

const FileTreeItem = ({ node, depth = 0 }: { node: TreeNode; depth?: number }) => {
  const [open, setOpen] = useState(depth < 2);
  return (
    <div>
      <button
        onClick={() => node.type === 'dir' && setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'dir' ? (
          open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : <File className="h-3 w-3 text-muted-foreground" />}
        {node.type === 'dir' && <Folder className="h-3 w-3 text-primary" />}
        <span className={node.type === 'dir' ? 'font-medium' : 'text-muted-foreground'}>{node.name}</span>
      </button>
      {node.type === 'dir' && open && node.children?.map(c => <FileTreeItem key={c.name} node={c} depth={depth + 1} />)}
    </div>
  );
};

const DevMode = () => (
  <div className="flex h-[calc(100vh-10rem)] flex-col lg:flex-row">
    {/* File Tree */}
    <div className="w-full border-b border-border lg:w-56 lg:border-b-0 lg:border-r">
      <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Explorer</div>
      <div className="overflow-y-auto px-1">
        {(mockFileTree as TreeNode[]).map(node => <FileTreeItem key={node.name} node={node} />)}
      </div>
    </div>

    {/* Editor */}
    <div className="flex flex-1 flex-col">
      <div className="flex-1 p-6">
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Select a file to edit</p>
        </div>
      </div>

      {/* Logs */}
      <div className="h-40 border-t border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Console</span>
        </div>
        <div className="p-3 font-mono text-xs text-muted-foreground">
          <p>[info] Server ready on port 3000</p>
          <p>[info] Compiled successfully</p>
          <p className="text-success">[success] Build completed in 1.2s</p>
        </div>
      </div>
    </div>
  </div>
);

export default DevMode;
