import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, File, Folder,
  Circle, Loader2, Wrench, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { type TreeNode, buildFileTree } from '@/lib/file-tree';

// ─── File Tree Item ───
const FileTreeItem = ({
  node, depth = 0, selectedPath, onSelect,
}: {
  node: TreeNode; depth?: number; selectedPath: string | null; onSelect: (path: string) => void;
}) => {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = node.type === 'file' && node.path === selectedPath;

  const handleClick = () => {
    if (node.type === 'dir') setOpen(!open);
    else onSelect(node.path);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
          isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'dir' ? (
          open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : <File className="h-3 w-3 text-muted-foreground" />}
        {node.type === 'dir' && <Folder className="h-3 w-3 text-primary" />}
        <span className={node.type === 'dir' ? 'font-medium' : 'text-muted-foreground'}>
          {node.name}
        </span>
      </button>
      {node.type === 'dir' && open && node.children?.map(c => (
        <FileTreeItem key={c.path} node={c} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
      ))}
    </div>
  );
};

const DevMode = () => {
  const { id: projectId } = useParams();
  const { toast } = useToast();

  // Preview state — loaded from DB
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(true);

  // Build file tree from project files (DB)
  const fileTree = useMemo(() => {
    const paths = Object.keys(previewFiles);
    return paths.length > 0 ? buildFileTree(paths) : [];
  }, [previewFiles]);

  // Project status
  const [projectStatus, setProjectStatus] = useState<string>('draft');

  // Load project status
  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('status').eq('id', projectId).single()
      .then(({ data }) => { if (data) setProjectStatus(data.status); });
  }, [projectId]);

  // Load persisted files from DB
  useEffect(() => {
    if (!projectId) return;
    setFilesLoading(true);
    supabase
      .from('project_files')
      .select('file_path, content')
      .eq('project_id', projectId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const files: Record<string, string> = {};
          data.forEach((f: any) => { files[f.file_path] = f.content; });
          setPreviewFiles(files);
        }
        setFilesLoading(false);
      });
  }, [projectId]);

  const selectedContent = selectedFile ? previewFiles[selectedFile] ?? '' : '';
  const lines = selectedContent.split('\n');

  const statusColor: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    building: 'bg-primary/20 text-primary',
    compatible: 'bg-primary/20 text-primary',
    published: 'bg-primary/20 text-primary',
    needs_attention: 'bg-destructive/20 text-destructive',
  };

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
        <Circle className="h-2 w-2 fill-primary text-primary" />
        <span className="text-xs font-medium">Dev Environment</span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor[projectStatus] ?? ''}`}>
          {projectStatus}
        </Badge>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Explorer */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <div className="flex h-full flex-col">
            <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Explorer
            </div>
            <ScrollArea className="flex-1 px-1">
              {filesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : fileTree.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">No project files yet. Use Edit mode to generate code.</p>
              ) : (
                fileTree.map(node => (
                  <FileTreeItem key={node.path} node={node} selectedPath={selectedFile} onSelect={setSelectedFile} />
                ))
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Code Viewer */}
        <ResizablePanel defaultSize={75} minSize={40}>
          <div className="flex h-full flex-col">
            {selectedFile ? (
              <>
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <File className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">{selectedFile}</span>
                </div>
                <ScrollArea className="flex-1">
                  <pre className="p-4 text-xs leading-5">
                    <code>
                      {lines.map((line, i) => (
                        <div key={i} className="flex">
                          <span className="inline-block w-10 text-right pr-4 text-muted-foreground/50 select-none">{i + 1}</span>
                          <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">Select a file to view</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default DevMode;
