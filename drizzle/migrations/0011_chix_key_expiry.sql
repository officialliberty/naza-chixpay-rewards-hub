ALTER TABLE public.chix_keys ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill: existing limited keys get one day per purchased use from their creation date
UPDATE public.chix_keys
SET expires_at = created_at + (coalesce(uses_total, 1) * interval '1 day')
WHERE unlimited = false AND expires_at IS NULL;

CREATE OR REPLACE FUNCTION public.admin_set_chix_request_status(_request_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _req public.chix_key_requests; _code text; _days integer; _expiry timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO _req FROM public.chix_key_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF _status = 'approved' THEN
    SELECT value INTO _code FROM public.app_settings WHERE key = 'chix_id_code';
    _code := coalesce(_code, 'CHIX-76628-22');
    _days := coalesce(_req.uses_total, 0);
    _expiry := CASE WHEN _req.uses_total IS NULL THEN NULL ELSE now() + (_days * interval '1 day') END;

    INSERT INTO public.chix_keys (user_id, code, uses_total, uses_left, unlimited, expires_at)
    VALUES (_req.user_id, _code, _req.uses_total, _req.uses_total, _req.uses_total IS NULL, _expiry)
    ON CONFLICT (user_id) DO UPDATE
      SET code = excluded.code,
          uses_total = excluded.uses_total,
          uses_left = CASE WHEN excluded.unlimited THEN NULL ELSE coalesce(excluded.uses_total, 0) END,
          unlimited = public.chix_keys.unlimited OR excluded.unlimited,
          expires_at = CASE WHEN (public.chix_keys.unlimited OR excluded.unlimited) THEN NULL ELSE excluded.expires_at END,
          updated_at = now();

    UPDATE public.chix_key_requests SET status = 'approved', chix_id = _code, reviewed_at = now() WHERE id = _request_id;
    PERFORM public.notify_user(_req.user_id, 'Chix ID approved',
      'Your Chix ID payment was approved. Your Chix ID is ' || _code || '.' ||
      CASE WHEN _req.uses_total IS NULL THEN ' It never expires and has unlimited withdrawals.'
           ELSE ' It allows ' || _days || ' withdrawal(s) and stays valid for ' || _days || ' day(s).' END, 'payment');
  ELSE
    UPDATE public.chix_key_requests SET status = _status, reviewed_at = now() WHERE id = _request_id;
    IF _status = 'rejected' THEN
      PERFORM public.notify_user(_req.user_id, 'Chix ID payment rejected', 'Your Chix ID payment was rejected. Please contact support or upload a valid receipt.', 'payment');
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_code text, _amount numeric, _full_name text, _bank text, _account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key public.chix_keys; _w_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT * INTO _key FROM public.chix_keys WHERE user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_key'); END IF;
  IF upper(btrim(_code)) <> upper(_key.code) THEN RETURN jsonb_build_object('ok', false, 'reason', 'wrong_code'); END IF;
  IF NOT _key.unlimited AND _key.expires_at IS NOT NULL AND _key.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  IF NOT _key.unlimited AND coalesce(_key.uses_left, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount'); END IF;

  IF NOT _key.unlimited THEN
    UPDATE public.chix_keys SET uses_left = uses_left - 1, updated_at = now() WHERE user_id = auth.uid();
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, full_name, bank_name, account_number, stage)
  VALUES (auth.uid(), _amount, _full_name, _bank, _account, 'fee')
  RETURNING id INTO _w_id;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', _w_id, 'stage', 'fee', 'uses_left',
    CASE WHEN _key.unlimited THEN NULL ELSE _key.uses_left - 1 END,
    'unlimited', _key.unlimited);
END;
$$;