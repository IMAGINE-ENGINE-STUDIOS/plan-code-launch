import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import sdk, { type VM } from '@stackblitz/sdk';

interface StackBlitzPreviewProps {
  projectName: string;
  projectDescription: string;
  features: string[];
}

export interface StackBlitzPreviewHandle {
  applyFileChanges: (files: Record<string, string>) => Promise<void>;
}

const generateScaffold = (name: string, description: string, features: string[]) => {
  const files: Record<string, string> = {
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
    'package.json': JSON.stringify({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build' },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
      },
      devDependencies: {
        '@types/react': '^18.3.0',
        '@types/react-dom': '^18.3.0',
        '@vitejs/plugin-react': '^4.3.0',
        typescript: '^5.5.0',
        vite: '^5.4.0',
      },
    }, null, 2),
    'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: 'force',
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
      },
      include: ['src'],
    }, null, 2),
    'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    'src/index.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fafafa; }
a { color: inherit; text-decoration: none; }`,
    'src/App.tsx': `export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>${name}</h1>
      <p style={{ color: '#888', marginBottom: '2rem', textAlign: 'center', maxWidth: '600px' }}>${description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        ${features.map(f => `<span style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: '9999px', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>${f}</span>`).join('\n        ')}
      </div>
      <p style={{ marginTop: '3rem', color: '#555', fontSize: '0.75rem' }}>Start chatting to build your app →</p>
    </div>
  );
}`,
  };
  return files;
};

const StackBlitzPreview = forwardRef<StackBlitzPreviewHandle, StackBlitzPreviewProps>(
  ({ projectName, projectDescription, features }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const vmRef = useRef<VM | null>(null);

    useImperativeHandle(ref, () => ({
      applyFileChanges: async (files: Record<string, string>) => {
        if (!vmRef.current) return;
        await vmRef.current.applyFsDiff({
          create: files,
          destroy: [],
        });
      },
    }));

    const initEmbed = useCallback(async () => {
      if (!containerRef.current) return;
      
      const files = generateScaffold(projectName, projectDescription, features);

      try {
        const vm = await sdk.embedProject(
          containerRef.current,
          {
            title: projectName,
            description: projectDescription,
            template: 'node',
            files,
          },
          {
            height: '100%',
            view: 'preview',
            hideExplorer: true,
            hideNavigation: false,
            theme: 'dark',
          }
        );
        vmRef.current = vm;
      } catch (err) {
        console.error('StackBlitz embed failed:', err);
      }
    }, [projectName, projectDescription, features]);

    useEffect(() => {
      initEmbed();
    }, [initEmbed]);

    return <div ref={containerRef} className="h-full w-full" />;
  }
);

StackBlitzPreview.displayName = 'StackBlitzPreview';

export default StackBlitzPreview;
