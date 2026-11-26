-- Initial schema for Turkish Vocabulary PWA (Yedi Iklim Turkce A2, extensible to B1, B2, etc.)

create extension if not exists pgcrypto;

-- 1. Courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Lessons (Units within a course)
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  unit_number integer not null check (unit_number >= 1),
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (course_id, unit_number)
);

create index if not exists idx_lessons_course_sort
  on public.lessons (course_id, sort_order, unit_number);

-- 3. Normalized Words (shared across lessons/courses by unique normalized Turkish form)
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  turkish text not null unique,
  english text not null,
  persian text not null,
  frequency_rank integer not null check (frequency_rank >= 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_words_frequency_rank
  on public.words (frequency_rank asc);

-- 4. Lesson <-> Word join table
create table if not exists public.lesson_words (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  primary key (lesson_id, word_id)
);

create index if not exists idx_lesson_words_word_id
  on public.lesson_words (word_id);

-- 5. Per-user learning progress per normalized word
create table if not exists public.user_word_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  status text not null default 'unlearned' check (status in ('unlearned', 'learned')),
  review_count integer not null default 0 check (review_count >= 0),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index if not exists idx_user_word_progress_user_status
  on public.user_word_progress (user_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_word_progress_updated_at on public.user_word_progress;
create trigger trg_user_word_progress_updated_at
  before update on public.user_word_progress
  for each row
  execute function public.set_updated_at();

-- Row Level Security
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.words enable row level security;
alter table public.lesson_words enable row level security;
alter table public.user_word_progress enable row level security;

-- Authenticated read access on curriculum tables
drop policy if exists "Authenticated users can read courses" on public.courses;
create policy "Authenticated users can read courses"
  on public.courses
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read lessons" on public.lessons;
create policy "Authenticated users can read lessons"
  on public.lessons
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read words" on public.words;
create policy "Authenticated users can read words"
  on public.words
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read lesson_words" on public.lesson_words;
create policy "Authenticated users can read lesson_words"
  on public.lesson_words
  for select
  to authenticated
  using (true);

-- Strict per-user access on user_word_progress
drop policy if exists "Users can select own word progress" on public.user_word_progress;
create policy "Users can select own word progress"
  on public.user_word_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own word progress" on public.user_word_progress;
create policy "Users can insert own word progress"
  on public.user_word_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own word progress" on public.user_word_progress;
create policy "Users can update own word progress"
  on public.user_word_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own word progress" on public.user_word_progress;
create policy "Users can delete own word progress"
  on public.user_word_progress
  for delete
  to authenticated
  using (auth.uid() = user_id);
