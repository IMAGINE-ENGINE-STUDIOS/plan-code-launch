
DROP POLICY "Service role can insert usage logs" ON public.usage_logs;
CREATE POLICY "Users can insert own usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
