-- Editable app settings (holds the default Chix ID code)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in members read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('chix_id_code', 'CHIX-76628-22');

-- Chix ID purchase requests
CREATE TABLE public.chix_key_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text,
  plan_name text NOT NULL,
  amount numeric NOT NULL,
  uses_total integer,
  receipt_path text,
  status text NOT NULL DEFAULT 'pending',
  chix_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT ON public.chix_key_requests TO authenticated;
GRANT ALL ON public.chix_key_requests TO service_role;
ALTER TABLE public.chix_key_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their key requests" ON public.chix_key_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create their key requests" ON public.chix_key_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all key requests" ON public.chix_key_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update key requests" ON public.chix_key_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Active Chix ID keys
CREATE TABLE public.chix_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  uses_total integer,
  uses_left integer,
  unlimited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chix_keys TO authenticated;
GRANT ALL ON public.chix_keys TO service_role;
ALTER TABLE public.chix_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their key" ON public.chix_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all keys" ON public.chix_keys FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Withdrawals
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  full_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all withdrawals" ON public.withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin: list Chix ID requests
CREATE OR REPLACE FUNCTION public.admin_list_chix_requests()
RETURNS TABLE(id uuid, user_id uuid, email text, full_name text, plan_name text, amount numeric,
              uses_total integer, receipt_path text, status text, chix_id text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, u.email::text, coalesce(r.full_name, p.full_name), r.plan_name, r.amount,
         r.uses_total, r.receipt_path, r.status, r.chix_id, r.created_at
  FROM public.chix_key_requests r
  LEFT JOIN auth.users u ON u.id = r.user_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  ORDER BY r.created_at DESC;
END;
$$;

-- Admin: approve / reject a Chix ID request
CREATE OR REPLACE FUNCTION public.admin_set_chix_request_status(_request_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  ELSE
    UPDATE public.chix_key_requests SET status = _status, reviewed_at = now() WHERE id = _request_id;
  END IF;
  RETURN true;
END;
$$;

-- Admin: change an app setting (e.g. the Chix ID code)
CREATE OR REPLACE FUNCTION public.admin_set_setting(_key text, _value text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  INSERT INTO public.app_settings (key, value, updated_at) VALUES (_key, _value, now())
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now();
  RETURN true;
END;
$$;

-- Member: spend a Chix ID use to place a withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(_code text, _amount numeric, _full_name text, _bank text, _account text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _key public.chix_keys;
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

  INSERT INTO public.withdrawals (user_id, amount, full_name, bank_name, account_number)
  VALUES (auth.uid(), _amount, _full_name, _bank, _account);

  RETURN jsonb_build_object('ok', true, 'uses_left',
    CASE WHEN _key.unlimited THEN NULL ELSE _key.uses_left - 1 END,
    'unlimited', _key.unlimited);
END;
$$;
