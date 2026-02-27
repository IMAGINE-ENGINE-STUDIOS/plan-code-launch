/**
 * Parses AI responses to extract file changes.
 * Looks for fenced code blocks with file paths like:
 * ```tsx:src/App.tsx
 * ...code...
 * ```
 * OR markdown headers like:
 * ### File: src/App.tsx
 * ```tsx
 * ...code...
 * ```
 */
export function parseFileChanges(content: string): Record<string, string> {
  const files: Record<string, string> = {};

  // Pattern 1: ```lang:filepath\n...\n```
  const pattern1 = /```\w*:([^\n]+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = pattern1.exec(content)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2].trimEnd();
    files[filePath] = fileContent;
  }

  // Pattern 2: **File: `filepath`** or ### File: filepath followed by code block
  const pattern2 = /(?:\*\*File:\s*`?([^`\n*]+)`?\*\*|###?\s*File:\s*`?([^`\n]+)`?)\s*\n```\w*\n([\s\S]*?)```/g;
  while ((match = pattern2.exec(content)) !== null) {
    const filePath = (match[1] || match[2]).trim();
    const fileContent = match[3].trimEnd();
    if (!files[filePath]) {
      files[filePath] = fileContent;
    }
  }

  return files;
}

export function hasFileChanges(content: string): boolean {
  return Object.keys(parseFileChanges(content)).length > 0;
}
