ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'completed';

CREATE TABLE IF NOT EXISTS public.withdrawal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fee','upgrade','final')),
  plan_name text,
  amount numeric NOT NULL,
  receipt_path text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT withdrawal_payments_amount_ck CHECK (
    (kind = 'fee' AND amount = 7600) OR (kind = 'final' AND amount = 19500) OR (kind = 'upgrade' AND amount > 0)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.withdrawal_payments TO authenticated;
GRANT ALL ON public.withdrawal_payments TO service_role;

ALTER TABLE public.withdrawal_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create their withdrawal payments" ON public.withdrawal_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read their withdrawal payments" ON public.withdrawal_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all withdrawal payments" ON public.withdrawal_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update withdrawal payments" ON public.withdrawal_payments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS withdrawal_payments_user_idx ON public.withdrawal_payments (user_id, created_at DESC);

CREATE POLICY "Users read their withdrawal rows via stage" ON public.withdrawals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.request_withdrawal(_code text, _amount numeric, _full_name text, _bank text, _account text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _key public.chix_keys; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT * INTO _key FROM public.chix_keys WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_key'); END IF;
  IF upper(btrim(_code)) <> upper(_key.code) THEN RETURN jsonb_build_object('ok', false, 'reason', 'wrong_code'); END IF;
  IF NOT _key.unlimited AND coalesce(_key.uses_left, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount'); END IF;

  IF NOT _key.unlimited THEN
    UPDATE public.chix_keys SET uses_left = uses_left - 1, updated_at = now() WHERE user_id = auth.uid();
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, full_name, bank_name, account_number, status, stage)
  VALUES (auth.uid(), _amount, _full_name, _bank, _account, 'processing', 'fee')
  RETURNING id INTO _id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', _id, 'stage', 'fee',
    'uses_left', CASE WHEN _key.unlimited THEN NULL ELSE _key.uses_left - 1 END,
    'unlimited', _key.unlimited);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_withdrawal_payments(_kind text)
 RETURNS TABLE(id uuid, withdrawal_id uuid, user_id uuid, email text, full_name text, kind text, plan_name text,
               amount numeric, receipt_path text, status text, created_at timestamptz,
               withdraw_amount numeric, bank_name text, account_number text, stage text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  RETURN QUERY
  SELECT p.id, p.withdrawal_id, p.user_id, u.email::text, coalesce(w.full_name, pr.full_name), p.kind, p.plan_name,
         p.amount, p.receipt_path, p.status, p.created_at, w.amount, w.bank_name, w.account_number, w.stage
  FROM public.withdrawal_payments p
  JOIN public.withdrawals w ON w.id = p.withdrawal_id
  LEFT JOIN auth.users u ON u.id = p.user_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE _kind IS NULL OR p.kind = _kind
  ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_withdrawal_payment_status(_payment_id uuid, _status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _p public.withdrawal_payments; _w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO _p FROM public.withdrawal_payments WHERE id = _payment_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _p.withdrawal_id;

  UPDATE public.withdrawal_payments SET status = _status, reviewed_at = now() WHERE id = _payment_id;

  IF _status = 'approved' THEN
    IF _p.kind = 'fee' THEN
      UPDATE public.withdrawals SET stage = 'upgrade' WHERE id = _w.id;
      PERFORM public.notify_user(_p.user_id, 'Withdrawal fee approved',
        'Your withdrawal fee of N7,600 was approved. Please choose an upgrade plan to continue your withdrawal.', 'payment');
    ELSIF _p.kind = 'upgrade' THEN
      UPDATE public.withdrawals SET stage = 'final' WHERE id = _w.id;
      PERFORM public.notify_user(_p.user_id, 'Upgrade approved',
        'Your ' || coalesce(_p.plan_name, 'upgrade') || ' payment was approved. One final policy payment of N19,500 completes your withdrawal.', 'payment');
    ELSE
      UPDATE public.withdrawals SET stage = 'completed', status = 'completed' WHERE id = _w.id;
      PERFORM public.notify_user(_p.user_id, 'Withdrawal released',
        'Your final payment was approved and N' || to_char(_w.amount, 'FM999999999') || ' has been sent to ' || _w.bank_name || '.', 'payment');
    END IF;
  ELSIF _status = 'rejected' THEN
    UPDATE public.withdrawals SET stage = _p.kind WHERE id = _w.id;
    PERFORM public.notify_user(_p.user_id, 'Payment rejected',
      'Your ' || CASE _p.kind WHEN 'fee' THEN 'withdrawal fee' WHEN 'upgrade' THEN 'upgrade' ELSE 'final' END
      || ' payment was rejected. Please upload a valid receipt or contact support.', 'payment');
  END IF;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_balances()
 RETURNS TABLE(user_id uuid, balance numeric, adjustments numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.id,
    170000
      + coalesce((SELECT sum(c.amount) FROM public.reward_claims c WHERE c.user_id = u.id), 0)
      + coalesce((SELECT sum(t.amount) FROM public.task_completions t WHERE t.user_id = u.id), 0)
      + coalesce((SELECT sum(a.amount) FROM public.balance_adjustments a WHERE a.user_id = u.id), 0)
      - coalesce((SELECT sum(w.amount) FROM public.withdrawals w WHERE w.user_id = u.id AND w.stage = 'completed'), 0),
    coalesce((SELECT sum(a.amount) FROM public.balance_adjustments a WHERE a.user_id = u.id), 0)
  FROM auth.users u
  WHERE public.has_role(auth.uid(), 'admin');
$function$;