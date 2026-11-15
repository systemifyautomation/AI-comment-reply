-- ReplyFlow data model for Supabase.
-- Run in Supabase SQL Editor as the database owner.

create extension if not exists pgcrypto;

create table if not exists public.replyflow_verification_codes (
  email text primary key check (email = lower(email)),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  last_sent_at timestamptz not null default now(),
  verified_at timestamptz
);

create table if not exists public.replyflow_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  system_prompt text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.replyflow_client_access (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  client_id uuid not null references public.replyflow_clients(id) on delete cascade,
  active boolean not null default true,
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  unique (email, client_id)
);

-- Makes the role column safe to add when this schema is applied to an existing
-- ReplyFlow database. Existing assignments become standard user assignments.
alter table public.replyflow_client_access
  add column if not exists role text;

update public.replyflow_client_access
set role = 'user'
where role is null;

alter table public.replyflow_client_access
  alter column role set default 'user',
  alter column role set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'replyflow_client_access_role_check'
      and conrelid = 'public.replyflow_client_access'::regclass
  ) then
    alter table public.replyflow_client_access
      add constraint replyflow_client_access_role_check
      check (role in ('admin', 'manager', 'user'));
  end if;
end;
$$;

-- Read-only join used by the native n8n Supabase node to build the client dropdown.
create or replace view public.replyflow_available_clients as
select
  a.email,
  a.active,
  a.role,
  c.id,
  c.name,
  c.system_prompt
from public.replyflow_client_access a
join public.replyflow_clients c on c.id = a.client_id;

-- Returns a six-digit code. It is stored only as a SHA-256 hash and expires in 10 minutes.
create or replace function public.issue_replyflow_code(p_email text)
returns table(code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_email text := lower(trim(p_email));
  generated_code text;
begin
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required';
  end if;

  if exists (
    select 1 from replyflow_verification_codes
    where email = normalized_email and last_sent_at > now() - interval '60 seconds'
  ) then
    raise exception 'Please wait before requesting another verification code';
  end if;

  generated_code := lpad((((('x' || encode(gen_random_bytes(3), 'hex'))::bit(24)::int) % 900000) + 100000)::text, 6, '0');
  insert into replyflow_verification_codes (email, code_hash, expires_at, attempts, last_sent_at, verified_at)
  values (normalized_email, encode(digest(generated_code, 'sha256'), 'hex'), now() + interval '10 minutes', 0, now(), null)
  on conflict (email) do update set
    code_hash = excluded.code_hash,
    expires_at = excluded.expires_at,
    attempts = 0,
    last_sent_at = excluded.last_sent_at,
    verified_at = null;

  return query select generated_code;
end;
$$;

create or replace function public.verify_replyflow_code(p_email text, p_code text)
returns table(verified boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_email text := lower(trim(p_email));
  stored_code replyflow_verification_codes%rowtype;
begin
  select * into stored_code
  from replyflow_verification_codes
  where email = normalized_email
  for update;

  if not found or stored_code.expires_at <= now() or stored_code.attempts >= 5 then
    return query select false;
    return;
  end if;

  if stored_code.code_hash <> encode(digest(trim(p_code), 'sha256'), 'hex') then
    update replyflow_verification_codes set attempts = attempts + 1 where email = normalized_email;
    return query select false;
    return;
  end if;

  update replyflow_verification_codes set attempts = attempts + 1, verified_at = now() where email = normalized_email;
  return query select true;
end;
$$;

create or replace function public.list_replyflow_clients(p_email text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'accounts', coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::jsonb)
  )
  from replyflow_client_access a
  join replyflow_clients c on c.id = a.client_id and c.active = true
  where a.email = lower(trim(p_email)) and a.active = true
    and exists (
      select 1 from replyflow_verification_codes v
      where v.email = lower(trim(p_email)) and v.verified_at is not null
    );
$$;

create or replace function public.get_replyflow_client_context(p_email text, p_client_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object('authorized', true, 'id', c.id, 'name', c.name, 'system_prompt', c.system_prompt)
      from replyflow_client_access a
      join replyflow_clients c on c.id = a.client_id and c.active = true
      where a.email = lower(trim(p_email)) and a.client_id = p_client_id and a.active = true
        and exists (
          select 1 from replyflow_verification_codes v
          where v.email = lower(trim(p_email)) and v.verified_at is not null
        )
    ),
    jsonb_build_object('authorized', false)
  );
$$;

-- The relay/n8n service-role credential calls these functions. Do not expose that
-- credential to the Chrome extension, and enable RLS on these tables for all other roles.
alter table public.replyflow_verification_codes enable row level security;
alter table public.replyflow_clients enable row level security;
alter table public.replyflow_client_access enable row level security;

-- Example client and VA access. Replace these with your real data.
insert into public.replyflow_clients (id, name, system_prompt)
values ('11111111-1111-4111-8111-111111111111', 'Acme', 'Write concise, helpful replies in Acme''s friendly professional voice.')
on conflict (id) do nothing;

insert into public.replyflow_client_access (id, email, client_id, role)
values ('22222222-2222-4222-8222-222222222222', 'va@example.com', '11111111-1111-4111-8111-111111111111', 'user')
on conflict do nothing;
