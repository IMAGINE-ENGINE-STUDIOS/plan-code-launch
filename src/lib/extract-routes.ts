/**
 * Extracts route paths from project files by scanning for react-router <Route> declarations.
 * Returns an array of { path, label } objects.
 */
export function extractRoutes(files: Record<string, string>): Array<{ path: string; label: string }> {
  const routes: Array<{ path: string; label: string }> = [];
  const seen = new Set<string>();

  for (const [filePath, content] of Object.entries(files)) {
    // Match <Route path="..." /> or <Route path="..." element={...}>
    const routeRegex = /<Route\s[^>]*path=["']([^"']+)["'][^>]*/g;
    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(content)) !== null) {
      const path = match[1];
      if (!seen.has(path) && !path.includes(':') && path !== '*') {
        seen.add(path);
        // Generate label from path
        const label = path === '/'
          ? 'Home'
          : path
              .split('/')
              .filter(Boolean)
              .map(seg => seg.charAt(0).toUpperCase() + seg.slice(1))
              .join(' / ');
        routes.push({ path, label });
      }
    }

    // Also match navigate("/path") or to="/path" for Link components
    const linkRegex = /(?:to|navigate\()=?\s*["'](\/?[a-z][\w/-]*)["']/gi;
    while ((match = linkRegex.exec(content)) !== null) {
      const path = match[1].startsWith('/') ? match[1] : `/${match[1]}`;
      if (!seen.has(path) && !path.includes(':') && path.length > 1) {
        seen.add(path);
        const label = path
          .split('/')
          .filter(Boolean)
          .map(seg => seg.charAt(0).toUpperCase() + seg.slice(1))
          .join(' / ');
        routes.push({ path, label });
      }
    }
  }

  // Sort: home first, then alphabetical
  return routes.sort((a, b) => {
    if (a.path === '/') return -1;
    if (b.path === '/') return 1;
    return a.path.localeCompare(b.path);
  });
}
