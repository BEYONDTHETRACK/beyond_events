-- Message de validation de venue : quand la personne confirme, son statut passe de « inscrit » à « validé ».
alter table public.messages add column if not exists validates_attendance boolean not null default false;

drop function if exists public.send_message(uuid, text, text, text, jsonb, text, boolean, boolean, integer);
create or replace function public.send_message(p_event uuid, p_title text, p_body text, p_kind text, p_target jsonb, p_label text,
  p_require_confirm boolean, p_sms boolean, p_sms_delay integer, p_validate boolean default false)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.can_manage_event(p_event) then raise exception 'Non autorisé'; end if;
  insert into public.messages(event_id, title, body, kind, target, target_label, require_confirm, sms_fallback, sms_delay_min, created_by, validates_attendance)
  values (p_event, p_title, p_body, p_kind, coalesce(p_target, '{}'::jsonb), coalesce(p_label, ''), p_require_confirm or coalesce(p_validate, false), p_sms, p_sms_delay, (select auth.uid()), coalesce(p_validate, false))
  returning id into v_id;
  insert into public.message_recipients(message_id, participant_id)
  select v_id, p.id from public.participants p
  where p.event_id = p_event
    and (coalesce(p_target->>'distance', 'Toutes') in ('Toutes', '') or p.distance = p_target->>'distance')
    and (coalesce(p_target->>'format', 'Tous') in ('Tous', '') or p.format = p_target->>'format')
    and (coalesce(p_target->>'status', 'Tous') in ('Tous', '') or p.status = p_target->>'status')
    and (coalesce(p_target->>'lang', 'Tous') in ('Tous', '') or p.lang = p_target->>'lang');
  return v_id;
end $$;
revoke all on function public.send_message(uuid, text, text, text, jsonb, text, boolean, boolean, integer, boolean) from public, anon;
grant execute on function public.send_message(uuid, text, text, text, jsonb, text, boolean, boolean, integer, boolean) to authenticated;

create or replace function public.participant_confirm(p_code text, p_message uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid; v_validate boolean;
begin
  update public.message_recipients r set confirmed_at = coalesce(r.confirmed_at, now()), read_at = coalesce(r.read_at, now())
  from public.participants p
  where p.code = upper(trim(p_code)) and r.participant_id = p.id and r.message_id = p_message
  returning p.id into v_pid;
  select validates_attendance into v_validate from public.messages where id = p_message;
  if v_pid is not null and coalesce(v_validate, false) then
    update public.participants set status = 'valide' where id = v_pid and status = 'inscrit';
  end if;
end $$;

create or replace function public.participant_state(p_code text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_p public.participants;
begin
  select * into v_p from public.participants where code = upper(trim(p_code));
  if not found then return null; end if;
  update public.participants set last_seen_at = now(), activated_at = coalesce(activated_at, now()) where id = v_p.id;
  return jsonb_build_object(
    'participant', jsonb_build_object('id', v_p.id, 'bib', v_p.bib, 'name', v_p.name, 'distance', v_p.distance,
      'format', v_p.format, 'lang', v_p.lang, 'status', v_p.status, 'code', v_p.code, 'email', v_p.email),
    'event', private.event_json(v_p.event_id),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'kind', m.kind,
        'require_confirm', m.require_confirm, 'validates_attendance', m.validates_attendance, 'created_at', m.created_at, 'read_at', r.read_at, 'confirmed_at', r.confirmed_at)
        order by m.created_at desc)
      from public.message_recipients r join public.messages m on m.id = r.message_id
      where r.participant_id = v_p.id), '[]'::jsonb),
    'private', coalesce((
      select jsonb_agg(jsonb_build_object('id', pm.id, 'from_org', pm.from_org, 'body', pm.body, 'created_at', pm.created_at)
        order by pm.created_at)
      from public.private_messages pm where pm.participant_id = v_p.id), '[]'::jsonb)
  );
end $$;
