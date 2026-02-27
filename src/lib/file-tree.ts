// Build a file tree from Vite's import.meta.glob results

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: TreeNode[];
};

// Load all source files as raw text
const rawFiles: Record<string, string> = import.meta.glob(
  [
    '/src/**/*.{ts,tsx,css,json}',
    '/index.html',
    '/vite.config.ts',
    '/tailwind.config.ts',
    '/tsconfig*.json',
    '/package.json',
    '/components.json',
    '/postcss.config.js',
    '/eslint.config.js',
  ],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

// Normalize paths: strip leading /
function normalizePath(p: string): string {
  return p.startsWith('/') ? p.slice(1) : p;
}

export function getFileContents(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [path, content] of Object.entries(rawFiles)) {
    map.set(normalizePath(path), content);
  }
  return map;
}

export function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'dir', children: [] };

  for (const filePath of paths) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (isFile) {
        current.children!.push({ name: part, path: currentPath, type: 'file' });
      } else {
        let dir = current.children!.find(c => c.type === 'dir' && c.name === part);
        if (!dir) {
          dir = { name: part, path: currentPath, type: 'dir', children: [] };
          current.children!.push(dir);
        }
        current = dir;
      }
    }
  }

  // Sort: dirs first, then files, alphabetical
  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map(n => {
      if (n.children) n.children = sortTree(n.children);
      return n;
    });
  }

  return sortTree(root.children!);
}
