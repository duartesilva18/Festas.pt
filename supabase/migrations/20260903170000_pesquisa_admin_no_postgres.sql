-- Pesquisa do painel de admin passa para o Postgres.
--
-- A listagem trazia até 400 edições e filtrava-as em JavaScript. Além de
-- transportar tudo por nada, era incorreto: passadas 400 edições a pesquisa
-- deixava de encontrar as mais antigas, sem aviso. E não havia paginação —
-- o que passasse do limite simplesmente não existia para o admin.
--
-- Fica uma função que filtra, ordena e pagina na base de dados, devolvendo já
-- a contagem total do conjunto filtrado para o frontend saber quantas páginas
-- existem.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- `unaccent` é STABLE (depende do dicionário), e um índice exige IMMUTABLE.
-- A forma de duas versões com o dicionário explícito é o padrão aceite para
-- contornar isso: fixamos o dicionário, portanto o resultado é determinístico.
create or replace function app_private.normalizar_texto(p_texto text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, '')));
$$;

-- Trigramas: aguentam o `%termo%` que um B-tree não consegue usar.
create index if not exists festas_pesquisa_trgm_idx
  on public.festas
  using gin ((app_private.normalizar_texto(coalesce(nome, '') || ' ' || coalesce(freguesia, ''))) extensions.gin_trgm_ops);

create index if not exists concelhos_pesquisa_trgm_idx
  on public.concelhos
  using gin ((app_private.normalizar_texto(coalesce(nome, '') || ' ' || coalesce(distrito, ''))) extensions.gin_trgm_ops);

-- Devolve cada linha já no formato que a página consome, para o tipo do lado
-- do TypeScript não ter de mudar, mais o total do conjunto filtrado.
create or replace function app_private.admin_listar_edicoes(
  p_estado text default null,
  p_procura text default null,
  p_limite integer default 50,
  p_offset integer default 0
)
returns table (evento jsonb, total bigint)
language sql
stable
security definer
set search_path = app_private, public, extensions, pg_catalog
as $$
  with filtradas as (
    select
      e.id, e.ano, e.data_inicio, e.data_fim, e.estado, e.cartaz_url,
      e.criado_por, e.submetida_em, e.nota_moderacao,
      f.nome as festa_nome, f.slug as festa_slug, f.freguesia,
      c.nome as concelho_nome, c.distrito, c.slug as concelho_slug
    from public.edicoes e
    join public.festas f on f.id = e.festa_id
    join public.concelhos c on c.id = f.concelho_id
    where (p_estado is null or p_estado = '' or e.estado = p_estado)
      and (
        p_procura is null or p_procura = ''
        or app_private.normalizar_texto(coalesce(f.nome, '') || ' ' || coalesce(f.freguesia, ''))
             like '%' || app_private.normalizar_texto(p_procura) || '%'
        or app_private.normalizar_texto(coalesce(c.nome, '') || ' ' || coalesce(c.distrito, ''))
             like '%' || app_private.normalizar_texto(p_procura) || '%'
      )
  )
  select
    jsonb_build_object(
      'id', id,
      'ano', ano,
      'data_inicio', data_inicio,
      'data_fim', data_fim,
      'estado', estado,
      'cartaz_url', cartaz_url,
      'criado_por', criado_por,
      'submetida_em', submetida_em,
      'nota_moderacao', nota_moderacao,
      'festas', jsonb_build_object(
        'nome', festa_nome,
        'slug', festa_slug,
        'freguesia', freguesia,
        'concelhos', jsonb_build_object('nome', concelho_nome, 'distrito', distrito, 'slug', concelho_slug)
      )
    ) as evento,
    count(*) over () as total
  from filtradas
  order by data_inicio desc
  limit greatest(1, least(coalesce(p_limite, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.admin_listar_edicoes(
  p_estado text default null,
  p_procura text default null,
  p_limite integer default 50,
  p_offset integer default 0
)
returns table (evento jsonb, total bigint)
language sql
stable
security definer
set search_path = public, app_private, pg_catalog
as $$
  select * from app_private.admin_listar_edicoes(p_estado, p_procura, p_limite, p_offset);
$$;

-- Revogar de `public` não chega: o Supabase concede EXECUTE a anon e
-- authenticated por default privileges no schema public, e isto é SECURITY
-- DEFINER — leria edições pendentes por cima da RLS.
revoke all on function app_private.admin_listar_edicoes(text, text, integer, integer) from public;
revoke all on function public.admin_listar_edicoes(text, text, integer, integer) from public;
revoke all on function public.admin_listar_edicoes(text, text, integer, integer) from anon, authenticated;
grant execute on function public.admin_listar_edicoes(text, text, integer, integer) to service_role;
