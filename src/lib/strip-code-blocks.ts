/**
 * Strips fenced code blocks with file paths from markdown content,
 * leaving only the explanatory text and a summary.
 */
export function stripCodeBlocks(content: string): string {
  // Remove ```lang:filepath\n...\n``` blocks
  let cleaned = content.replace(/```\w*:[^\n]+\n[\s\S]*?```/g, '');

  // Remove **File: `path`** ... ```lang\n...\n``` blocks
  cleaned = cleaned.replace(
    /(?:\*\*File:\s*`?[^`\n*]+`?\*\*|###?\s*File:\s*`?[^`\n]+`?)\s*\n```\w*\n[\s\S]*?```/g,
    ''
  );

  // Clean up excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}
