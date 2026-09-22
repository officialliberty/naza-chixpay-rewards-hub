CREATE OR REPLACE FUNCTION public.settle_direct_withdrawals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _direct text; _row record; _count int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  SELECT value INTO _direct FROM public.app_settings WHERE key = 'withdraw_direct';
  IF coalesce(_direct, 'off') <> 'on' THEN RETURN jsonb_build_object('ok', true, 'settled', 0); END IF;

  FOR _row IN SELECT id, amount FROM public.withdrawals WHERE user_id = auth.uid() AND stage <> 'completed' LOOP
    UPDATE public.withdrawals SET stage = 'completed', status = 'completed' WHERE id = _row.id;
    UPDATE public.withdrawal_payments SET status = 'approved', reviewed_at = now()
      WHERE withdrawal_id = _row.id AND status = 'pending';
    PERFORM public.notify_user(auth.uid(), 'Withdrawal approved',
      'Your withdrawal of NGN ' || _row.amount::text || ' has been approved and is on its way to your bank account.', 'payment');
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'settled', _count);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_direct_withdrawals() FROM anon;
GRANT EXECUTE ON FUNCTION public.settle_direct_withdrawals() TO authenticated;