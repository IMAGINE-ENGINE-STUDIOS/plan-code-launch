import { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewPanel,
} from '@codesandbox/sandpack-react';

interface SandpackPreviewProps {
  files: Record<string, string>;
  projectName: string;
}

const BASE_FILES: Record<string, string> = {
  '/public/index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            gray: {
              950: '#0a0a0f',
              900: '#111118',
              800: '#1a1a24',
              700: '#2a2a36',
              600: '#3a3a48',
              500: '#5a5a6a',
              400: '#8a8a9a',
              300: '#b0b0be',
              200: '#d0d0da',
              100: '#e8e8ee',
            },
            indigo: {
              400: '#818cf8',
              500: '#6366f1',
              600: '#4f46e5',
            },
          },
        },
      },
    };
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0f; color: #fff; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    let selectActive = false;
    let hoverEl = null;
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'toggle-select-mode') selectActive = e.data.active;
    });
    document.addEventListener('mouseover', (e) => {
      if (!selectActive) return;
      if (hoverEl) hoverEl.style.outline = '';
      hoverEl = e.target;
      hoverEl.style.outline = '2px solid #6366f1';
    });
    document.addEventListener('mouseout', (e) => {
      if (hoverEl) { hoverEl.style.outline = ''; hoverEl = null; }
    });
    document.addEventListener('click', (e) => {
      if (!selectActive) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      window.parent.postMessage({
        type: 'element-selected',
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 80),
        classes: el.className || '',
      }, '*');
      if (hoverEl) { hoverEl.style.outline = ''; hoverEl = null; }
      selectActive = false;
    }, true);
  </script>
</body>
</html>`,
  '/src/index.tsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
};

const DEFAULT_APP = `export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Ready to build</h1>
        <p className="text-gray-400">Describe what you want in the chat</p>
      </div>
    </div>
  );
}`;

export default function SandpackPreview({ files, projectName }: SandpackPreviewProps) {
  const sandpackFiles = useMemo(() => {
    const merged: Record<string, string> = { ...BASE_FILES };

    // Add user files, prefixing with / if needed and rewriting @/ aliases
    for (const [path, content] of Object.entries(files)) {
      const key = path.startsWith('/') ? path : `/${path}`;
      // Rewrite @/ import aliases to relative paths for Sandpack compatibility
      const rewritten = content.replace(
        /from\s+['"]@\/([^'"]+)['"]/g,
        (_, p) => `from '../${p}'`
      ).replace(
        /import\s+['"]@\/([^'"]+)['"]/g,
        (_, p) => `import '../${p}'`
      );
      merged[key] = rewritten;
    }

    // Ensure App.tsx exists
    if (!merged['/src/App.tsx'] && !merged['/src/App.jsx']) {
      merged['/src/App.tsx'] = DEFAULT_APP;
    }

    return merged;
  }, [files]);

  return (
    <SandpackProvider
      template="react-ts"
      theme="dark"
      files={sandpackFiles}
      customSetup={{
        dependencies: {
          'react': '^18.3.1',
          'react-dom': '^18.3.1',
          'react-router-dom': '^6.30.0',
          'lucide-react': '^0.462.0',
          'framer-motion': '^12.0.0',
          'class-variance-authority': '^0.7.1',
          'clsx': '^2.1.1',
          'tailwind-merge': '^2.6.0',
          'date-fns': '^3.6.0',
          'recharts': '^2.15.0',
          'sonner': '^1.7.0',
          'cmdk': '^1.0.0',
        },
        entry: '/src/index.tsx',
      }}
      options={{
        externalResources: [
          'https://cdn.tailwindcss.com',
        ],
        classes: {
          'sp-wrapper': 'h-full',
          'sp-layout': 'h-full',
        },
      }}
    >
      <SandpackPreviewPanel
        showOpenInCodeSandbox={false}
        showRefreshButton={true}
        style={{ height: '100%' }}
      />
    </SandpackProvider>
  );
}
