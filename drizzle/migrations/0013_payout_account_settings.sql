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
  IF _key NOT IN ('chix_id_code', 'support_email', 'support_telegram_url', 'support_whatsapp_url', 'withdraw_direct',
                  'pay_bank_name', 'pay_account_name', 'pay_account_number') THEN
    RAISE EXCEPTION 'invalid_setting';
  END IF;
  IF length(_clean) = 0 OR length(_clean) > 500 THEN RAISE EXCEPTION 'invalid_value'; END IF;
  IF _key = 'withdraw_direct' AND _clean NOT IN ('on','off') THEN RAISE EXCEPTION 'invalid_value'; END IF;
  IF _key = 'pay_account_number' AND _clean !~ '^[0-9]{10,11}$' THEN RAISE EXCEPTION 'invalid_account_number'; END IF;
  IF _key IN ('pay_bank_name','pay_account_name') AND length(_clean) > 120 THEN RAISE EXCEPTION 'invalid_value'; END IF;
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