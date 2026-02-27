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
  const featureChips = features
    .map(f => `        <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-sm">${f}</span>`)
    .join('\n');

  const files: Record<string, string> = {
    'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3.4.1/dist/tailwind.min.css" rel="stylesheet" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body class="bg-gray-950 text-white antialiased">
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
        'react-router-dom': '^6.30.0',
        'lucide-react': '^0.462.0',
        'framer-motion': '^12.0.0',
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    'src/App.tsx': `import { useState } from 'react';
import { Sparkles, ArrowRight, Layers, Zap, Shield } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <span className="text-lg font-bold">${name}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            Now building with AI
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl">
            ${name}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-400 leading-relaxed">
            ${description}
          </p>
          <div className="mb-10 flex flex-wrap justify-center gap-2">
${featureChips}
          </div>
          <div className="flex justify-center gap-4">
            <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500 transition-colors">
              Start Building <ArrowRight className="h-4 w-4" />
            </button>
            <button className="rounded-lg border border-white/20 px-6 py-3 font-medium text-gray-300 hover:bg-white/5 transition-colors">
              View Demo
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Built for scale</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: Layers, title: 'Modular Architecture', desc: 'Component-based design that grows with your needs.' },
              { icon: Zap, title: 'Lightning Fast', desc: 'Optimized for performance with modern tooling.' },
              { icon: Shield, title: 'Secure by Default', desc: 'Row-level security and encrypted data at rest.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-6 hover:border-indigo-500/30 transition-colors">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        Built with React, TypeScript & Tailwind CSS
      </footer>
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
