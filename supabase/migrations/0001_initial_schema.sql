-- Migração inicial: schema base do Festas PT
-- Aplicada no projeto Supabase FESTAS.pt (hwdurtjhxxwpxscoooho) a 2026-07-19.

create extension if not exists postgis with schema extensions;

create table concelhos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  distrito text not null
);

create table festas (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  nome text not null,
  concelho_id uuid not null references concelhos(id),
  freguesia text,
  descricao text,
  location extensions.geography(point, 4326),
  categorias text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (concelho_id, slug)
);

create index festas_location_idx on festas using gist (location);
create index festas_concelho_idx on festas (concelho_id);

create table edicoes (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references festas(id) on delete cascade,
  ano int not null,
  data_inicio date not null,
  data_fim date,
  estado text not null default 'pendente' check (estado in ('pendente','confirmada','provisoria','cancelada')),
  programa jsonb,
  cartaz_url text,
  fonte_url text,
  criado_por uuid references auth.users(id),
  verificada_em timestamptz,
  created_at timestamptz not null default now(),
  unique (festa_id, ano)
);

create index edicoes_festa_idx on edicoes (festa_id);
create index edicoes_estado_idx on edicoes (estado);
create index edicoes_datas_idx on edicoes (data_inicio, data_fim);

alter table concelhos enable row level security;
alter table festas enable row level security;
alter table edicoes enable row level security;

create policy "Leitura publica de concelhos" on concelhos for select using (true);
create policy "Leitura publica de festas" on festas for select using (true);

create policy "Leitura publica de edicoes confirmadas" on edicoes
  for select using (estado = 'confirmada');

create policy "Utilizador ve as suas proprias submissoes" on edicoes
  for select using ((select auth.uid()) = criado_por);

create policy "Utilizador autenticado pode submeter edicao" on edicoes
  for insert with check ((select auth.uid()) = criado_por);
