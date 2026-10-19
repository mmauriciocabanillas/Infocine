-- INFOCINE: límite de cuatro y borrado administrativo. No borra reservas al instalarse.
begin;

update public.cine_events set max_seats=least(max_seats,4);
alter table public.cine_events alter column max_seats set default 4;

create or replace function public.cine_person_key(p_name text) returns text
language sql immutable strict set search_path='' as $$
  select lower(regexp_replace(btrim(translate(normalize(p_name,NFC),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')), '\s+', ' ', 'g'));
$$;

create or replace function public.cine_reserve(p_event text,p_name text,p_seats text[],p_request uuid,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.cine_events; r public.cine_reservations; held bigint;
begin
  -- Compartir el bloqueo de la función con el borrado evita confirmaciones parciales.
  select * into e from public.cine_events where id=p_event for update;
  if not found then raise exception 'CLOSED'; end if;
  select * into r from public.cine_reservations where request_id=p_request;
  if found then
    if r.fingerprint<>p_fingerprint or r.event_id<>p_event then raise exception 'IDEMPOTENCY'; end if;
    return public.cine_booking(r.access_token);
  end if;
  if not e.booking_open or e.closes_at<=now() then raise exception 'CLOSED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 3 and 100 or p_name ~ '[<>[:cntrl:]]' then raise exception 'NAME'; end if;
  if cardinality(p_seats)>4 then raise exception 'SEAT_LIMIT'; end if;
  if p_seats is null or cardinality(p_seats) not between 1 and least(e.max_seats,4)
    or cardinality(p_seats)<>(select count(distinct x) from unnest(p_seats) x)
    or exists(select 1 from unnest(p_seats) x where x is null or not exists(select 1 from public.cine_seats s where s.id=x)) then raise exception 'SEATS'; end if;
  if exists(select 1 from public.cine_tickets where event_id=p_event and seat=any(p_seats) and status<>'cancelled') then raise exception 'CONFLICT'; end if;
  select count(*) into held from public.cine_tickets t join public.cine_reservations b on b.id=t.reservation_id
    where t.event_id=p_event and t.status<>'cancelled' and public.cine_person_key(b.name)=public.cine_person_key(p_name);
  if held+cardinality(p_seats)>4 then raise exception 'PERSON_LIMIT'; end if;
  insert into public.cine_reservations(event_id,name,request_id,fingerprint) values(p_event,btrim(p_name),p_request,p_fingerprint) returning * into r;
  insert into public.cine_tickets(reservation_id,event_id,seat,price) select r.id,p_event,s,e.price from unnest(p_seats) s;
  return public.cine_booking(r.access_token);
exception when unique_violation then raise exception 'CONFLICT';
end; $$;

create or replace function public.cine_delete_tickets(p_event text,p_actor uuid,p_action text,p_ids uuid[],p_confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare targets uuid[]; deleted_count int; reservation_count int; expected text;
begin
  if not exists(select 1 from public.cine_staff where user_id=p_actor and role='admin') then raise exception 'FORBIDDEN'; end if;
  if p_action is null or p_action not in ('delete','clear','reset') then raise exception 'INVALID'; end if;
  expected:=case p_action when 'delete' then 'ELIMINAR' when 'clear' then 'ELIMINAR TODO' else 'REINICIAR' end;
  if p_confirmation is distinct from expected then raise exception 'CONFIRMATION'; end if;
  if p_action='delete' and (p_ids is null or cardinality(p_ids) not between 1 and 300
    or cardinality(p_ids)<>(select count(distinct id) from unnest(p_ids) id)) then raise exception 'INVALID'; end if;
  perform 1 from public.cine_events where id=p_event for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  -- Esperar a los escáneres en curso antes de retirar sus registros y QR.
  perform id from public.cine_tickets where event_id=p_event and (p_action<>'delete' or id=any(p_ids)) order by id for update;
  select coalesce(array_agg(id),'{}'::uuid[]) into targets from public.cine_tickets
    where event_id=p_event and (p_action<>'delete' or id=any(p_ids));
  delete from public.cine_audit where event_id=p_event and (p_action<>'delete' or ticket_id=any(targets));
  delete from public.cine_tickets where event_id=p_event and id=any(targets);
  get diagnostics deleted_count=row_count;
  delete from public.cine_reservations b where b.event_id=p_event and not exists(select 1 from public.cine_tickets t where t.reservation_id=b.id);
  get diagnostics reservation_count=row_count;
  if p_action='reset' then update public.cine_events set booking_open=true,max_seats=least(max_seats,4) where id=p_event; end if;
  return jsonb_build_object('deleted',deleted_count,'reservationsDeleted',reservation_count);
end; $$;

revoke all on function public.cine_person_key(text),public.cine_reserve(text,text,text[],uuid,text),public.cine_delete_tickets(text,uuid,text,uuid[],text) from public,anon,authenticated;
grant execute on function public.cine_person_key(text),public.cine_reserve(text,text,text[],uuid,text),public.cine_delete_tickets(text,uuid,text,uuid[],text) to service_role;

notify pgrst, 'reload schema';
commit;
