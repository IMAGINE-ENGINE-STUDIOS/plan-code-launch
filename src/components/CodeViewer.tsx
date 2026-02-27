import { useState } from 'react';
import { FileCode, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeViewerProps {
  files: Record<string, string>;
}

export default function CodeViewer({ files }: CodeViewerProps) {
  const fileNames = Object.keys(files);
  const [activeFile, setActiveFile] = useState<string>(fileNames[0] || '');

  if (fileNames.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <FileCode className="h-8 w-8" />
        <p className="text-xs">No files generated yet</p>
      </div>
    );
  }

  // Update active file if it was removed
  if (activeFile && !files[activeFile] && fileNames.length > 0) {
    setActiveFile(fileNames[0]);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-border bg-muted/30">
        {fileNames.map((name) => {
          const shortName = name.split('/').pop() || name;
          const isActive = name === activeFile;
          return (
            <button
              key={name}
              onClick={() => setActiveFile(name)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              title={name}
            >
              <FileCode className="h-3 w-3 shrink-0" />
              {shortName}
            </button>
          );
        })}
      </div>

      {/* File content */}
      <ScrollArea className="flex-1">
        <pre className="p-4 text-xs leading-relaxed font-mono text-foreground/90">
          <code>{files[activeFile] || ''}</code>
        </pre>
      </ScrollArea>

      {/* Path bar */}
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground font-mono">
        {activeFile}
      </div>
    </div>
  );
}
