-- DRAFT REFERENCE ONLY. This is NOT a generated or verified Supabase migration.
-- No project/local Postgres was available. Validate in a disposable local Supabase
-- database, run advisors and integration tests, then generate a migration via CLI.
-- Intended for a NEW dedicated project; never apply blindly to an existing project.
-- Keep whalequest_private OUT of Data API exposed schemas and Realtime publications.
begin;
create schema if not exists whalequest_private;
revoke all on schema whalequest_private from public, anon, authenticated;
grant usage on schema whalequest_private to authenticated;
alter default privileges in schema whalequest_private revoke execute on functions from public;

create table whalequest_private.rooms (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'), status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '24 hours'),
  closed_at timestamptz, state_version bigint not null default 1
);
create table whalequest_private.participants (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references whalequest_private.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id), joined_at timestamptz not null default now(), unique(room_id,user_id)
);
create table whalequest_private.activities (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references whalequest_private.rooms(id) on delete cascade,
  kind text not null check (kind in ('understanding','quick-check','assessment','raid')),
  status text not null default 'active' check(status in ('active','ended')),
  question_set jsonb, created_at timestamptz not null default now(), ends_at timestamptz,
  target_hp integer not null default 0 check(target_hp>=0), hp integer not null default 0 check(hp>=0 and hp<=target_hp)
);
create unique index one_active_activity on whalequest_private.activities(room_id) where status='active';
create index activities_room_created on whalequest_private.activities(room_id,created_at desc);
create table whalequest_private.submissions (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references whalequest_private.activities(id) on delete cascade,
  participant_id uuid not null references whalequest_private.participants(id) on delete cascade,
  question_id text, answer jsonb not null, correct boolean, idempotency_key uuid not null,
  result jsonb not null, duration_ms integer not null default 0 check(duration_ms between 0 and 3600000),
  created_at timestamptz not null default now(), unique(participant_id,idempotency_key)
);
create index submissions_activity on whalequest_private.submissions(activity_id,participant_id,question_id,created_at desc);
create table whalequest_private.raid_contributions (
  activity_id uuid not null references whalequest_private.activities(id) on delete cascade,
  participant_id uuid not null references whalequest_private.participants(id) on delete cascade,
  question_id text not null, primary key(activity_id,participant_id,question_id)
);
create table whalequest_private.shared_sets (
  token uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), question_set jsonb not null,
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '30 days')
);
create table whalequest_private.question_inbox (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references whalequest_private.rooms(id) on delete cascade,
  participant_id uuid not null references whalequest_private.participants(id) on delete cascade,
  text text not null check(length(btrim(text)) between 1 and 500), created_at timestamptz not null default now()
);
create index inbox_room on whalequest_private.question_inbox(room_id,created_at);

-- Deny all direct table reads/writes, including answers and participant UUIDs.
-- These tables deliberately have NO client RLS policies. Privileged routines below
-- enforce ownership/membership explicitly; RLS is an additional default-deny layer.
alter table whalequest_private.rooms enable row level security;
alter table whalequest_private.participants enable row level security;
alter table whalequest_private.activities enable row level security;
alter table whalequest_private.submissions enable row level security;
alter table whalequest_private.raid_contributions enable row level security;
alter table whalequest_private.shared_sets enable row level security;
alter table whalequest_private.question_inbox enable row level security;
revoke all on all tables in schema whalequest_private from public, anon, authenticated;

create function whalequest_private.normalize_answer(p_value text) returns text
language sql immutable security invoker set search_path='' as $$
  select btrim(normalize(p_value,NFKC), E' \t\n\r\v\f' || chr(65279) || chr(8232) || chr(8233));
$$;

