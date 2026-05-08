-- Append-only ledger of image generations. Backs the per-user daily rate limit
-- on /api/picture. Holds web (Supabase user uuid) and iOS (Apple
-- originalTransactionId) entries in a single text column; no FK because
-- iOS users do not exist in auth.users.

create table if not exists public.image_generations (
  id bigserial primary key,
  user_id text not null,
  source text not null check (source in ('web', 'ios')),
  generated_at timestamptz not null default now(),
  reference text,
  prompt_summary text,
  anthropic_model text
);

create index if not exists image_generations_user_recent_idx
  on public.image_generations (user_id, generated_at desc);

alter table public.image_generations enable row level security;

-- No client-facing policies. Only the service role (used by the Vercel
-- /api/picture handler) reads or writes this table.
