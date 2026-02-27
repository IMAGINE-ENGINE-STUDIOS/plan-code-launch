
-- Create project_secrets table
CREATE TABLE public.project_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

-- Enable RLS
ALTER TABLE public.project_secrets ENABLE ROW LEVEL SECURITY;

-- RLS: only project owner can SELECT
CREATE POLICY "Users can view own project secrets"
ON public.project_secrets
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = project_secrets.project_id AND projects.user_id = auth.uid()
));

-- RLS: only project owner can INSERT
CREATE POLICY "Users can insert own project secrets"
ON public.project_secrets
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = project_secrets.project_id AND projects.user_id = auth.uid()
));

-- RLS: only project owner can UPDATE
CREATE POLICY "Users can update own project secrets"
ON public.project_secrets
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = project_secrets.project_id AND projects.user_id = auth.uid()
));

-- RLS: only project owner can DELETE
CREATE POLICY "Users can delete own project secrets"
ON public.project_secrets
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects WHERE projects.id = project_secrets.project_id AND projects.user_id = auth.uid()
));
