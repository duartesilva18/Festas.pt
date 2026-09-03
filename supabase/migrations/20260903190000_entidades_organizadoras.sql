-- Entidades organizadoras: a posse das festas deixa de ser pessoal.
--
-- Até aqui uma "organização" era apenas um utilizador com papel='organizador'.
-- O nome da entidade ficava só na linha do pedido, nunca era copiado para lado
-- nenhum, e as festas pertenciam a `criado_por` — uma conta pessoal. Se quem
-- criou a página das Feiras Novas saísse da comissão, a festa ficava presa à
-- conta dele e mais ninguém lhe mexia.
--
-- Passa a haver uma entidade a que várias contas podem pertencer, e é à entidade
-- que a festa pertence. `criado_por` mantém-se como autoria/auditoria e continua
-- a dar acesso — ninguém perde o que já tinha.

-- ---------------------------------------------------------------------------
-- 1. Slug a partir de texto livre (o nome da entidade vem de um formulário)
-- ---------------------------------------------------------------------------

create or replace function app_private.slugificar(p_texto text)
returns text
language sql
immutable
as $$
  select nullif(trim(both '-' from regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, ''))),
    '[^a-z0-9]+', '-', 'g'
  )), '');
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.entidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 140),
  tipo text not null check (tipo in ('junta_freguesia', 'camara_municipal', 'comissao_festas', 'associacao', 'outro')),
  concelho_id uuid references public.concelhos(id) on delete set null,
  contacto text check (contacto is null or char_length(contacto) between 5 and 120),
  link text check (link is null or (link ~ '^https?://' and char_length(link) <= 300)),
  created_at timestamptz not null default now()
);

create index if not exists entidades_concelho_idx on public.entidades (concelho_id);

create table if not exists public.entidade_membros (
  entidade_id uuid not null references public.entidades(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  created_at timestamptz not null default now(),
  primary key (entidade_id, user_id)
);

create index if not exists entidade_membros_user_idx on public.entidade_membros (user_id);

-- A posse. Nullable: as festas do seed não têm dono e continuam sem ter.
alter table public.festas
  add column if not exists entidade_id uuid references public.entidades(id) on delete set null;

create index if not exists festas_entidade_idx on public.festas (entidade_id);

comment on column public.festas.entidade_id is
  'Entidade dona da festa. NULL = sem dono (seed inicial), gerida só por admin. '
  '`criado_por` continua a registar quem submeteu e mantém-lhe o acesso.';

-- ---------------------------------------------------------------------------
-- 3. Quem pode gerir o quê
--
--    SECURITY DEFINER de propósito: as policies precisam de ler
--    `entidade_membros`, e sem isto teríamos recursão de RLS. Repara que
--    NENHUMA destas funções aceita um user_id — usam sempre auth.uid() por
--    dentro. Se aceitassem, qualquer pessoa autenticada podia sondar quem
--    pertence a que entidade.
-- ---------------------------------------------------------------------------

create or replace function app_private.gere_festa(p_festa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.festas f
    join public.entidade_membros m on m.entidade_id = f.entidade_id
    where f.id = p_festa_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function app_private.gere_edicao(p_edicao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.edicoes e
    join public.festas f on f.id = e.festa_id
    join public.entidade_membros m on m.entidade_id = f.entidade_id
    where e.id = p_edicao_id
      and m.user_id = (select auth.uid())
  );
$$;

-- As policies correm com o papel de quem chama, portanto `authenticated` tem
-- mesmo de poder executar estas duas. É seguro: só respondem sobre o próprio.
grant execute on function app_private.gere_festa(uuid) to authenticated;
grant execute on function app_private.gere_edicao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS das tabelas novas
-- ---------------------------------------------------------------------------

alter table public.entidades enable row level security;
alter table public.entidade_membros enable row level security;

-- O nome da entidade aparece na página pública da festa ("Organizado por").
drop policy if exists "Leitura publica de entidades" on public.entidades;
create policy "Leitura publica de entidades" on public.entidades
  for select using (true);

-- Sem policies de escrita: entidades só nascem pela aprovação de um pedido,
-- que corre com a service key.

drop policy if exists "Utilizador ve as suas pertencas" on public.entidade_membros;
create policy "Utilizador ve as suas pertencas" on public.entidade_membros
  for select using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5. Policies existentes passam a aceitar a pertença à entidade
--    Mantém-se sempre o `criado_por` no OR: quem criou nunca perde acesso.
-- ---------------------------------------------------------------------------

drop policy if exists "Organizador atualiza festa propria" on public.festas;
create policy "Organizador atualiza festa propria" on public.festas
  for update using (
    (select auth.uid()) = criado_por
    or app_private.gere_festa(id)
  ) with check (
    ((select auth.uid()) = criado_por or app_private.gere_festa(id))
    and exists (
      select 1 from public.perfis
      where perfis.id = (select auth.uid())
        and perfis.papel in ('organizador', 'admin')
    )
  );

drop policy if exists "Leitura de edicoes publicas ou proprias" on public.edicoes;
create policy "Leitura de edicoes publicas ou proprias" on public.edicoes
  for select using (
    estado = 'confirmada'
    or (select auth.uid()) = criado_por
    or app_private.gere_edicao(id)
  );

drop policy if exists "Organizador atualiza edicao propria nao publicada" on public.edicoes;
create policy "Organizador atualiza edicao propria nao publicada" on public.edicoes
  for update using (
    ((select auth.uid()) = criado_por or app_private.gere_edicao(id))
    and estado in ('pendente', 'provisoria')
  ) with check (
    ((select auth.uid()) = criado_por or app_private.gere_edicao(id))
    and estado in ('pendente', 'provisoria', 'cancelada')
    and exists (
      select 1 from public.perfis
      where perfis.id = (select auth.uid())
        and perfis.papel in ('organizador', 'admin')
    )
  );

-- Tabelas filhas: mesmo padrão, sempre ancorado na edição.
drop policy if exists "Leitura de blocos publicos ou proprios" on public.edicoes_blocos;
create policy "Leitura de blocos publicos ou proprios" on public.edicoes_blocos
  for select using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_blocos.edicao_id
        and (edicoes.estado = 'confirmada' or edicoes.criado_por = (select auth.uid()))
    )
    or app_private.gere_edicao(edicao_id)
  );

