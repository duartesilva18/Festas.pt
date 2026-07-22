-- Eventos configuráveis: conteúdo opcional, rascunhos, recorrência, media,
-- blocos personalizados e edição segura por organizadores.

alter table public.festas
  add column if not exists tipo_recorrencia text not null default 'anual',
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists local_nome text,
  add column if not exists morada text,
  add column if not exists codigo_postal text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.festas drop constraint if exists festas_tipo_recorrencia_check;
alter table public.festas add constraint festas_tipo_recorrencia_check
  check (tipo_recorrencia in ('anual', 'unica'));
alter table public.festas add constraint festas_local_nome_tamanho_check
  check (local_nome is null or char_length(local_nome) <= 120);
alter table public.festas add constraint festas_morada_tamanho_check
  check (morada is null or char_length(morada) <= 220);
alter table public.festas add constraint festas_codigo_postal_check
  check (codigo_postal is null or codigo_postal ~ '^\d{4}-\d{3}$');

alter table public.edicoes
  add column if not exists titulo_personalizado text,
  add column if not exists subtitulo text,
  add column if not exists resumo text,
  add column if not exists descricao text,
  add column if not exists acerca_de jsonb not null default '{}'::jsonb,
  add column if not exists informacoes_uteis jsonb not null default '[]'::jsonb,
  add column if not exists contactos jsonb not null default '[]'::jsonb,
  add column if not exists links jsonb not null default '[]'::jsonb,
  add column if not exists configuracao_card jsonb not null default '{}'::jsonb,
  add column if not exists submetida_em timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.edicoes add constraint edicoes_titulo_personalizado_tamanho_check
  check (titulo_personalizado is null or char_length(titulo_personalizado) between 2 and 140);
alter table public.edicoes add constraint edicoes_subtitulo_tamanho_check
  check (subtitulo is null or char_length(subtitulo) <= 180);
alter table public.edicoes add constraint edicoes_resumo_tamanho_check
  check (resumo is null or char_length(resumo) <= 320);
alter table public.edicoes add constraint edicoes_descricao_tamanho_check
  check (descricao is null or char_length(descricao) <= 8000);
alter table public.edicoes add constraint edicoes_acerca_de_check
  check (jsonb_typeof(acerca_de) = 'object' and octet_length(acerca_de::text) <= 65536);
alter table public.edicoes add constraint edicoes_informacoes_uteis_check
  check (jsonb_typeof(informacoes_uteis) = 'array' and octet_length(informacoes_uteis::text) <= 32768);
alter table public.edicoes add constraint edicoes_contactos_check
  check (jsonb_typeof(contactos) = 'array' and octet_length(contactos::text) <= 16384);
alter table public.edicoes add constraint edicoes_links_check
  check (jsonb_typeof(links) = 'array' and octet_length(links::text) <= 16384);
alter table public.edicoes add constraint edicoes_configuracao_card_check
  check (jsonb_typeof(configuracao_card) = 'object' and octet_length(configuracao_card::text) <= 32768);

create table if not exists public.eventos_rascunho (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  festa_id uuid references public.festas(id) on delete cascade,
  nome text not null default 'Evento sem título',
  dados jsonb not null default '{}'::jsonb,
  versao integer not null default 1 check (versao > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(nome) between 1 and 140),
  check (jsonb_typeof(dados) = 'object' and octet_length(dados::text) <= 524288)
);

create index if not exists eventos_rascunho_user_updated_idx
  on public.eventos_rascunho (user_id, updated_at desc);

create index if not exists eventos_rascunho_festa_id_idx
  on public.eventos_rascunho (festa_id)
  where festa_id is not null;

create index if not exists festas_criado_por_idx
  on public.festas (criado_por)
  where criado_por is not null;

alter table public.eventos_rascunho enable row level security;
grant select, insert, update, delete on public.eventos_rascunho to authenticated;

create policy "Organizador gere os seus rascunhos"
on public.eventos_rascunho for all to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.perfis
    where perfis.id = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.perfis
    where perfis.id = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
);

create table if not exists public.edicoes_blocos (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  chave text not null,
  tipo text not null default 'personalizado',
  titulo text,
  conteudo jsonb not null default '{}'::jsonb,
  visivel boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edicao_id, chave),
  check (chave ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' and char_length(chave) <= 60),
  check (tipo in ('sobre', 'programa', 'fotos', 'acerca', 'informacoes', 'contactos', 'links', 'personalizado')),
  check (titulo is null or char_length(titulo) between 1 and 100),
  check (jsonb_typeof(conteudo) in ('object', 'array') and octet_length(conteudo::text) <= 65536),
  check (ordem between 0 and 100)
);

create index if not exists edicoes_blocos_edicao_ordem_idx
  on public.edicoes_blocos (edicao_id, ordem);

alter table public.edicoes_blocos enable row level security;
grant select on public.edicoes_blocos to anon, authenticated;
grant insert, update, delete on public.edicoes_blocos to authenticated;

create policy "Leitura de blocos publicos ou proprios"
on public.edicoes_blocos for select to anon, authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_blocos.edicao_id
      and (edicoes.estado = 'confirmada' or edicoes.criado_por = (select auth.uid()))
  )
);

