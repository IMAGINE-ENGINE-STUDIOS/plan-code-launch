
-- Pricing plans table
CREATE TABLE public.pricing_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_cents integer NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_enterprise boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pricing plans are viewable by everyone" ON public.pricing_plans FOR SELECT USING (true);

INSERT INTO public.pricing_plans (name, slug, price_cents, credits, description, is_enterprise, sort_order, features) VALUES
  ('Starter', 'starter', 1900, 1900, 'Perfect for individuals and small projects', false, 1, '["1,900 credits/month", "All AI models", "1 project", "Community support"]'::jsonb),
  ('Pro', 'pro', 5000, 5000, 'For professionals building production apps', false, 2, '["5,000 credits/month", "All AI models", "5 projects", "Priority support", "Custom domains"]'::jsonb),
  ('Business', 'business', 25000, 25000, 'For teams and growing businesses', false, 3, '["25,000 credits/month", "All AI models", "25 projects", "Priority support", "Custom domains", "Team collaboration"]'::jsonb),
  ('Scale', 'scale', 50000, 50000, 'For large-scale operations', false, 4, '["50,000 credits/month", "All AI models", "Unlimited projects", "Dedicated support", "Custom domains", "Team collaboration", "SLA guarantee"]'::jsonb),
  ('Enterprise', 'enterprise', 0, 0, 'Custom solutions for enterprise needs', true, 5, '["Custom credit allocation", "All AI models", "Unlimited projects", "Dedicated account manager", "Custom SLA", "SSO & audit logs", "On-premise options"]'::jsonb);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.pricing_plans(id),
  stripe_subscription_id text,
  stripe_customer_id text,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- Credit balances
CREATE TABLE public.credit_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own balance" ON public.credit_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own balance" ON public.credit_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own balance" ON public.credit_balances FOR UPDATE USING (auth.uid() = user_id);

-- Credit transactions (audit log)
CREATE TABLE public.credit_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL DEFAULT 0,
  type text NOT NULL,
  description text NOT NULL DEFAULT '',
  project_id uuid REFERENCES public.projects(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_balances_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
