-- Cine CEFINF. Ejecutar una sola vez en un proyecto Supabase nuevo.
-- Todas las operaciones pasan por el servidor. Ninguna tabla/RPC está abierta a anon/authenticated.
begin;
create table public.cine_events (
  id text primary key, title text not null, starts_at timestamptz not null, venue text not null,
  price numeric(8,2) not null check(price>=0), capacity int not null check(capacity=198),
  booking_open boolean not null default true, closes_at timestamptz not null,
  max_seats int not null default 198 check(max_seats between 1 and 198)
);
create table public.cine_seats (id text primary key check(id ~ '^[A-K](0[1-9]|1[0-8])$'));
insert into public.cine_seats select chr(r)||lpad(s::text,2,'0') from generate_series(65,75) r cross join generate_series(1,18) s;
insert into public.cine_events values ('endgame-2026','Avengers: Endgame','2026-10-23 16:30:00-05','Auditorio de Ciencias Sociales',5,198,true,'2026-10-23 16:30:00-05',198);
create table public.cine_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','door'))
);
create table public.cine_reservations (
  id uuid primary key default gen_random_uuid(), event_id text not null references public.cine_events(id),
  name text not null check(char_length(name) between 3 and 100),
  access_token text not null unique default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
  request_id uuid not null unique, fingerprint text not null,
  created_at timestamptz not null default now()
);
create table public.cine_tickets (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.cine_reservations(id),
  event_id text not null references public.cine_events(id), seat text not null references public.cine_seats(id),
  token text not null unique default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
  status text not null default 'reserved' check(status in ('reserved','admitted','cancelled')),
  price numeric(8,2) not null, paid_at timestamptz, admitted_at timestamptz,
  admitted_by uuid references auth.users(id), cancelled_at timestamptz,
  check((status='admitted' and paid_at is not null and admitted_at is not null and admitted_by is not null) or (status<>'admitted' and admitted_at is null)),
  check((status='cancelled')=(cancelled_at is not null))
);
create unique index cine_active_seat on public.cine_tickets(event_id,seat) where status<>'cancelled';
create index cine_reservation_tickets on public.cine_tickets(reservation_id);
create table public.cine_audit (
  id bigint generated always as identity primary key, ticket_id uuid references public.cine_tickets(id),
  event_id text not null references public.cine_events(id), actor uuid not null references auth.users(id),
  action text not null, created_at timestamptz not null default now()
);
create table public.cine_rate_limits (key text primary key, count int not null, resets_at timestamptz not null);
alter table public.cine_events enable row level security;
alter table public.cine_seats enable row level security;
alter table public.cine_staff enable row level security;
alter table public.cine_reservations enable row level security;
alter table public.cine_tickets enable row level security;
alter table public.cine_audit enable row level security;
alter table public.cine_rate_limits enable row level security;
revoke all on public.cine_events,public.cine_seats,public.cine_staff,public.cine_reservations,public.cine_tickets,public.cine_audit,public.cine_rate_limits from anon,authenticated;
grant all on public.cine_events,public.cine_seats,public.cine_staff,public.cine_reservations,public.cine_tickets,public.cine_audit,public.cine_rate_limits to service_role;

