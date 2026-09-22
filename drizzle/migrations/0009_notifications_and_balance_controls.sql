CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark their notifications read" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all notifications" ON public.notifications FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);

CREATE TABLE public.balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.balance_adjustments TO authenticated;
GRANT ALL ON public.balance_adjustments TO service_role;
ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their adjustments" ON public.balance_adjustments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all adjustments" ON public.balance_adjustments FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_balance_adjustments_user ON public.balance_adjustments (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _body text, _kind text DEFAULT 'info')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, title, body, kind) VALUES (_user_id, _title, _body, coalesce(_kind, 'info'));
$$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_notification(_user_id uuid, _title text, _body text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF length(btrim(coalesce(_title,''))) = 0 OR length(btrim(coalesce(_body,''))) = 0 THEN RAISE EXCEPTION 'invalid_message'; END IF;
  PERFORM public.notify_user(_user_id, btrim(_title), btrim(_body), 'message');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _amount numeric, _reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  INSERT INTO public.balance_adjustments (user_id, amount, reason, created_by)
  VALUES (_user_id, _amount, nullif(btrim(coalesce(_reason,'')), ''), auth.uid());
  PERFORM public.notify_user(
    _user_id,
    CASE WHEN _amount > 0 THEN 'Wallet credited' ELSE 'Wallet debited' END,
    CASE WHEN _amount > 0 THEN 'An amount of N' || to_char(_amount, 'FM999999999') || ' was added to your balance by ChixPay.'
         ELSE 'An amount of N' || to_char(abs(_amount), 'FM999999999') || ' was removed from your balance by ChixPay.' END
      || coalesce(' Reason: ' || nullif(btrim(coalesce(_reason,'')), ''), ''),
    'balance');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_balances()
RETURNS TABLE(user_id uuid, balance numeric, adjustments numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
    170000
      + coalesce((SELECT sum(c.amount) FROM public.reward_claims c WHERE c.user_id = u.id), 0)
      + coalesce((SELECT sum(t.amount) FROM public.task_completions t WHERE t.user_id = u.id), 0)
      + coalesce((SELECT sum(a.amount) FROM public.balance_adjustments a WHERE a.user_id = u.id), 0)
      - coalesce((SELECT sum(w.amount) FROM public.withdrawals w WHERE w.user_id = u.id), 0),
    coalesce((SELECT sum(a.amount) FROM public.balance_adjustments a WHERE a.user_id = u.id), 0)
  FROM auth.users u
  WHERE public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(_user_id uuid, _status text, _reason text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _status NOT IN ('active', 'restricted', 'suspended') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.profiles
     SET status = _status,
         restriction_reason = CASE WHEN _status = 'active' THEN NULL ELSE _reason END,
         restricted_at = CASE WHEN _status = 'active' THEN NULL ELSE now() END,
         updated_at = now()
   WHERE id = _user_id;
  IF _status = 'active' THEN
    PERFORM public.notify_user(_user_id, 'Account restored', 'Your ChixPay account has been restored. You now have full access again.', 'account');
  ELSE
    PERFORM public.notify_user(_user_id, 'Account restricted',
      'Your ChixPay account has been restricted.' || coalesce(' Reason: ' || nullif(btrim(coalesce(_reason,'')), ''), '') || ' Please contact support.', 'account');
  END IF;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_upgrade_status(_request_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.upgrade_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _status NOT IN ('pending', 'approved', 'rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.upgrade_requests SET status = _status WHERE id = _request_id RETURNING * INTO _req;
  IF _req.id IS NULL THEN RETURN false; END IF;
  IF _status = 'approved' THEN
    PERFORM public.notify_user(_req.user_id, 'Upgrade approved', 'Your ' || _req.plan_name || ' upgrade payment was approved. Your plan is now active.', 'payment');
  ELSIF _status = 'rejected' THEN
    PERFORM public.notify_user(_req.user_id, 'Upgrade payment rejected', 'Your ' || _req.plan_name || ' upgrade payment was rejected. Please contact support or upload a valid receipt.', 'payment');
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_chix_request_status(_request_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.chix_key_requests; _code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO _req FROM public.chix_key_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF _status = 'approved' THEN
    SELECT value INTO _code FROM public.app_settings WHERE key = 'chix_id_code';
    _code := coalesce(_code, 'CHIX-76628-22');
    INSERT INTO public.chix_keys (user_id, code, uses_total, uses_left, unlimited)
    VALUES (_req.user_id, _code, _req.uses_total, _req.uses_total, _req.uses_total IS NULL)
    ON CONFLICT (user_id) DO UPDATE
      SET code = excluded.code,
          uses_total = excluded.uses_total,
          uses_left = CASE WHEN excluded.unlimited THEN NULL
                           ELSE coalesce(public.chix_keys.uses_left, 0) + coalesce(excluded.uses_total, 0) END,
          unlimited = public.chix_keys.unlimited OR excluded.unlimited,
          updated_at = now();
    UPDATE public.chix_key_requests SET status = 'approved', chix_id = _code, reviewed_at = now() WHERE id = _request_id;
    PERFORM public.notify_user(_req.user_id, 'Chix ID approved', 'Your Chix ID payment was approved. Your Chix ID is ' || _code || '.', 'payment');
  ELSE
    UPDATE public.chix_key_requests SET status = _status, reviewed_at = now() WHERE id = _request_id;
    IF _status = 'rejected' THEN
      PERFORM public.notify_user(_req.user_id, 'Chix ID payment rejected', 'Your Chix ID payment was rejected. Please contact support or upload a valid receipt.', 'payment');
    END IF;
  END IF;
  RETURN true;
END;
$$;