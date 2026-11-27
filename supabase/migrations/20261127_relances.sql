-- Relances d'un message : journal des relances faites par l'organisation (notification, e-mail, SMS).
-- L'envoi réel par e-mail et SMS sera branché plus tard ; pour l'instant la relance est enregistrée.
create table if not exists public.message_relances (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  channel text not null check (channel in ('app', 'email', 'sms')),
  recipients integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists message_relances_message_idx on public.message_relances(message_id, created_at desc);
alter table public.message_relances enable row level security;
drop policy if exists message_relances_select on public.message_relances;
create policy message_relances_select on public.message_relances for select to authenticated
  using (private.can_manage_event(event_id));

create or replace function public.relance_message(p_message uuid, p_channel text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare m public.messages; n integer;
begin
  select * into m from public.messages where id = p_message;
  if m.id is null then raise exception 'Message introuvable'; end if;
  if not private.can_manage_event(m.event_id) then raise exception 'Non autorisé'; end if;
  if p_channel not in ('app', 'email', 'sms') then raise exception 'Canal inconnu'; end if;
  select count(*) into n from public.message_recipients r
   where r.message_id = m.id and case when m.require_confirm then r.confirmed_at is null else r.read_at is null end;
  insert into public.message_relances(message_id, event_id, channel, recipients) values (m.id, m.event_id, p_channel, n);
  return n;
end $$;
revoke all on function public.relance_message(uuid, text) from public, anon;
grant execute on function public.relance_message(uuid, text) to authenticated;