create function whalequest_private.validate_set(p_set jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare q jsonb; v text; ids text[]='{}'; n integer;
begin
  if p_set is null or jsonb_typeof(p_set)<>'object' or p_set->>'schemaVersion' is distinct from '1.0'
    or jsonb_typeof(p_set->'id') is distinct from 'string' or length(btrim(p_set->>'id')) not between 1 and 120
    or jsonb_typeof(p_set->'title') is distinct from 'string' or length(btrim(p_set->>'title')) not between 1 and 200
    or jsonb_typeof(p_set->'version') is distinct from 'number' or not (p_set->>'version' ~ '^[1-9][0-9]{0,8}$')
    or jsonb_typeof(p_set->'questions') is distinct from 'array' then raise exception 'INVALID_SET' using errcode='22023'; end if;
  if jsonb_array_length(p_set->'questions') not between 1 and 500 or octet_length(p_set::text)>2000000 then raise exception 'INVALID_SET' using errcode='22023'; end if;
  for q in select value from jsonb_array_elements(p_set->'questions') loop
    if jsonb_typeof(q)<>'object' or jsonb_typeof(q->'id') is distinct from 'string' or length(btrim(q->>'id')) not between 1 and 120
      or jsonb_typeof(q->'prompt') is distinct from 'string' or length(btrim(q->>'prompt')) not between 1 and 5000
      or q->>'type' is null or q->>'type' not in ('multiple-choice','true-false','short-answer')
      or btrim(q->>'id')=any(ids) then raise exception 'INVALID_QUESTION' using errcode='22023'; end if;
    ids=array_append(ids,btrim(q->>'id'));
    if q ? 'tags' then
      if jsonb_typeof(q->'tags')<>'array' or jsonb_array_length(q->'tags')>30 then raise exception 'INVALID_TAGS' using errcode='22023'; end if;
      for v in select value #>> '{}' from jsonb_array_elements(q->'tags') where jsonb_typeof(value)<>'string' or length(btrim(value #>> '{}')) not between 1 and 100 loop raise exception 'INVALID_TAGS' using errcode='22023'; end loop;
    end if;
    if (q ? 'standard' and (jsonb_typeof(q->'standard')<>'string' or length(btrim(q->>'standard')) not between 1 and 500))
      or (q ? 'explanation' and (jsonb_typeof(q->'explanation')<>'string' or length(btrim(q->>'explanation')) not between 1 and 5000)) then raise exception 'INVALID_METADATA' using errcode='22023'; end if;
    if q->>'type'='multiple-choice' then
      if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_typeof(q->'answer') is distinct from 'number'
        or not (q->>'answer' ~ '^[0-9]$') then raise exception 'INVALID_CHOICE' using errcode='22023'; end if;
      n=jsonb_array_length(q->'options');
      if n not between 2 and 10 or (q->>'answer')::integer>=n then raise exception 'INVALID_CHOICE' using errcode='22023'; end if;
      for v in select value #>> '{}' from jsonb_array_elements(q->'options') where jsonb_typeof(value)<>'string' or length(btrim(value #>> '{}')) not between 1 and 2000 loop raise exception 'INVALID_CHOICE' using errcode='22023'; end loop;
    elsif q->>'type'='true-false' then
      if jsonb_typeof(q->'answer') is distinct from 'boolean' then raise exception 'INVALID_BOOLEAN' using errcode='22023'; end if;
    else
      if jsonb_typeof(q->'answer') is distinct from 'array' then raise exception 'INVALID_SHORT_ANSWER' using errcode='22023'; end if;
      if jsonb_array_length(q->'answer') not between 1 and 20 then raise exception 'INVALID_SHORT_ANSWER' using errcode='22023'; end if;
      for v in select value #>> '{}' from jsonb_array_elements(q->'answer') where jsonb_typeof(value)<>'string' or length(btrim(value #>> '{}')) not between 1 and 500 loop raise exception 'INVALID_SHORT_ANSWER' using errcode='22023'; end loop;
    end if;
  end loop;
end $$;

-- All privileged implementations live outside exposed public. The public wrappers
-- are SECURITY INVOKER; only authenticated users get EXECUTE on specific routines.
-- Authorization NEVER trusts user_metadata or client-supplied participant IDs.
create function whalequest_private.authorize_room(p_room_id uuid,p_owner boolean default false,p_allow_closed boolean default false)
returns whalequest_private.rooms language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; uid uuid=auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into r from whalequest_private.rooms where id=p_room_id for update;
  if not found or (p_owner and r.owner_id<>uid) or (not p_owner and r.owner_id<>uid and not exists(select 1 from whalequest_private.participants where room_id=r.id and user_id=uid)) then raise exception 'ROOM_FORBIDDEN' using errcode='42501'; end if;
  if not p_allow_closed and (r.status<>'open' or r.expires_at<=now()) then raise exception 'ROOM_CLOSED' using errcode='22023'; end if;
  return r;
end $$;

create function whalequest_private.snapshot(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; a whalequest_private.activities; questions jsonb; understanding jsonb;
begin
  r=whalequest_private.authorize_room(p_room_id,false,true);
  select * into a from whalequest_private.activities where room_id=r.id order by created_at desc,id limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',btrim(q->>'id'),'type',q->>'type','prompt',q->>'prompt','options',q->'options')),'[]') into questions from jsonb_array_elements(coalesce(a.question_set->'questions','[]')) q;
  -- Latest response per participant only; no user/participant IDs or raw answers.
  select coalesce(jsonb_object_agg(answer,n),'{}') into understanding from (
    select answer #>> '{}' as answer,count(*) n from (
      select distinct on (participant_id) participant_id,answer from whalequest_private.submissions where activity_id=a.id order by participant_id,created_at desc,id
    ) latest where a.kind='understanding' group by answer
  ) counts;
  return jsonb_build_object('roomId',r.id,'code',r.code,'status',case when r.expires_at<=now() then 'closed' else r.status end,
    'expiresAt',r.expires_at,'participantCount',(select count(*) from whalequest_private.participants where room_id=r.id),'stateVersion',r.state_version,
    'activity',case when a.id is null then null else jsonb_build_object('id',a.id,'kind',a.kind,
      'status',case when r.status='closed' or r.expires_at<=now() or a.ends_at<=now() then 'ended' else a.status end,
      'endsAt',a.ends_at,'hp',a.hp,'targetHp',a.target_hp,'questions',questions,
      'responses',(select count(distinct participant_id) from whalequest_private.submissions where activity_id=a.id),'understanding',understanding) end);
end $$;

create function whalequest_private.create_room() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid(); room_id uuid; room_code text; tries integer=0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  -- Serialize project-wide room creation: one unexpired active room in this pilot.
  perform pg_advisory_xact_lock(879357);
  update whalequest_private.rooms set status='closed',closed_at=expires_at,state_version=state_version+1 where status='open' and expires_at<=now();
  if exists(select 1 from whalequest_private.rooms where status='open') then raise exception 'ACTIVE_ROOM_LIMIT' using errcode='22023'; end if;
  loop
    room_code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)); tries=tries+1;
    begin
      insert into whalequest_private.rooms(owner_id,code) values(uid,room_code) returning id into room_id;
      exit;
    exception when unique_violation then if tries>=20 then raise exception 'CODE_ALLOCATION_FAILED'; end if; end;
  end loop;
  return whalequest_private.snapshot(room_id);
