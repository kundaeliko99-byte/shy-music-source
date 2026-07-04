create or replace function public.check_identifier_auth_flow(
  identifier text,
  identifier_type text
)
returns jsonb
language plpgsql
security definer
set search_path = auth, public
as $$
declare
  password_hash text;
begin
  if identifier_type not in ('email', 'phone') then
    raise exception 'Unsupported identifier type';
  end if;

  select encrypted_password
  into password_hash
  from auth.users
  where
    (identifier_type = 'email' and lower(email) = lower(identifier))
    or
    (identifier_type = 'phone' and phone = identifier)
  limit 1;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  return jsonb_build_object(
    'exists', true,
    'hasPassword', coalesce(length(password_hash) > 0, false)
  );
end;
$$;

revoke all on function public.check_identifier_auth_flow(text, text) from public;
grant execute on function public.check_identifier_auth_flow(text, text) to service_role;
