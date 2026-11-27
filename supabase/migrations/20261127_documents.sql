-- Documents de l'événement (road book, règlement, plans…) envoyés aux participant·es et/ou aux bénévoles.
-- Le fichier est gardé à part (base64) pour que la liste reste légère ; l'accès se fait par code personnel.

create table public.event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null default 'autre',
  title text not null,
  file_name text not null,
  mime text not null default 'application/octet-stream',
  size_bytes integer not null default 0,
  audience text not null default 'tous' check (audience in ('tous', 'participants', 'benevoles')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.event_documents(event_id);

create table public.event_document_files (
  document_id uuid primary key references public.event_documents(id) on delete cascade,
  data text not null
);

alter table public.event_documents enable row level security;
alter table public.event_document_files enable row level security;
create policy "gestion par l'organisation" on public.event_documents for all to authenticated
  using (private.can_manage_event(event_id)) with check (private.can_manage_event(event_id));
create policy "gestion par l'organisation" on public.event_document_files for all to authenticated
  using (exists (select 1 from public.event_documents d where d.id = document_id and private.can_manage_event(d.event_id)))
  with check (exists (select 1 from public.event_documents d where d.id = document_id and private.can_manage_event(d.event_id)));

-- Liste des documents visibles par le code (participant ou bénévole).
create or replace function public.code_documents(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_event uuid; v_role text;
begin
  select event_id into v_event from public.participants where code = upper(trim(p_code));
  if v_event is not null then v_role := 'participants'; end if;
  if v_event is null then
    select event_id into v_event from public.volunteers where code = upper(trim(p_code));
    if v_event is not null then v_role := 'benevoles'; end if;
  end if;
  if v_event is null then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'title', d.title, 'file_name', d.file_name,
            'mime', d.mime, 'size_bytes', d.size_bytes, 'created_at', d.created_at) order by d.position, d.created_at)
          from public.event_documents d where d.event_id = v_event and d.audience in ('tous', v_role)), '[]'::jsonb);
end $$;

-- Contenu d'un document (base64) si le code y a droit.
create or replace function public.code_document_file(p_code text, p_doc uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_event uuid; v_role text; r record;
begin
  select event_id into v_event from public.participants where code = upper(trim(p_code));
  if v_event is not null then v_role := 'participants'; end if;
  if v_event is null then
    select event_id into v_event from public.volunteers where code = upper(trim(p_code));
    if v_event is not null then v_role := 'benevoles'; end if;
  end if;
  if v_event is null then return null; end if;
  select d.file_name, d.mime, f.data into r from public.event_documents d join public.event_document_files f on f.document_id = d.id
   where d.id = p_doc and d.event_id = v_event and d.audience in ('tous', v_role);
  if not found then return null; end if;
  return jsonb_build_object('file_name', r.file_name, 'mime', r.mime, 'data', r.data);
end $$;

revoke all on function public.code_documents(text), public.code_document_file(text, uuid) from public;
grant execute on function public.code_documents(text), public.code_document_file(text, uuid) to anon, authenticated;
