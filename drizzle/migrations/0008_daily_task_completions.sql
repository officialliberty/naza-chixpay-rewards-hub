CREATE TABLE public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_key text NOT NULL,
  task_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Lagos')::date,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_key, task_day)
);

GRANT SELECT, INSERT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;

ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their task completions" ON public.task_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their task completions" ON public.task_completions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all task completions" ON public.task_completions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_task_completions_user_day ON public.task_completions (user_id, task_day DESC);