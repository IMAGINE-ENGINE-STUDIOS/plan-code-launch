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
  extraDependencies?: Record<string, string>;
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
  return `import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ROUTES = ${JSON.stringify(routes)};

export default function RouteNavigator() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef(null);

  if (ROUTES.length <= 1) return null;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = ROUTES.find(r => r.path === location.pathname)?.label || location.pathname;

  return (
    <div ref={panelRef} style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 99999, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 36,
          padding: open ? '0 10px' : '0 12px',
          borderRadius: 10,
          background: open ? '#1a1a24' : 'linear-gradient(135deg, #6366f1, #818cf8)',
          color: '#fff',
          border: open ? '1px solid #2a2a36' : 'none',
          cursor: 'pointer',
          boxShadow: open ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 16px rgba(99,102,241,0.35)',
          fontSize: 12,
          fontWeight: 500,
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
        }}
        title={\`Navigate pages • Current: \${currentLabel}\`}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{open ? '✕' : '☰'}</span>
        {!open && <span>{currentLabel}</span>}
      </button>

      {/* Route panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            left: 0,
            width: 240,
            maxHeight: 360,
            overflowY: 'auto',
            background: '#111118',
            border: '1px solid #2a2a36',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            padding: 6,
            animation: 'navPanelIn 0.15s ease-out',
          }}
        >
          <style>{\`
            @keyframes navPanelIn {
              from { opacity: 0; transform: translateY(8px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .nav-route-btn:hover { background: rgba(255,255,255,0.06) !important; }
            .nav-route-btn.active:hover { background: rgba(99,102,241,0.18) !important; }
          \`}</style>

          <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>Pages</div>
            <div style={{ fontSize: 9, color: '#5a5a6a', marginTop: 1 }}>{ROUTES.length} routes available</div>
          </div>

          {ROUTES.map((route) => {
            const isActive = location.pathname === route.path;
            return (
              <button
                key={route.path}
                className={\`nav-route-btn \${isActive ? 'active' : ''}\`}
                onClick={() => { navigate(route.path); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 9,
                  background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: isActive ? '#a5b4fc' : '#b0b0be',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s ease',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 16,
                    borderRadius: 2,
                    background: '#6366f1',
                  }} />
                )}
                <span style={{ fontSize: 13, lineHeight: 1, marginLeft: isActive ? 4 : 0 }}>
                  {route.path === '/' ? '🏠' : '📄'}
                </span>
                <span style={{ flex: 1 }}>{route.label}</span>
                {isActive && <span style={{ fontSize: 8, color: '#6366f1' }}>●</span>}
              </button>
            );
          })}

          <div style={{ padding: '6px 10px 4px', fontSize: 9, color: '#3a3a48', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', marginTop: 4 }}>
            {location.pathname}
          </div>
        </div>
      )}
    </div>
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

export default function SandpackPreview({ files, projectName, onError, extraDependencies }: SandpackPreviewProps) {
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
          // Core
          'react': '^18.3.1',
          'react-dom': '^18.3.1',
          'react-router-dom': '^6.30.0',
          // Icons & Animation
          'lucide-react': '^0.462.0',
          'framer-motion': '^12.0.0',
          // Styling utilities
          'class-variance-authority': '^0.7.1',
          'clsx': '^2.1.1',
          'tailwind-merge': '^2.6.0',
          // Data & Forms
          '@tanstack/react-query': '^5.83.0',
          'react-hook-form': '^7.61.1',
          '@hookform/resolvers': '^3.10.0',
          'zod': '^3.25.0',
          '@supabase/supabase-js': '^2.98.0',
          // Content
          'react-markdown': '^10.1.0',
          // Utilities
          'date-fns': '^3.6.0',
          'next-themes': '^0.3.0',
          'html2canvas': '^1.4.1',
          // Charts & Notifications
          'recharts': '^2.15.0',
          'sonner': '^1.7.0',
          'cmdk': '^1.0.0',
          // Radix UI Primitives
          '@radix-ui/react-dialog': '^1.1.14',
          '@radix-ui/react-popover': '^1.1.14',
          '@radix-ui/react-tabs': '^1.1.12',
          '@radix-ui/react-tooltip': '^1.2.7',
          '@radix-ui/react-select': '^2.2.5',
          '@radix-ui/react-checkbox': '^1.3.2',
          '@radix-ui/react-switch': '^1.2.5',
          '@radix-ui/react-accordion': '^1.2.11',
          '@radix-ui/react-avatar': '^1.1.10',
          '@radix-ui/react-progress': '^1.1.7',
          '@radix-ui/react-slider': '^1.3.5',
          '@radix-ui/react-label': '^2.1.7',
          '@radix-ui/react-slot': '^1.2.3',
          '@radix-ui/react-separator': '^1.1.7',
          '@radix-ui/react-toggle': '^1.1.9',
          '@radix-ui/react-toggle-group': '^1.1.10',
          '@radix-ui/react-dropdown-menu': '^2.1.15',
          '@radix-ui/react-context-menu': '^2.2.15',
          '@radix-ui/react-alert-dialog': '^1.1.14',
          '@radix-ui/react-hover-card': '^1.1.14',
          '@radix-ui/react-navigation-menu': '^1.2.13',
          '@radix-ui/react-radio-group': '^1.3.7',
          '@radix-ui/react-scroll-area': '^1.2.9',
          '@radix-ui/react-aspect-ratio': '^1.1.7',
          '@radix-ui/react-collapsible': '^1.1.11',
          '@radix-ui/react-menubar': '^1.1.15',
          // Layout & Input
          'embla-carousel-react': '^8.6.0',
          'vaul': '^0.9.9',
          'input-otp': '^1.4.2',
          'react-day-picker': '^8.10.1',
          'react-resizable-panels': '^2.1.9',
          ...(extraDependencies || {}),
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <SandpackPreviewPanel
          showOpenInCodeSandbox={false}
          showRefreshButton={true}
          style={{ flex: 1, minHeight: 0 }}
        />
      </div>
    </SandpackProvider>
  );
}
