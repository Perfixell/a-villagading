-- Secure the capability used to start payment. Only the SHA-256 digest is
-- stored; the one-time plaintext token is returned to the booking browser.
alter table public.bookings
  add column if not exists payment_access_token_hash text;

comment on column public.bookings.payment_access_token_hash is
  'SHA-256 digest of the private browser capability required to start payment.';

-- Legacy pending holds predate the browser payment capability and cannot be
-- safely authorized for payment. Refuse the rollout until an operator has
-- confirmed or cancelled each one; never mutate a possibly-real stay silently.
do $$
begin
  if exists (
    select 1
    from public.bookings
    where booking_status = 'pending_payment'
      and payment_access_token_hash is null
  ) then
    raise exception
      'Resolve legacy pending_payment bookings before applying payment capability migration';
  end if;
end
$$;

alter table public.bookings
  drop constraint if exists bookings_payment_access_token_hash_format;
alter table public.bookings
  add constraint bookings_payment_access_token_hash_format
  check (
    payment_access_token_hash is null
    or payment_access_token_hash ~ '^[0-9a-f]{64}$'
  );

-- Replace legacy broad table grants with the minimum privileges exercised by
-- the public site and admin dashboard. RLS remains the row-level boundary.
revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.villas from anon, authenticated;
revoke all on table public.pricing_periods from anon, authenticated;
revoke all on table public.blocked_dates from anon, authenticated;

grant select on table public.admin_users to authenticated;
grant select, update on table public.bookings to authenticated;
grant select on table public.villas to anon, authenticated;
grant select on table public.pricing_periods to anon;
grant select, insert, update, delete on table public.pricing_periods to authenticated;
-- blocked_dates is consumed only through trusted server-side availability
-- checks. It has no direct public table grant.

-- is_admin is deliberately available only to signed-in users and is still
-- constrained by auth.uid() inside the function.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- The frontend and booking flow no longer call this legacy SECURITY DEFINER
-- RPC. Remove its public execution surface rather than retaining a bypass-RLS
-- endpoint that reveals booking occupancy.
revoke all on function public.check_villa_availability(bigint, date, date)
  from public, anon, authenticated;

-- Supabase recommends keeping extensions outside the exposed public schema.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
