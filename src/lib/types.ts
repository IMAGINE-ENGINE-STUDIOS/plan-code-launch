export type ProjectStatus = 'draft' | 'imported' | 'compatible' | 'needs_attention' | 'published';
export type SupportLevel = 'A' | 'B' | 'C';
export type WorkspaceTab = 'edit' | 'chat' | 'dev' | 'analysis' | 'publish' | 'settings' | 'versions';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  stack: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersion {
  id: string;
  version: string;
  note: string;
  createdAt: string;
  author: string;
}

export interface PlanSection {
  title: string;
  content: string;
  items?: string[];
}

export interface ImportFinding {
  category: string;
  item: string;
  level: SupportLevel;
  note: string;
}

export interface AnalysisFinding {
  category: 'architecture' | 'cost' | 'performance' | 'quality' | 'security';
  severity: 'info' | 'warning' | 'error';
  title: string;
  description: string;
  recommendation: string;
}

export interface WizardAnswers {
  buildType: string;
  codeSource: string;
  priorities: string[];
  dayOneFeatures: string[];
  projectName?: string;
  description?: string;
  prompt?: string;
}