create function public.cine_public_state(p_event text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('event',to_jsonb(e),'occupied',coalesce((select jsonb_agg(t.seat order by t.seat) from public.cine_tickets t where t.event_id=e.id and t.status<>'cancelled'),'[]'::jsonb)) from public.cine_events e where e.id=p_event;
$$;
create function public.cine_booking(p_access text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select to_jsonb(r)||jsonb_build_object('event',to_jsonb(e),'tickets',coalesce((select jsonb_agg(to_jsonb(t) order by t.seat) from public.cine_tickets t where t.reservation_id=r.id),'[]'::jsonb)) into result
 from public.cine_reservations r join public.cine_events e on e.id=r.event_id where r.access_token=p_access;
 if result is null then raise exception 'NOT_FOUND'; end if;
 return result;
end; $$;
create function public.cine_reserve(p_event text,p_name text,p_seats text[],p_request uuid,p_fingerprint text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.cine_events; r public.cine_reservations;
begin
 -- El bloqueo de la función serializa confirmaciones; el índice parcial sigue siendo la defensa final.
 select * into e from public.cine_events where id=p_event for update;
 if not found then raise exception 'CLOSED'; end if;
 select * into r from public.cine_reservations where request_id=p_request;
 if found then
   if r.fingerprint<>p_fingerprint or r.event_id<>p_event then raise exception 'IDEMPOTENCY'; end if;
   return public.cine_booking(r.access_token);
 end if;
 if not e.booking_open or e.closes_at<=now() then raise exception 'CLOSED'; end if;
 if char_length(btrim(p_name)) not between 3 and 100 or p_name ~ '[<>[:cntrl:]]' then raise exception 'NAME'; end if;
 if p_seats is null or cardinality(p_seats) not between 1 and e.max_seats
   or cardinality(p_seats)<>(select count(distinct x) from unnest(p_seats) x)
   or exists(select 1 from unnest(p_seats) x where x is null or not exists(select 1 from public.cine_seats s where s.id=x)) then raise exception 'SEATS'; end if;
 if exists(select 1 from public.cine_tickets where event_id=p_event and seat=any(p_seats) and status<>'cancelled') then raise exception 'CONFLICT'; end if;
 insert into public.cine_reservations(event_id,name,request_id,fingerprint) values(p_event,btrim(p_name),p_request,p_fingerprint) returning * into r;
 insert into public.cine_tickets(reservation_id,event_id,seat,price) select r.id,p_event,s,e.price from unnest(p_seats) s;
 return public.cine_booking(r.access_token);
exception when unique_violation then raise exception 'CONFLICT';
end; $$;
create function public.cine_dashboard(p_event text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('event',to_jsonb(e),'tickets',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('name',r.name,'created_at',r.created_at) order by r.created_at desc,t.seat) from public.cine_tickets t join public.cine_reservations r on r.id=t.reservation_id where t.event_id=e.id),'[]'::jsonb)) from public.cine_events e where e.id=p_event;
$$;
create function public.cine_verify(p_event text,p_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 select to_jsonb(t)||jsonb_build_object('name',r.name,'created_at',r.created_at) into result from public.cine_tickets t join public.cine_reservations r on r.id=t.reservation_id where t.event_id=p_event and t.token=p_token;
 if result is null then raise exception 'INVALID'; end if;
 return result;
end; $$;
create function public.cine_ticket_action(p_event text,p_token text,p_actor uuid,p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.cine_tickets; staff_role text;
begin
 select role into staff_role from public.cine_staff where user_id=p_actor;
 if staff_role is null or p_action not in ('admit','cancel') or (p_action='cancel' and staff_role<>'admin') then raise exception 'FORBIDDEN'; end if;
 select * into t from public.cine_tickets where event_id=p_event and token=p_token for update;
 if not found then raise exception 'INVALID'; end if;
 if t.status='cancelled' then raise exception 'CANCELLED'; end if;
 if t.admitted_at is not null then raise exception 'USED'; end if;
 if p_action='admit' then
   update public.cine_tickets set status='admitted',paid_at=now(),admitted_at=now(),admitted_by=p_actor where id=t.id;
 else
   update public.cine_tickets set status='cancelled',cancelled_at=now() where id=t.id;
 end if;
 insert into public.cine_audit(ticket_id,event_id,actor,action) values(t.id,p_event,p_actor,p_action);
 return public.cine_verify(p_event,p_token);
end; $$;
create function public.cine_set_open(p_event text,p_open boolean,p_actor uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.cine_staff where user_id=p_actor and role='admin') then raise exception 'FORBIDDEN'; end if;
 update public.cine_events set booking_open=p_open where id=p_event returning to_jsonb(cine_events.*) into result;
 if result is null then raise exception 'NOT_FOUND'; end if;
 insert into public.cine_audit(event_id,actor,action) values(p_event,p_actor,case when p_open then 'open_bookings' else 'close_bookings' end);
 return result;
end; $$;
create function public.cine_rate_limit(p_key text,p_limit int,p_seconds int) returns void
language plpgsql security definer set search_path='' as $$
declare attempts int;
begin
 insert into public.cine_rate_limits values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when cine_rate_limits.resets_at<=now() then 1 else cine_rate_limits.count+1 end,
 resets_at=case when cine_rate_limits.resets_at<=now() then excluded.resets_at else cine_rate_limits.resets_at end returning count into attempts;
 if attempts>p_limit then raise exception 'RATE_LIMIT'; end if;
 delete from public.cine_rate_limits where resets_at<now()-interval '1 hour';
end; $$;

-- PostgreSQL otorga EXECUTE a PUBLIC por defecto: retirarlo de cada RPC expresamente.
revoke all on function public.cine_public_state(text),public.cine_booking(text),public.cine_reserve(text,text,text[],uuid,text),public.cine_dashboard(text),public.cine_verify(text,text),public.cine_ticket_action(text,text,uuid,text),public.cine_set_open(text,boolean,uuid),public.cine_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.cine_public_state(text),public.cine_booking(text),public.cine_reserve(text,text,text[],uuid,text),public.cine_dashboard(text),public.cine_verify(text,text),public.cine_ticket_action(text,text,uuid,text),public.cine_set_open(text,boolean,uuid),public.cine_rate_limit(text,int,int) to service_role;
commit;
