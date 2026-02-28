
-- Create project_versions table for version snapshots
CREATE TABLE public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_label TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to projects for publish functionality
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS published_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'google/gemini-2.5-flash';

-- Enable RLS on project_versions
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_versions (scoped through project ownership)
CREATE POLICY "Users can view own project versions"
  ON public.project_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own project versions"
  ON public.project_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own project versions"
  ON public.project_versions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_versions.project_id AND projects.user_id = auth.uid()
  ));
