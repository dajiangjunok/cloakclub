create extension if not exists pgcrypto;

create table public.communities (
  community_id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.proposals (
  proposal_id text primary key,
  community_id text not null references public.communities(community_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 500),
  yes_label text not null check (char_length(yes_label) between 1 and 60),
  no_label text not null check (char_length(no_label) between 1 and 60),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities(community_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  commitment text not null unique,
  transaction_id text not null unique,
  reaction_count bigint not null default 0 check (reaction_count >= 0),
  created_at timestamptz not null default now()
);

create index posts_community_created_at_idx
  on public.posts (community_id, created_at desc);

alter table public.communities enable row level security;
alter table public.proposals enable row level security;
alter table public.posts enable row level security;

create policy "public read communities" on public.communities for select using (true);
create policy "public read proposals" on public.proposals for select using (true);
create policy "public read verified posts" on public.posts for select using (true);

create or replace function public.add_post_reaction(target_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts
  set reaction_count = reaction_count + 1
  where id = target_post_id;
$$;

revoke all on function public.add_post_reaction(uuid) from public;
grant execute on function public.add_post_reaction(uuid) to anon, authenticated;

-- Replace these values with the same field literals used during Aleo initialization.
-- They are metadata, not sample application data.
-- insert into public.communities (community_id, name, description)
-- values ('<COMMUNITY_ID>field', '<COMMUNITY_NAME>', '<COMMUNITY_DESCRIPTION>');
-- insert into public.proposals (proposal_id, community_id, title, description, yes_label, no_label, ends_at)
-- values ('<PROPOSAL_ID>field', '<COMMUNITY_ID>field', '<TITLE>', '<DESCRIPTION>', '<YES_LABEL>', '<NO_LABEL>', '<ISO_TIMESTAMP>');
