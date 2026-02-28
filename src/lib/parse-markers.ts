/**
 * Parses [NEEDS_DEPENDENCY:package:version] and [NEEDS_API_KEY:KEY:desc] markers
 * from AI assistant responses.
 */

export interface DependencyMarker {
  packageName: string;
  version: string;
}

export interface ApiKeyMarker {
  key: string;
  description: string;
}

export function parseDependencyMarkers(content: string): DependencyMarker[] {
  const markers: DependencyMarker[] = [];
  const regex = /\[NEEDS_DEPENDENCY:([^:]+):([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    markers.push({ packageName: match[1].trim(), version: match[2].trim() });
  }
  return markers;
}

export function parseApiKeyMarkers(content: string): ApiKeyMarker[] {
  const markers: ApiKeyMarker[] = [];
  const regex = /\[NEEDS_API_KEY:([^:]+):([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    markers.push({ key: match[1].trim(), description: match[2].trim() });
  }
  return markers;
}
