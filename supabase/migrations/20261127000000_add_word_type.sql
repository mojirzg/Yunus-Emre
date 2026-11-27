-- Add part-of-speech `type` column to public.words
alter table public.words
  add column if not exists type text not null default 'other'
  check (type in (
    'verb',
    'noun',
    'adjective',
    'adverb',
    'pronoun',
    'conjunction',
    'preposition',
    'interjection',
    'number',
    'phrase',
    'other'
  ));

create index if not exists idx_words_type
  on public.words (type);