end $$;

create function whalequest_private.join_room(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; uid uuid=auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_code is null or not (upper(btrim(p_code)) ~ '^[A-Z0-9]{6}$') then raise exception 'ROOM_UNAVAILABLE' using errcode='22023'; end if;
  select * into r from whalequest_private.rooms where code=upper(btrim(p_code)) for update;
  if not found or r.status<>'open' or r.expires_at<=now() then raise exception 'ROOM_UNAVAILABLE' using errcode='22023'; end if;
  if r.owner_id<>uid and not exists(select 1 from whalequest_private.participants where room_id=r.id and user_id=uid) then
    if (select count(*) from whalequest_private.participants where room_id=r.id)>=50 then raise exception 'ROOM_FULL' using errcode='22023'; end if;
    insert into whalequest_private.participants(room_id,user_id) values(r.id,uid);
    update whalequest_private.rooms set state_version=state_version+1 where id=r.id;
  end if;
  return whalequest_private.snapshot(r.id);
end $$;

create function whalequest_private.start_activity(p_room_id uuid,p_kind text,p_set jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; target integer=0; members integer;
begin
  r=whalequest_private.authorize_room(p_room_id,true);
  if p_kind is null or p_kind not in ('understanding','quick-check','assessment','raid') then raise exception 'INVALID_ACTIVITY' using errcode='22023'; end if;
  if p_kind<>'understanding' then perform whalequest_private.validate_set(p_set);
  elsif p_set is not null then raise exception 'UNEXPECTED_QUESTIONS' using errcode='22023'; end if;
  if p_kind='raid' then
    select count(*) into members from whalequest_private.participants where room_id=r.id;
    if members=0 then raise exception 'PARTICIPANTS_REQUIRED' using errcode='22023'; end if;
    target=greatest(1,ceil(members*jsonb_array_length(p_set->'questions')*0.7)::integer);
  end if;
  update whalequest_private.activities set status='ended' where room_id=r.id and status='active';
  insert into whalequest_private.activities(room_id,kind,question_set,ends_at,target_hp,hp)
    values(r.id,p_kind,p_set,case when p_kind='raid' then now()+interval '5 minutes' else null end,target,target);
  update whalequest_private.rooms set state_version=state_version+1 where id=r.id;
  return whalequest_private.snapshot(r.id);
end $$;

create function whalequest_private.end_activity(p_room_id uuid,p_close boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms;
begin
  r=whalequest_private.authorize_room(p_room_id,true);
  update whalequest_private.activities set status='ended' where room_id=r.id and status='active';
  update whalequest_private.rooms set state_version=state_version+1,status=case when p_close then 'closed' else status end,closed_at=case when p_close then now() else closed_at end where id=r.id;
  return whalequest_private.snapshot(r.id);
end $$;

create function whalequest_private.submit(p_room_id uuid,p_activity_id uuid,p_question_id text,p_answer jsonb,p_idempotency_key uuid,p_duration_ms integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; a whalequest_private.activities; participant uuid; q jsonb; is_correct boolean; damage integer=0; inserted integer; previous whalequest_private.submissions; result jsonb; version bigint;
begin
  -- The room lock serializes the authorization, retry lookup, grading, contribution,
  -- HP and version writes in ONE database transaction. No client score is accepted.
  r=whalequest_private.authorize_room(p_room_id,false,true);
  select id into participant from whalequest_private.participants where room_id=r.id and user_id=auth.uid();
  if participant is null then raise exception 'PARTICIPANT_REQUIRED' using errcode='42501'; end if;
  if p_idempotency_key is null or p_activity_id is null or p_answer is null or p_duration_ms is null or p_duration_ms not between 0 and 3600000 then raise exception 'INVALID_SUBMISSION' using errcode='22023'; end if;
  select * into previous from whalequest_private.submissions where participant_id=participant and idempotency_key=p_idempotency_key;
  if found then
    if previous.activity_id is distinct from p_activity_id or previous.question_id is distinct from p_question_id or previous.answer is distinct from p_answer or previous.duration_ms is distinct from p_duration_ms then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return previous.result; -- Same exact retry works even after an activity/room closes.
  end if;
  if r.status<>'open' or r.expires_at<=now() then raise exception 'ROOM_CLOSED' using errcode='22023'; end if;
  if (select count(*) from whalequest_private.submissions where participant_id=participant and created_at>now()-interval '1 minute')>=120 then raise exception 'SUBMISSION_RATE_LIMIT' using errcode='22023'; end if;
  select * into a from whalequest_private.activities where id=p_activity_id and room_id=r.id for update;
  if not found or a.status<>'active' or a.ends_at<=now() then raise exception 'ACTIVITY_CLOSED' using errcode='22023'; end if;
  if a.kind='understanding' then
    if p_question_id is not null or jsonb_typeof(p_answer)<>'string' or p_answer #>> '{}' not in ('understood','unsure','help') then raise exception 'INVALID_UNDERSTANDING' using errcode='22023'; end if;
    is_correct=null;
  else
    select value into q from jsonb_array_elements(a.question_set->'questions') where btrim(value->>'id')=p_question_id;
    if q is null then raise exception 'QUESTION_UNAVAILABLE' using errcode='22023'; end if;
    if q->>'type'='multiple-choice' then
      if jsonb_typeof(p_answer)<>'number' or not (p_answer #>> '{}' ~ '^[0-9]$') or (p_answer #>> '{}')::integer>=jsonb_array_length(q->'options') then raise exception 'INVALID_ANSWER' using errcode='22023'; end if;
      is_correct=p_answer=q->'answer';
    elsif q->>'type'='true-false' then
      if jsonb_typeof(p_answer)<>'boolean' then raise exception 'INVALID_ANSWER' using errcode='22023'; end if;
      is_correct=p_answer=q->'answer';
    else
      if jsonb_typeof(p_answer)<>'string' or length(p_answer #>> '{}')>500 then raise exception 'INVALID_ANSWER' using errcode='22023'; end if;
      is_correct=exists(select 1 from jsonb_array_elements_text(q->'answer') accepted where whalequest_private.normalize_answer(accepted)=whalequest_private.normalize_answer(p_answer #>> '{}'));
    end if;
    if a.kind='raid' and is_correct then
      insert into whalequest_private.raid_contributions values(a.id,participant,p_question_id) on conflict do nothing;
      get diagnostics inserted=row_count;
      damage=case when inserted=1 then least(1,a.hp) else 0 end;
      update whalequest_private.activities set hp=hp-damage,status=case when hp-damage=0 then 'ended' else status end where id=a.id;
    end if;
  end if;
  update whalequest_private.rooms set state_version=state_version+1 where id=r.id returning state_version into version;
  result=jsonb_build_object('correct',is_correct,'contribution',damage,'stateVersion',version);
  insert into whalequest_private.submissions(activity_id,participant_id,question_id,answer,correct,idempotency_key,result,duration_ms)
    values(a.id,participant,p_question_id,p_answer,is_correct,p_idempotency_key,result,p_duration_ms);
  return result;
end $$;

create function whalequest_private.teacher_report(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; report jsonb;
begin
  r=whalequest_private.authorize_room(p_room_id,true,true);
  -- Per-participant latest attempts are used so repeated wrong answers do not
  -- inflate the choice distribution. This teacher-only response includes answers.
  with latest as (
    select distinct on(s.activity_id,s.participant_id,s.question_id) s.* from whalequest_private.submissions s
      join whalequest_private.activities a on a.id=s.activity_id where a.room_id=r.id
      order by s.activity_id,s.participant_id,s.question_id,s.created_at desc,s.id
  ), distribution as (
    select activity_id,question_id,answer,count(*) n from latest group by activity_id,question_id,answer
  ), stats as (
    select activity_id,question_id,count(*) responses,count(*) filter(where correct) correct_count,
      count(*) filter(where correct=false) wrong_count from latest group by activity_id,question_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('activityId',a.id,'kind',a.kind,'questionSet',a.question_set,
    'questions',coalesce((select jsonb_agg(jsonb_build_object('questionId',s.question_id,'responses',s.responses,'correct',s.correct_count,'wrong',s.wrong_count,
      'choices',(select jsonb_agg(jsonb_build_object('answer',d.answer,'count',d.n)) from distribution d where d.activity_id=s.activity_id and d.question_id is not distinct from s.question_id))) from stats s where s.activity_id=a.id),'[]'),
    'topWrong',coalesce((select jsonb_agg(to_jsonb(w)) from (select question_id as "questionId",wrong_count as "wrong" from stats where activity_id=a.id and wrong_count>0 order by wrong_count desc,question_id limit 3) w),'[]')) order by a.created_at),'[]')
    into report from whalequest_private.activities a where a.room_id=r.id;
  return jsonb_build_object('roomId',r.id,'activities',report);
end $$;

create function whalequest_private.share_set(p_set jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare token uuid; expiry timestamptz; uid uuid=auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  perform whalequest_private.validate_set(p_set);
  perform pg_advisory_xact_lock(hashtextextended(uid::text,879358));
  if (select count(*) from whalequest_private.shared_sets where owner_id=uid and expires_at>now())>=20 then raise exception 'SHARE_LIMIT' using errcode='22023'; end if;
  insert into whalequest_private.shared_sets(owner_id,question_set) values(uid,p_set) returning shared_sets.token,expires_at into token,expiry;
  return jsonb_build_object('token',token,'expiresAt',expiry);
end $$;

create function whalequest_private.read_shared_set(p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select question_set into result from whalequest_private.shared_sets where token=p_token and expires_at>now();
  if result is null then raise exception 'SHARE_UNAVAILABLE' using errcode='22023'; end if;
  return result; -- Intentional answer-bearing LOCAL learning copy; not a room snapshot.
end $$;

create function whalequest_private.send_question(p_room_id uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; participant uuid; id uuid;
begin
  r=whalequest_private.authorize_room(p_room_id);
  select p.id into participant from whalequest_private.participants p where room_id=r.id and user_id=auth.uid();
  if participant is null then raise exception 'PARTICIPANT_REQUIRED' using errcode='42501'; end if;
  if p_text is null or length(btrim(p_text)) not between 1 and 500 then raise exception 'INVALID_QUESTION_TEXT' using errcode='22023'; end if;
  if (select count(*) from whalequest_private.question_inbox where participant_id=participant and created_at>now()-interval '1 minute')>=5 then raise exception 'QUESTION_RATE_LIMIT' using errcode='22023'; end if;
  insert into whalequest_private.question_inbox(room_id,participant_id,text) values(r.id,participant,btrim(p_text)) returning question_inbox.id into id;
  return jsonb_build_object('id',id);
end $$;

create function whalequest_private.read_inbox(p_room_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r whalequest_private.rooms; result jsonb;
begin
  r=whalequest_private.authorize_room(p_room_id,true,true);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'text',text,'createdAt',created_at) order by created_at),'[]') into result from whalequest_private.question_inbox where room_id=r.id;
  return result;
end $$;

-- Admin-only retention task. No user may call this through the Data API.
-- Scheduling this hourly is a SEPARATE setup requirement; this file creates no job.
create function whalequest_private.cleanup() returns void
language plpgsql security definer set search_path='' as $$
begin
  update whalequest_private.rooms set status='closed',closed_at=expires_at,state_version=state_version+1 where status='open' and expires_at<=now();
  delete from whalequest_private.activities where room_id in (select id from whalequest_private.rooms where status='closed' and closed_at<now()-interval '24 hours');
  delete from whalequest_private.question_inbox where room_id in (select id from whalequest_private.rooms where status='closed' and closed_at<now()-interval '24 hours');
  delete from whalequest_private.participants where room_id in (select id from whalequest_private.rooms where status='closed' and closed_at<now()-interval '24 hours');
  delete from whalequest_private.shared_sets where expires_at<=now();
end $$;

create function public.wq_create_room() returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.create_room(); $$;
create function public.wq_join_room(p_code text) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.join_room(p_code); $$;
create function public.wq_snapshot(p_room_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.snapshot(p_room_id); $$;
create function public.wq_start_activity(p_room_id uuid,p_kind text,p_set jsonb) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.start_activity(p_room_id,p_kind,p_set); $$;
create function public.wq_end_activity(p_room_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.end_activity(p_room_id,false); $$;
create function public.wq_close_room(p_room_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.end_activity(p_room_id,true); $$;
create function public.wq_submit(p_room_id uuid,p_activity_id uuid,p_question_id text,p_answer jsonb,p_idempotency_key uuid,p_duration_ms integer default 0) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.submit(p_room_id,p_activity_id,p_question_id,p_answer,p_idempotency_key,p_duration_ms); $$;
create function public.wq_teacher_report(p_room_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.teacher_report(p_room_id); $$;
create function public.wq_share_set(p_set jsonb) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.share_set(p_set); $$;
create function public.wq_read_shared_set(p_token uuid) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.read_shared_set(p_token); $$;
create function public.wq_send_question(p_room_id uuid,p_text text) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.send_question(p_room_id,p_text); $$;
create function public.wq_read_inbox(p_room_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select whalequest_private.read_inbox(p_room_id); $$;

revoke execute on all functions in schema whalequest_private from public,anon,authenticated;
-- Only API implementations; internal authorization, validators and cleanup stay denied.
grant execute on function whalequest_private.create_room(),whalequest_private.join_room(text),whalequest_private.snapshot(uuid),
  whalequest_private.start_activity(uuid,text,jsonb),whalequest_private.end_activity(uuid,boolean),
  whalequest_private.submit(uuid,uuid,text,jsonb,uuid,integer),whalequest_private.teacher_report(uuid),
  whalequest_private.share_set(jsonb),whalequest_private.read_shared_set(uuid),whalequest_private.send_question(uuid,text),whalequest_private.read_inbox(uuid) to authenticated;

-- Revoke per app routine, without altering unrelated public functions.
revoke execute on function public.wq_create_room(),public.wq_join_room(text),public.wq_snapshot(uuid),
  public.wq_start_activity(uuid,text,jsonb),public.wq_end_activity(uuid),public.wq_close_room(uuid),
  public.wq_submit(uuid,uuid,text,jsonb,uuid,integer),public.wq_teacher_report(uuid),public.wq_share_set(jsonb),
  public.wq_read_shared_set(uuid),public.wq_send_question(uuid,text),public.wq_read_inbox(uuid) from public,anon,authenticated;
grant execute on function public.wq_create_room(),public.wq_join_room(text),public.wq_snapshot(uuid),
  public.wq_start_activity(uuid,text,jsonb),public.wq_end_activity(uuid),public.wq_close_room(uuid),
  public.wq_submit(uuid,uuid,text,jsonb,uuid,integer),public.wq_teacher_report(uuid),public.wq_share_set(jsonb),
  public.wq_read_shared_set(uuid),public.wq_send_question(uuid,text),public.wq_read_inbox(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