drop policy if exists "Organizador atualiza blocos das suas edicoes" on public.edicoes_blocos;
create policy "Organizador atualiza blocos das suas edicoes" on public.edicoes_blocos
  for update using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_blocos.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  ) with check (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_blocos.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  );

drop policy if exists "Organizador insere blocos nas suas edicoes" on public.edicoes_blocos;
create policy "Organizador insere blocos nas suas edicoes" on public.edicoes_blocos
  for insert with check (
    exists (
      select 1 from public.edicoes join public.perfis on perfis.id = (select auth.uid())
      where edicoes.id = edicoes_blocos.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and perfis.papel in ('organizador', 'admin')
    )
  );

drop policy if exists "Organizador remove blocos das suas edicoes" on public.edicoes_blocos;
create policy "Organizador remove blocos das suas edicoes" on public.edicoes_blocos
  for delete using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_blocos.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  );

drop policy if exists "Leitura de media publica ou propria" on public.edicoes_media;
create policy "Leitura de media publica ou propria" on public.edicoes_media
  for select using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_media.edicao_id
        and (edicoes.estado = 'confirmada' or edicoes.criado_por = (select auth.uid()))
    )
    or app_private.gere_edicao(edicao_id)
  );

drop policy if exists "Organizador insere media nas suas edicoes" on public.edicoes_media;
create policy "Organizador insere media nas suas edicoes" on public.edicoes_media
  for insert with check (
    exists (
      select 1 from public.edicoes join public.perfis on perfis.id = (select auth.uid())
      where edicoes.id = edicoes_media.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
        and perfis.papel in ('organizador', 'admin')
    )
  );

drop policy if exists "Organizador atualiza media das suas edicoes" on public.edicoes_media;
create policy "Organizador atualiza media das suas edicoes" on public.edicoes_media
  for update using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_media.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  ) with check (
    exists (
      select 1 from public.edicoes join public.perfis on perfis.id = (select auth.uid())
      where edicoes.id = edicoes_media.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
        and perfis.papel in ('organizador', 'admin')
    )
  );

drop policy if exists "Organizador elimina media das suas edicoes" on public.edicoes_media;
create policy "Organizador elimina media das suas edicoes" on public.edicoes_media
  for delete using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_media.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  );

