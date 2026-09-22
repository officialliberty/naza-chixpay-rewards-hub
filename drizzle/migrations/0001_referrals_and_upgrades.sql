ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text DEFAULT ('CHX' || upper(substr(md5(random()::text), 1, 6))),
  ADD COLUMN IF NOT EXISTS referred_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  referred_name text NOT NULL DEFAULT 'ChixPay member',
  amount numeric NOT NULL DEFAULT 5200,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer can read their referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_name text NOT NULL,
  amount numeric NOT NULL,
  receipt_path text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.upgrade_requests TO authenticated;
GRANT ALL ON public.upgrade_requests TO service_role;
ALTER TABLE public.upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their upgrade requests" ON public.upgrade_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create their upgrade requests" ON public.upgrade_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_referral(_code text, _name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  SELECT id INTO _referrer FROM public.profiles
    WHERE upper(referral_code) = upper(btrim(_code)) LIMIT 1;
  IF _referrer IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  IF _referrer = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;
  INSERT INTO public.referrals (referrer_id, referred_id, referred_name)
    VALUES (_referrer, auth.uid(), coalesce(nullif(btrim(_name), ''), 'ChixPay member'));
  UPDATE public.profiles SET referred_by = _referrer WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true, 'amount', 5200);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_referral(text, text) TO authenticated;