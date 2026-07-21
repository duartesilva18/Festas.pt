-- Autenticação: perfil por utilizador (criado no 1.º login) e festas guardadas.

create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  avatar_url text,
  papel text not null default 'membro' check (papel in ('membro','organizador','admin')),
  created_at timestamptz not null default now()
);

alter table perfis enable row level security;

create policy "Ver o proprio perfil" on perfis
  for select using ((select auth.uid()) = id);
create policy "Atualizar o proprio perfil" on perfis
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_utilizador on auth.users;
create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function public.criar_perfil();

create table if not exists favoritos (
  user_id uuid not null references auth.users(id) on delete cascade,
  festa_id uuid not null references festas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, festa_id)
);

alter table favoritos enable row level security;

create policy "Ver os proprios favoritos" on favoritos
  for select using ((select auth.uid()) = user_id);
create policy "Guardar favorito" on favoritos
  for insert with check ((select auth.uid()) = user_id);
create policy "Remover favorito" on favoritos
  for delete using ((select auth.uid()) = user_id);
