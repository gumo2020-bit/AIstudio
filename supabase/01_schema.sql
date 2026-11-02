-- 새 Supabase 프로젝트의 SQL Editor에서 실행. 기존 테이블을 삭제하지 않습니다.
begin;
create table public.questions (
 id uuid primary key default gen_random_uuid(), position integer not null unique,
 title text not null check(length(title) between 1 and 200),
 scenario text not null check(length(scenario) between 1 and 5000),
 option_a text not null check(length(option_a) between 1 and 2000),
 option_b text not null check(length(option_b) between 1 and 2000),
 active boolean not null default true, updated_at timestamptz not null default now()
);
create function public.touch_question() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger touch_question before update on public.questions for each row execute function public.touch_question();
create table public.admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.submissions (
 id uuid primary key, age integer not null check(age between 5 and 120),
 gender text not null check(gender in ('female','male','other','undisclosed')),
 consent_version text not null default '2026-11-v1',
 created_at timestamptz not null default now(), payload jsonb not null
);
create table public.answers (
 submission_id uuid not null references public.submissions(id) on delete cascade,
 question_id uuid not null references public.questions(id),
 question_version timestamptz not null, title text not null, scenario text not null,
 option_a text not null, option_b text not null,
 choice text not null check(choice in ('A','B')),
 reason text not null check(length(regexp_replace(reason,'[[:space:]]','','g')) between 5 and 1000),
 primary key(submission_id, question_id)
);
create index on public.submissions(age,gender);
create index on public.answers(question_id,question_version);
alter table public.questions enable row level security;
alter table public.admins enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
-- 기존 기본 권한을 명시적으로 제거합니다. 응답은 RPC로만 제출합니다.
revoke all on public.questions, public.admins, public.submissions, public.answers from anon, authenticated;
grant select on public.questions to anon, authenticated;
create policy active_questions on public.questions for select to anon, authenticated using(active);
grant select on public.admins to authenticated;
create policy own_admin on public.admins for select to authenticated using(user_id=auth.uid());

create function public.submit_survey(p_id uuid,p_age integer,p_gender text,p_answers jsonb,p_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare item jsonb; q public.questions%rowtype; payload_value jsonb; old_payload jsonb;
begin
 if p_consent is distinct from true or p_id is null or p_age is null or p_age not between 5 and 120
 or p_gender is null or p_gender not in ('female','male','other','undisclosed') then
 raise exception '입력 정보와 동의를 확인해 주세요.'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception '응답 형식 오류'; end if;
 if jsonb_array_length(p_answers)<>3 then raise exception '3문항에 응답해 주세요.'; end if;
 payload_value=jsonb_build_object('age',p_age,'gender',p_gender,'answers',p_answers);
 -- 같은 ID의 동시 요청을 직렬화합니다. 네트워크 오류 후 재시도도 한 번만 저장합니다.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select payload into old_payload from public.submissions where id=p_id;
 if found then
   if old_payload=payload_value then return p_id; end if;
   raise exception '이미 제출된 응답입니다.';
 end if;
 -- 활성 문항 변경과 제출이 동시에 발생하지 않도록 잠급니다.
 lock table public.questions in share mode;
 if (select count(*) from public.questions where active)<>3 then raise exception '활성 문항 수를 확인해 주세요.'; end if;
 if (select count(distinct value->>'question_id') from jsonb_array_elements(p_answers))<>3 then raise exception '중복 문항 오류'; end if;
 insert into public.submissions(id,age,gender,payload) values(p_id,p_age,p_gender,payload_value);
 for item in select value from jsonb_array_elements(p_answers) loop
  select * into q from public.questions where id=(item->>'question_id')::uuid and active;
  if not found then raise exception '문항이 변경되었습니다. 새로 시작해 주세요.'; end if;
  if (item->>'version')::timestamptz is distinct from q.updated_at then raise exception '문항이 수정되었습니다. 새로 시작해 주세요.'; end if;
  if item->>'choice' is null or item->>'choice' not in ('A','B') or item->>'reason' is null
   or length(regexp_replace(item->>'reason','[[:space:]]','','g')) not between 5 and 1000 then raise exception '선택과 이유(5~1000자)를 확인해 주세요.'; end if;
  insert into public.answers values(p_id,q.id,q.updated_at,q.title,q.scenario,q.option_a,q.option_b,item->>'choice',btrim(item->>'reason'));
 end loop;
 return p_id;
end $$;
revoke all on function public.submit_survey(uuid,integer,text,jsonb,boolean) from public;
grant execute on function public.submit_survey(uuid,integer,text,jsonb,boolean) to anon, authenticated;

create function public.get_stats(p_min integer default 5,p_max integer default 120,p_gender text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.admins where user_id=auth.uid()) then raise exception '관리자 권한이 필요합니다.'; end if;
 if p_min is null or p_max is null or p_min<5 or p_max>120 or p_min>p_max
 or (p_gender is not null and p_gender not in ('female','male','other','undisclosed')) then raise exception '필터 범위를 확인해 주세요.'; end if;
 with filtered as (
 select * from public.submissions where age between p_min and p_max and (p_gender is null or gender=p_gender)
 ), per_question as (
 select a.question_id,a.question_version,a.title,a.option_a,a.option_b,
 count(*)::integer total,count(*) filter(where choice='A')::integer a_count,count(*) filter(where choice='B')::integer b_count
 from public.answers a join filtered s on s.id=a.submission_id
 group by a.question_id,a.question_version,a.title,a.option_a,a.option_b
 ), genders as (select gender,count(*)::integer count from filtered group by gender),
 ages as (select (age/10)*10 age_band,count(*)::integer count from filtered group by (age/10)*10),
 recent as (
 select a.title,a.choice,a.reason,s.age,s.gender,s.created_at from public.answers a join filtered s on s.id=a.submission_id order by s.created_at desc,a.question_id limit 50
 )
 select jsonb_build_object('total',(select count(*) from filtered),
 'questions',coalesce((select jsonb_agg(to_jsonb(p) order by title,question_version) from per_question p),'[]'::jsonb),
 'genders',coalesce((select jsonb_agg(to_jsonb(g)) from genders g),'[]'::jsonb),
 'ages',coalesce((select jsonb_agg(to_jsonb(a) order by age_band) from ages a),'[]'::jsonb),
 'recent',coalesce((select jsonb_agg(to_jsonb(r) order by created_at desc) from recent r),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_stats(integer,integer,text) from public;
grant execute on function public.get_stats(integer,integer,text) to authenticated;
commit;
