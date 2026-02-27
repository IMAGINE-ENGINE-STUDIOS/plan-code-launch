import { useMemo, useEffect, useRef, useCallback } from 'react';
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewPanel,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { extractRoutes } from '@/lib/extract-routes';

interface SandpackPreviewProps {
  files: Record<string, string>;
  projectName: string;
  onError?: (error: string) => void;
}

// ─── Error Listener (must be inside SandpackProvider) ───
function ErrorListener({ onError }: { onError?: (error: string) => void }) {
  const { listen, sandpack } = useSandpack();
  const lastErrorRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!onError) return;

    const unsub = listen((msg: any) => {
      let errorText = '';

      if (msg.type === 'action' && msg.action === 'show-error') {
        errorText = msg.title || msg.message || 'Unknown build error';
      }

      if (msg.type === 'console' && msg.codesandbox && msg.log) {
        const logs = Array.isArray(msg.log) ? msg.log : [msg.log];
        logs.forEach((entry: any) => {
          if (entry.method === 'error') {
            const text = Array.isArray(entry.data) ? entry.data.join(' ') : String(entry.data);
            if (text && !text.includes('Download the React DevTools')) {
              errorText = text;
            }
          }
        });
      }

      if (msg.type === 'status' && msg.status === 'error') {
        errorText = msg.message || 'Sandpack encountered an error';
      }

      if (errorText && errorText !== lastErrorRef.current) {
        lastErrorRef.current = errorText;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onError(errorText);
        }, 2000);
      }
    });

    return () => {
      unsub();
      clearTimeout(debounceRef.current);
    };
  }, [listen, onError]);

  useEffect(() => {
    if (!onError || !sandpack.error) return;
    const errMsg = sandpack.error.message || String(sandpack.error);
    if (errMsg && errMsg !== lastErrorRef.current) {
      lastErrorRef.current = errMsg;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onError(errMsg);
      }, 2000);
    }
  }, [sandpack.error, onError]);

  return null;
}

const BASE_HTML = `<!DOCTYPE html>
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
</html>`;

const BASE_INDEX = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

// This component is injected into the Sandpack preview to enable route navigation
function generateRouteNavigatorCode(routes: Array<{ path: string; label: string }>): string {
  return `import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ROUTES = ${JSON.stringify(routes)};

export default function RouteNavigator() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (ROUTES.length <= 1) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 99999,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          fontSize: 18,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        title="Page Navigator"
      >
        {open ? '✕' : '☰'}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 64,
            left: 16,
            zIndex: 99999,
            width: 220,
            maxHeight: 320,
            overflowY: 'auto',
            background: '#1a1a24',
            border: '1px solid #2a2a36',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            padding: 8,
          }}
        >
          <div style={{ padding: '4px 8px 8px', borderBottom: '1px solid #2a2a36', marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Pages</div>
            <div style={{ fontSize: 9, color: '#8a8a9a' }}>Navigate between app routes</div>
          </div>
          {ROUTES.map((route) => {
            const isActive = location.pathname === route.path;
            return (
              <button
                key={route.path}
                onClick={() => { navigate(route.path); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 8,
                  background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: isActive ? '#818cf8' : '#b0b0be',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{route.path === '/' ? '🏠' : '📄'}</span>
                <span>{route.label}</span>
                {isActive && <span style={{ marginLeft: 'auto', fontSize: 10 }}>●</span>}
              </button>
            );
          })}
          <div style={{ padding: '6px 10px 2px', fontSize: 9, color: '#5a5a6a', textAlign: 'center' }}>
            {location.pathname}
          </div>
        </div>
      )}
    </>
  );
}`;
}

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

export default function SandpackPreview({ files, projectName, onError }: SandpackPreviewProps) {
  const sandpackFiles = useMemo(() => {
    const merged: Record<string, string> = {
      '/public/index.html': BASE_HTML,
      '/src/index.tsx': BASE_INDEX,
    };

    for (const [path, content] of Object.entries(files)) {
      const key = path.startsWith('/') ? path : `/${path}`;
      const rewritten = content.replace(
        /from\s+['"]@\/([^'"]+)['"]/g,
        (_, p) => `from '../${p}'`
      ).replace(
        /import\s+['"]@\/([^'"]+)['"]/g,
        (_, p) => `import '../${p}'`
      );
      merged[key] = rewritten;
    }

    if (!merged['/src/App.tsx'] && !merged['/src/App.jsx']) {
      merged['/src/App.tsx'] = DEFAULT_APP;
    }

    // Extract routes from project files and inject navigator
    const routes = extractRoutes(files);
    if (routes.length > 1) {
      // Inject RouteNavigator component
      merged['/src/RouteNavigator.tsx'] = generateRouteNavigatorCode(routes);

      // Patch App.tsx/jsx to include the RouteNavigator
      const appKey = merged['/src/App.tsx'] ? '/src/App.tsx' : '/src/App.jsx';
      const appContent = merged[appKey];
      if (appContent && !appContent.includes('RouteNavigator')) {
        // Check if app uses BrowserRouter or Routes
        const usesRouter = appContent.includes('BrowserRouter') || appContent.includes('Router') || appContent.includes('Routes');
        if (usesRouter) {
          // Add import at top
          const importLine = `import RouteNavigator from './RouteNavigator';\n`;
          // Find where to insert the component — right after the Router opening
          let patched = appContent;
          if (!patched.includes('RouteNavigator')) {
            patched = importLine + patched;
            // Insert <RouteNavigator /> after <BrowserRouter>, <Router>, or <HashRouter>
            patched = patched.replace(
              /(<(?:BrowserRouter|Router|HashRouter)[^>]*>)/,
              '$1\n        <RouteNavigator />'
            );
          }
          merged[appKey] = patched;
        }
      }
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
      <ErrorListener onError={onError} />
      <SandpackPreviewPanel
        showOpenInCodeSandbox={false}
        showRefreshButton={true}
        style={{ height: '100%' }}
      />
    </SandpackProvider>
  );
}
