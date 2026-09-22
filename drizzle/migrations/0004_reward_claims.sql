CREATE TABLE public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 35000,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;

ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their claims" ON public.reward_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their claims" ON public.reward_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all claims" ON public.reward_claims FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX reward_claims_user_created_idx ON public.reward_claims (user_id, created_at DESC);