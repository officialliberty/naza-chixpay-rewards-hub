CREATE OR REPLACE FUNCTION public.admin_set_setting(_key text, _value text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _clean text := btrim(_value);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _key NOT IN ('chix_id_code', 'support_email', 'support_telegram_url', 'support_whatsapp_url', 'withdraw_direct') THEN
    RAISE EXCEPTION 'invalid_setting';
  END IF;
  IF length(_clean) = 0 OR length(_clean) > 500 THEN RAISE EXCEPTION 'invalid_value'; END IF;
  IF _key = 'withdraw_direct' AND _clean NOT IN ('on','off') THEN RAISE EXCEPTION 'invalid_value'; END IF;
  IF _key = 'support_email' AND _clean !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF _key = 'support_telegram_url' AND _clean !~* '^https://(t\.me|telegram\.me)/[A-Za-z0-9_+/?=&.-]+$' THEN
    RAISE EXCEPTION 'invalid_telegram_url';
  END IF;
  IF _key = 'support_whatsapp_url' AND _clean !~* '^https://(chat\.whatsapp\.com|whatsapp\.com/channel)/[A-Za-z0-9_+/?=&.-]+$' THEN
    RAISE EXCEPTION 'invalid_whatsapp_url';
  END IF;
  INSERT INTO public.app_settings (key, value, updated_at) VALUES (_key, _clean, now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_code text, _amount numeric, _full_name text, _bank text, _account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _key public.chix_keys; _w_id uuid; _direct text; _stage text;
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

  SELECT value INTO _direct FROM public.app_settings WHERE key = 'withdraw_direct';
  _stage := CASE WHEN coalesce(_direct, 'off') = 'on' THEN 'completed' ELSE 'fee' END;

  IF NOT _key.unlimited THEN
    UPDATE public.chix_keys SET uses_left = uses_left - 1, updated_at = now() WHERE user_id = auth.uid();
  END IF;

  INSERT INTO public.withdrawals (user_id, amount, full_name, bank_name, account_number, stage, status)
  VALUES (auth.uid(), _amount, _full_name, _bank, _account, _stage,
          CASE WHEN _stage = 'completed' THEN 'completed' ELSE 'processing' END)
  RETURNING id INTO _w_id;

  IF _stage = 'completed' THEN
    PERFORM public.notify_user(auth.uid(), 'Withdrawal approved',
      'Your withdrawal of NGN ' || _amount::text || ' has been approved and is on its way to your bank account.', 'payment');
  END IF;

  RETURN jsonb_build_object('ok', true, 'withdrawal_id', _w_id, 'stage', _stage, 'uses_left',
    CASE WHEN _key.unlimited THEN NULL ELSE _key.uses_left - 1 END,
    'unlimited', _key.unlimited);
END;
$$;