drop policy if exists "Organizador insere sublocalizacoes nas suas edicoes" on public.edicoes_sublocalizacoes;
create policy "Organizador insere sublocalizacoes nas suas edicoes" on public.edicoes_sublocalizacoes
  for insert with check (
    exists (
      select 1 from public.edicoes join public.perfis on perfis.id = (select auth.uid())
      where edicoes.id = edicoes_sublocalizacoes.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
        and perfis.papel in ('organizador', 'admin')
    )
  );

drop policy if exists "Organizador atualiza sublocalizacoes das suas edicoes" on public.edicoes_sublocalizacoes;
create policy "Organizador atualiza sublocalizacoes das suas edicoes" on public.edicoes_sublocalizacoes
  for update using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_sublocalizacoes.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  ) with check (
    exists (
      select 1 from public.edicoes join public.perfis on perfis.id = (select auth.uid())
      where edicoes.id = edicoes_sublocalizacoes.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
        and perfis.papel in ('organizador', 'admin')
    )
  );

drop policy if exists "Organizador elimina sublocalizacoes das suas edicoes" on public.edicoes_sublocalizacoes;
create policy "Organizador elimina sublocalizacoes das suas edicoes" on public.edicoes_sublocalizacoes
  for delete using (
    exists (
      select 1 from public.edicoes
      where edicoes.id = edicoes_sublocalizacoes.edicao_id
        and (edicoes.criado_por = (select auth.uid()) or app_private.gere_edicao(edicoes.id))
        and edicoes.estado in ('pendente', 'provisoria')
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Aprovação de um pedido cria a entidade — atomicamente
--
--    Os três passos (pedido aprovado, entidade criada, papel promovido) têm de
--    acontecer juntos. Feitos em chamadas separadas, uma falha a meio deixava
--    um organizador sem entidade, que é pior do que não o aprovar de todo.
-- ---------------------------------------------------------------------------

create or replace function app_private.aprovar_pedido_organizador(
  p_pedido_id uuid,
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_pedido public.pedidos_organizador;
  v_entidade_id uuid;
  v_concelho_id uuid;
  v_slug text;
  v_sufixo integer := 0;
begin
  -- FOR UPDATE: duas aprovações simultâneas não podem criar duas entidades.
  select * into v_pedido
  from public.pedidos_organizador
  where id = p_pedido_id and estado = 'pendente'
  for update;

  if not found then
    raise exception 'PEDIDO_NAO_PENDENTE';
  end if;

  select id into v_concelho_id
  from public.concelhos
  where app_private.normalizar_texto(nome) = app_private.normalizar_texto(v_pedido.concelho)
  limit 1;

  v_slug := app_private.slugificar(v_pedido.nome_entidade);
  if v_slug is null then
    v_slug := 'entidade';
  end if;
  while exists (select 1 from public.entidades where slug = v_slug) loop
    v_sufixo := v_sufixo + 1;
    v_slug := app_private.slugificar(v_pedido.nome_entidade) || '-' || v_sufixo::text;
  end loop;

  insert into public.entidades (nome, slug, tipo, concelho_id, contacto, link)
  values (v_pedido.nome_entidade, v_slug, v_pedido.tipo_entidade, v_concelho_id,
          v_pedido.contacto, v_pedido.link)
  returning id into v_entidade_id;

  insert into public.entidade_membros (entidade_id, user_id, papel)
  values (v_entidade_id, v_pedido.user_id, 'dono')
  on conflict (entidade_id, user_id) do nothing;

  -- Nunca despromover um admin.
  update public.perfis
  set papel = 'organizador'
  where id = v_pedido.user_id and papel = 'membro';

  update public.pedidos_organizador
  set estado = 'aprovado',
      nota_admin = p_nota,
      moderado_em = now()
  where id = p_pedido_id;

  return v_entidade_id;
end;
$$;

create or replace function public.aprovar_pedido_organizador(
  p_pedido_id uuid,
  p_nota text default null
)
returns uuid
language sql
security definer
set search_path = public, app_private, pg_catalog
as $$
  select app_private.aprovar_pedido_organizador(p_pedido_id, p_nota);
$$;

-- Revogar de `public` NÃO chega: o Supabase concede EXECUTE a anon e
-- authenticated por default privileges no schema public.
revoke all on function app_private.aprovar_pedido_organizador(uuid, text) from public;
revoke all on function public.aprovar_pedido_organizador(uuid, text) from public;
revoke all on function public.aprovar_pedido_organizador(uuid, text) from anon, authenticated;
grant execute on function public.aprovar_pedido_organizador(uuid, text) to service_role;
