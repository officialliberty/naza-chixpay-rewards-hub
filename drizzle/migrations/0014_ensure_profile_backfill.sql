-- Backfill missing profile rows for existing accounts
INSERT INTO public.profiles (id, full_name, phone, state)
SELECT u.id,
       COALESCE(NULLIF(u.raw_user_meta_data->>'fullName',''), NULLIF(u.raw_user_meta_data->>'full_name',''), split_part(u.email, '@', 1)),
       COALESCE(NULLIF(u.raw_user_meta_data->>'phone',''), ''),
       COALESCE(NULLIF(u.raw_user_meta_data->>'state',''), '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Give any profile without a code a referral code
UPDATE public.profiles
SET referral_code = 'CHX' || upper(substr(md5(random()::text || id::text), 1, 6))
WHERE referral_code IS NULL OR referral_code = '';

-- Self-healing profile creation for signed-in users
CREATE OR REPLACE FUNCTION public.ensure_profile(_full_name text DEFAULT NULL, _phone text DEFAULT NULL, _state text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
  _meta jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT referral_code INTO _code FROM public.profiles WHERE id = _uid;
  IF FOUND THEN
    IF _code IS NULL OR _code = '' THEN
      _code := 'CHX' || upper(substr(md5(random()::text || _uid::text), 1, 6));
      UPDATE public.profiles SET referral_code = _code, updated_at = now() WHERE id = _uid;
    END IF;
    RETURN _code;
  END IF;

  SELECT raw_user_meta_data INTO _meta FROM auth.users WHERE id = _uid;

  INSERT INTO public.profiles (id, full_name, phone, state)
  VALUES (
    _uid,
    COALESCE(NULLIF(_full_name,''), NULLIF(_meta->>'fullName',''), NULLIF(_meta->>'full_name',''), 'ChixPay member'),
    COALESCE(NULLIF(_phone,''), NULLIF(_meta->>'phone',''), ''),
    COALESCE(NULLIF(_state,''), NULLIF(_meta->>'state',''), '')
  )
  RETURNING referral_code INTO _code;

  RETURN _code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text, text, text) TO authenticated;