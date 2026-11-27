-- Contacts de l'événement (visibles par les bénévoles) et dotations des bénévoles.

alter table public.events add column if not exists sizes_deadline date;

create table public.event_contacts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null,
  name text not null default '',
  phone text,
  email text,
  note text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.event_contacts(event_id);

-- Articles : don (le bénévole le garde) ou prêt (à rendre). Tailles au choix du bénévole si la liste n'est pas vide.
create table public.dotation_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  kind text not null default 'don' check (kind in ('don', 'pret')),
  sizes text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.dotation_items(event_id);

-- Types de dotation (ex. « Standard », « Haute montagne »), attribués à tous, à des postes ou à des bénévoles.
create table public.dotation_packs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  for_all boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.dotation_packs(event_id);

create table public.dotation_pack_items (
  pack_id uuid not null references public.dotation_packs(id) on delete cascade,
  item_id uuid not null references public.dotation_items(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  qty integer not null default 1 check (qty > 0),
  primary key (pack_id, item_id)
);
create table public.dotation_pack_posts (
  pack_id uuid not null references public.dotation_packs(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (pack_id, post_id)
);
create table public.dotation_pack_volunteers (
  pack_id uuid not null references public.dotation_packs(id) on delete cascade,
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  primary key (pack_id, volunteer_id)
);

-- Suivi par bénévole et par article : taille choisie, remis, rendu.
create table public.volunteer_dotation (
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  item_id uuid not null references public.dotation_items(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  size text,
  given_at timestamptz,
  returned_at timestamptz,
  note text not null default '',
  primary key (volunteer_id, item_id)
);

do $$
declare t text;
begin
  foreach t in array array['event_contacts','dotation_items','dotation_packs','dotation_pack_items','dotation_pack_posts','dotation_pack_volunteers','volunteer_dotation'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "gestion par l''organisation" on public.%I for all to authenticated using (private.can_manage_event(event_id)) with check (private.can_manage_event(event_id))', t);
  end loop;
end $$;

-- Articles dus à un bénévole : réunion des types de dotation qui le concernent (tous, son poste, lui).
create or replace function private.volunteer_items(p_volunteer uuid)
returns table(item_id uuid, qty integer, packs text)
language sql stable security definer set search_path = '' as $$
  select pi.item_id, max(pi.qty)::int, string_agg(distinct p.name, ', ')
  from public.volunteers v
  join public.dotation_packs p on p.event_id = v.event_id
  join public.dotation_pack_items pi on pi.pack_id = p.id
  where v.id = p_volunteer
    and (p.for_all
      or exists (select 1 from public.dotation_pack_posts pp where pp.pack_id = p.id and pp.post_id = v.post_id)
      or exists (select 1 from public.dotation_pack_volunteers pv where pv.pack_id = p.id and pv.volunteer_id = v.id))
  group by pi.item_id
$$;

-- Vue organisateur : une ligne par bénévole et par article dû.
create or replace function public.event_volunteer_dotation(p_event uuid)
returns table(volunteer_id uuid, volunteer_name text, post_name text, item_id uuid, item_name text, kind text,
              sizes text[], qty integer, packs text, size text, given_at timestamptz, returned_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_event(p_event) then raise exception 'Non autorisé'; end if;
  return query
    select v.id, v.name, po.name, i.id, i.name, i.kind, i.sizes, vi.qty, vi.packs, vd.size, vd.given_at, vd.returned_at
    from public.volunteers v
    left join public.posts po on po.id = v.post_id
    cross join lateral private.volunteer_items(v.id) vi
    join public.dotation_items i on i.id = vi.item_id
    left join public.volunteer_dotation vd on vd.volunteer_id = v.id and vd.item_id = i.id
    where v.event_id = p_event
    order by v.name, i.position, i.name;
end $$;

-- Espace bénévole : contacts, dotation, date limite des tailles.
create or replace function public.volunteer_extras(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.volunteers; e public.events;
begin
  select * into v from public.volunteers where code = upper(trim(p_code));
  if v.id is null then return null; end if;
  select * into e from public.events where id = v.event_id;
  return jsonb_build_object(
    'sizes_deadline', e.sizes_deadline,
    'can_choose', e.sizes_deadline is null or current_date <= e.sizes_deadline,
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'role', c.role, 'name', c.name, 'phone', c.phone, 'email', c.email, 'note', c.note) order by c.position, c.role)
                          from public.event_contacts c where c.event_id = v.event_id), '[]'::jsonb),
    'dotation', coalesce((select jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.name, 'kind', i.kind, 'sizes', i.sizes, 'qty', vi.qty, 'packs', vi.packs,
                                   'size', vd.size, 'given_at', vd.given_at, 'returned_at', vd.returned_at) order by i.position, i.name)
                          from private.volunteer_items(v.id) vi
                          join public.dotation_items i on i.id = vi.item_id
                          left join public.volunteer_dotation vd on vd.volunteer_id = v.id and vd.item_id = i.id), '[]'::jsonb),
    'post_packs', coalesce((select jsonb_agg(p.name order by p.name) from public.dotation_packs p
                            where p.event_id = v.event_id and (p.for_all or exists (select 1 from public.dotation_pack_posts pp where pp.pack_id = p.id and pp.post_id = v.post_id))), '[]'::jsonb)
  );
end $$;

create or replace function public.volunteer_set_size(p_code text, p_item uuid, p_size text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v public.volunteers; e public.events; i public.dotation_items;
begin
  select * into v from public.volunteers where code = upper(trim(p_code));
  if v.id is null then raise exception 'Code inconnu'; end if;
  select * into e from public.events where id = v.event_id;
  if e.sizes_deadline is not null and current_date > e.sizes_deadline then
    raise exception 'La date limite pour choisir les tailles est passée. Contacte l''organisation.';
  end if;
  select * into i from public.dotation_items where id = p_item and event_id = v.event_id;
  if i.id is null or not exists (select 1 from private.volunteer_items(v.id) x where x.item_id = p_item) then raise exception 'Article non prévu pour toi'; end if;
  if not (p_size = any(i.sizes)) then raise exception 'Taille inconnue'; end if;
  insert into public.volunteer_dotation(volunteer_id, item_id, event_id, size) values (v.id, p_item, v.event_id, p_size)
  on conflict (volunteer_id, item_id) do update set size = excluded.size;
end $$;

grant execute on function public.volunteer_extras(text), public.volunteer_set_size(text, uuid, text) to anon, authenticated;
revoke execute on function public.event_volunteer_dotation(uuid) from public, anon;
grant execute on function public.event_volunteer_dotation(uuid) to authenticated;
