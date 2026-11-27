-- BraVo · 회원 프로필 테이블
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run 한 번이면 끝나요.

-- 1) 프로필 테이블 (로그인 계정 1개당 1줄)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null check (char_length(nickname) between 2 and 12),
  gender      text check (gender in ('female', 'male', 'other', 'none')),   -- 선택
  age_range   text check (age_range in ('10s', '20s', '30s', '40s', '50plus')), -- 선택
  created_at  timestamptz not null default now()
);

-- 2) 보안: 본인 프로필만 보고 고칠 수 있게
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 3) 회원가입하면 자동으로 프로필 줄을 만들어 주는 트리거
--    (앱에서 signUp 할 때 넘긴 nickname / gender / age_range 를 꺼내서 저장)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname, gender, age_range)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nickname',
    nullif(new.raw_user_meta_data ->> 'gender', ''),
    nullif(new.raw_user_meta_data ->> 'age_range', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
