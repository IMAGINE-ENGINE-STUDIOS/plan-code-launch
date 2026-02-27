
CREATE TABLE public.usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  model text NOT NULL DEFAULT '',
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  estimated_cost numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_usage_logs_project ON public.usage_logs(project_id);
CREATE INDEX idx_usage_logs_user ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created ON public.usage_logs(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_logs;
