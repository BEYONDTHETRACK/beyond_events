-- L'admin plateforme peut créer des organisations et des événements, et préparer leur contenu
-- sans être membre (private.can_manage_event inclut déjà l'admin) ; il rattache ensuite les organisateurs par e-mail (invitation si pas encore de compte).

drop policy if exists "membres créent des événements" on public.events;
create policy "membres créent des événements" on public.events for insert to authenticated
  with check (private.is_org_member(org_id) or private.is_platform_admin());
drop policy if exists "membres suppriment les événements" on public.events;
create policy "membres suppriment les événements" on public.events for delete to authenticated
  using (private.is_org_member(org_id) or private.is_platform_admin());
drop policy if exists "membres modifient l'organisation" on public.organizations;
create policy "membres modifient l'organisation" on public.organizations for update to authenticated
  using (private.is_org_member(id) or private.is_platform_admin())
  with check (private.is_org_member(id) or private.is_platform_admin());

create table if not exists public.org_invites (
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);
alter table public.org_invites enable row level security;
-- Aucun accès direct : tout passe par les fonctions ci-dessous.

create or replace function public.admin_create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not private.is_platform_admin() then raise exception 'Réservé à l''administrateur de la plateforme'; end if;
  insert into public.organizations(name) values (trim(p_name)) returning id into v;
  return v;
end $$;

create or replace function public.admin_add_member(p_org uuid, p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_email text := lower(trim(p_email));
begin
  if not private.is_platform_admin() then raise exception 'Réservé à l''administrateur de la plateforme'; end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is not null then
    insert into public.org_members(org_id, user_id) values (p_org, v_user) on conflict do nothing;
    return 'ajouté';
  end if;
  insert into public.org_invites(org_id, email) values (p_org, v_email) on conflict do nothing;
  return 'invité';
end $$;

create or replace function public.admin_remove_member(p_org uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(p_email));
begin
  if not private.is_platform_admin() then raise exception 'Réservé à l''administrateur de la plateforme'; end if;
  delete from public.org_invites where org_id = p_org and email = v_email;
  delete from public.org_members m using auth.users u where m.org_id = p_org and m.user_id = u.id and lower(u.email) = v_email;
end $$;

create or replace function public.admin_org_members(p_org uuid) returns table(email text, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then raise exception 'Réservé à l''administrateur de la plateforme'; end if;
  return query
    select u.email::text, 'membre'::text from public.org_members m join auth.users u on u.id = m.user_id where m.org_id = p_org
    union all
    select i.email, 'invité' from public.org_invites i where i.org_id = p_org
    order by 1;
end $$;

-- Appelée à la connexion : rattache l'organisateur aux organisations où il a été invité.
create or replace function public.claim_invites() returns int
language plpgsql security definer set search_path = '' as $$
declare v_email text; n int;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  insert into public.org_members(org_id, user_id)
    select org_id, auth.uid() from public.org_invites where email = v_email on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.org_invites where email = v_email;
  return n;
end $$;

revoke execute on function public.admin_create_organization(text), public.admin_add_member(uuid, text),
  public.admin_remove_member(uuid, text), public.admin_org_members(uuid), public.claim_invites() from public, anon;
grant execute on function public.admin_create_organization(text), public.admin_add_member(uuid, text),
  public.admin_remove_member(uuid, text), public.admin_org_members(uuid), public.claim_invites() to authenticated;
