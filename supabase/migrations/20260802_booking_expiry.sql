-- Unpaid website bookings hold inventory for 30 minutes, then expire.
alter table public.bookings
  add column if not exists expires_at timestamptz;

update public.bookings
set expires_at = created_at + interval '30 minutes'
where booking_status = 'pending_payment'
  and expires_at is null;

create index if not exists bookings_pending_expiry_idx
  on public.bookings (expires_at)
  where booking_status = 'pending_payment';
