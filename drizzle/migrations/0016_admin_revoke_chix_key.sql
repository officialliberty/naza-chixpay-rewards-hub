create or replace function public.admin_revoke_chix_key(_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _deleted boolean;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not_admin';
  end if;

  delete from public.chix_keys where user_id = _user_id;
  get diagnostics _deleted = row_count;

  if _deleted then
    perform public.notify_user(
      _user_id,
      'Chix ID revoked',
      'Your Chix ID has been revoked by an administrator. You will need a valid key to withdraw. Please contact support if you believe this is a mistake.',
      'key'
    );
  end if;

  return _deleted;
end;
$$;

revoke all on function public.admin_revoke_chix_key(uuid) from public, anon;
grant execute on function public.admin_revoke_chix_key(uuid) to authenticated;