create policy "Organizador insere blocos nas suas edicoes"
on public.edicoes_blocos for insert to authenticated
with check (
  exists (
    select 1 from public.edicoes
    join public.perfis on perfis.id = (select auth.uid())
    where edicoes.id = edicoes_blocos.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador atualiza blocos das suas edicoes"
on public.edicoes_blocos for update to authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_blocos.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
)
with check (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_blocos.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
);

create policy "Organizador remove blocos das suas edicoes"
on public.edicoes_blocos for delete to authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_blocos.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
);

create table if not exists public.edicoes_media (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.edicoes(id) on delete cascade,
  tipo text not null check (tipo in ('cartaz', 'foto')),
  url text not null,
  legenda text,
  texto_alternativo text,
  ordem integer not null default 0,
  largura integer,
  altura integer,
  created_at timestamptz not null default now(),
  check (url ~ '^https?://' and char_length(url) <= 1000),
  check (legenda is null or char_length(legenda) <= 240),
  check (texto_alternativo is null or char_length(texto_alternativo) <= 240),
  check (ordem between 0 and 100),
  check (largura is null or largura between 16 and 8192),
  check (altura is null or altura between 16 and 8192)
);

create index if not exists edicoes_media_edicao_ordem_idx
  on public.edicoes_media (edicao_id, tipo, ordem);

alter table public.edicoes_media enable row level security;
grant select on public.edicoes_media to anon, authenticated;
grant insert, update, delete on public.edicoes_media to authenticated;

create policy "Leitura de media publica ou propria"
on public.edicoes_media for select to anon, authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_media.edicao_id
      and (edicoes.estado = 'confirmada' or edicoes.criado_por = (select auth.uid()))
  )
);

create policy "Organizador insere media nas suas edicoes"
on public.edicoes_media for insert to authenticated
with check (
  exists (
    select 1 from public.edicoes
    join public.perfis on perfis.id = (select auth.uid())
    where edicoes.id = edicoes_media.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador atualiza media das suas edicoes"
on public.edicoes_media for update to authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_media.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
)
with check (
  exists (
    select 1 from public.edicoes
    join public.perfis on perfis.id = (select auth.uid())
    where edicoes.id = edicoes_media.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador elimina media das suas edicoes"
on public.edicoes_media for delete to authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_media.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
);

alter table public.edicoes_sublocalizacoes
  add column if not exists tipo_personalizado text,
  add column if not exists horario text,
  add column if not exists acessivel boolean,
  add column if not exists visivel boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.edicoes_sublocalizacoes add constraint edicoes_sublocalizacoes_tipo_personalizado_check
  check (tipo_personalizado is null or char_length(tipo_personalizado) <= 60);
alter table public.edicoes_sublocalizacoes add constraint edicoes_sublocalizacoes_horario_check
  check (horario is null or char_length(horario) <= 160);

grant insert, update, delete on public.edicoes_sublocalizacoes to authenticated;

create policy "Organizador insere sublocalizacoes nas suas edicoes"
on public.edicoes_sublocalizacoes for insert to authenticated
with check (
  exists (
    select 1 from public.edicoes
    join public.perfis on perfis.id = (select auth.uid())
    where edicoes.id = edicoes_sublocalizacoes.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador atualiza sublocalizacoes das suas edicoes"
on public.edicoes_sublocalizacoes for update to authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_sublocalizacoes.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
)
with check (
  exists (
    select 1 from public.edicoes
    join public.perfis on perfis.id = (select auth.uid())
    where edicoes.id = edicoes_sublocalizacoes.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador elimina sublocalizacoes das suas edicoes"
on public.edicoes_sublocalizacoes for delete to authenticated
using (
  exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_sublocalizacoes.edicao_id
      and edicoes.criado_por = (select auth.uid())
      and edicoes.estado in ('pendente', 'provisoria')
  )
);

drop policy if exists "Utilizador autenticado pode submeter edicao" on public.edicoes;
create policy "Organizador pode submeter edicao propria"
on public.edicoes for insert to authenticated
with check (
  (select auth.uid()) = criado_por
  and estado in ('pendente', 'provisoria')
  and exists (
    select 1 from public.perfis
    where perfis.id = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador atualiza edicao propria nao publicada"
on public.edicoes for update to authenticated
using (
  (select auth.uid()) = criado_por
  and estado in ('pendente', 'provisoria')
)
with check (
  (select auth.uid()) = criado_por
  and estado in ('pendente', 'provisoria', 'cancelada')
  and exists (
    select 1 from public.perfis
    where perfis.id = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador cria festa propria"
on public.festas for insert to authenticated
with check (
  (select auth.uid()) = criado_por
  and exists (
    select 1 from public.perfis
    where perfis.id = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
);

create policy "Organizador atualiza festa propria"
on public.festas for update to authenticated
using ((select auth.uid()) = criado_por)
with check (
  (select auth.uid()) = criado_por
  and exists (
    select 1 from public.perfis
    where perfis.id = (select auth.uid())
      and perfis.papel in ('organizador', 'admin')
  )
);

grant insert, update on public.festas to authenticated;
grant insert, update on public.edicoes to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'eventos-media',
  'eventos-media',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
