-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Allowlist of emails permitted to claim the admin role
CREATE TABLE public.admin_allowlist (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_allowlist (email) VALUES ('sundaychinemerem266@gmail.com');

CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_allowlist WHERE lower(email) = _email) THEN
    RETURN public.has_role(auth.uid(), 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

-- Account moderation state
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS restriction_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS restricted_at timestamptz;

CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all referrals" ON public.referrals
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all upgrade requests" ON public.upgrade_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update upgrade requests" ON public.upgrade_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can read uploaded receipts
CREATE POLICY "Admins read upgrade receipts" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'upgrade-receipts' AND public.has_role(auth.uid(), 'admin'));

-- Admin data feed (joins auth.users for email / last sign in)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid, email text, full_name text, phone text, state text, status text,
  restriction_reason text, referral_code text, created_at timestamptz,
  last_sign_in_at timestamptz, referral_count bigint, upgrade_count bigint, pending_upgrades bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.phone, p.state,
         coalesce(p.status, 'active'), p.restriction_reason, p.referral_code,
         u.created_at, u.last_sign_in_at,
         (SELECT count(*) FROM public.referrals r WHERE r.referrer_id = u.id),
         (SELECT count(*) FROM public.upgrade_requests ur WHERE ur.user_id = u.id),
         (SELECT count(*) FROM public.upgrade_requests ur WHERE ur.user_id = u.id AND ur.status = 'pending')
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(_user_id uuid, _status text, _reason text DEFAULT NULL)
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
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_upgrade_status(_request_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _status NOT IN ('pending', 'approved', 'rejected') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE public.upgrade_requests SET status = _status WHERE id = _request_id;
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_upgrade_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_upgrade_requests()
RETURNS TABLE (
  id uuid, user_id uuid, email text, full_name text, plan_name text,
  amount numeric, receipt_path text, status text, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_authorised'; END IF;
  RETURN QUERY
  SELECT ur.id, ur.user_id, u.email::text, p.full_name, ur.plan_name, ur.amount,
         ur.receipt_path, ur.status, ur.created_at
  FROM public.upgrade_requests ur
  LEFT JOIN auth.users u ON u.id = ur.user_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  ORDER BY ur.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_upgrade_requests() TO authenticated;