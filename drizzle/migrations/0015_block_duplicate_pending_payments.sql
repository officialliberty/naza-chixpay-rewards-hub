CREATE OR REPLACE FUNCTION public.block_pending_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pending int;
BEGIN
  SELECT
    (SELECT count(*) FROM public.chix_key_requests WHERE user_id = NEW.user_id AND status = 'pending')
  + (SELECT count(*) FROM public.upgrade_requests WHERE user_id = NEW.user_id AND status = 'pending')
  + (SELECT count(*) FROM public.withdrawal_payments WHERE user_id = NEW.user_id AND status = 'pending')
  INTO _pending;

  IF _pending > 0 THEN
    RAISE EXCEPTION 'pending_payment_exists';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER block_pending_chix_request
BEFORE INSERT ON public.chix_key_requests
FOR EACH ROW EXECUTE FUNCTION public.block_pending_payment();

CREATE TRIGGER block_pending_upgrade_request
BEFORE INSERT ON public.upgrade_requests
FOR EACH ROW EXECUTE FUNCTION public.block_pending_payment();

CREATE TRIGGER block_pending_withdrawal_payment
BEFORE INSERT ON public.withdrawal_payments
FOR EACH ROW EXECUTE FUNCTION public.block_pending_payment();