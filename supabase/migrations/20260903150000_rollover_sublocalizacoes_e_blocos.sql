-- O rollover passa a levar o recinto e os blocos para o ano seguinte.
--
-- As sublocalizações (WC, estacionamento, entradas, palcos, after) e os blocos
-- de texto vivem em tabelas filhas, e o gerador só inseria em `edicoes`. Sem
-- isto, o organizador que desenhou o recinto no mapa encontrava-o vazio no ano
-- seguinte e tinha de marcar tudo ponto por ponto outra vez — precisamente o
-- oposto do que o rollover existe para fazer.
--
-- Distinção importante entre as duas tabelas:
--
--   * Sublocalizações têm `estado`. Entram como 'rascunho', nunca publicadas.
--     Os WC e o estacionamento raramente mudam de sítio, mas os palcos e o
--     after mudam com a produção de cada ano, e publicar o after do ano
--     passado numa edição que nem sequer está confirmada mandaria alguém para
--     o sítio errado de madrugada. Como rascunho, não aparecem a ninguém no
--     site (a página filtra por 'confirmada' + visivel) mas o organizador
--     abre o wizard e encontra o recinto já desenhado, só para rever.
--     Só transitam as que estavam confirmadas: rascunhos e rejeitadas não.
--
--   * Blocos não têm `estado`, só `visivel`. São texto descritivo da festa, da
--     mesma natureza do `acerca_de` e do `resumo` que já transitam e já são
--     publicados, por isso passam tal e qual.

create or replace function app_private.gerar_edicoes_anuais(p_ano integer)
returns integer
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_criadas integer := 0;
begin
  if p_ano is null or p_ano not between 2000 and 2100 then
    raise exception 'ANO_INVALIDO';
  end if;

  with novas as (
    insert into public.edicoes (
      festa_id, ano, data_inicio, data_fim, estado, criado_por,
      titulo_personalizado, subtitulo, resumo, descricao,
      acerca_de, informacoes_uteis, contactos, links, configuracao_card,
      caracteristicas, padrao_recorrencia, dias_semana
    )
    select
      f.id,
      p_ano,
      nova.inicio,
      case
        when anterior.data_fim is null then null
        else nova.inicio + (anterior.data_fim - anterior.data_inicio)
      end,
      'provisoria',
      -- A posse transita, senão o organizador perde a própria festa: perfil,
      -- editar e cancelar filtram todos por criado_por.
      anterior.criado_por,
      anterior.titulo_personalizado, anterior.subtitulo, anterior.resumo, anterior.descricao,
      anterior.acerca_de, anterior.informacoes_uteis, anterior.contactos, anterior.links,
      anterior.configuracao_card, anterior.caracteristicas,
      anterior.padrao_recorrencia, anterior.dias_semana
      -- NÃO transitam, por serem daquele ano em concreto: cartaz_url, fotos,
      -- programa, fonte_url, verificada_em, submetida_em e nota_moderacao.
    from public.festas f
    join lateral (
      select e.*
      from public.edicoes e
      where e.festa_id = f.id
        and e.estado in ('confirmada', 'provisoria')
      order by e.ano desc
      limit 1
    ) anterior on true
    cross join lateral (
      select app_private.data_inicio_edicao(f.regra_data, p_ano, anterior.data_inicio) as inicio
    ) nova
    where f.tipo_recorrencia = 'anual'
      and nova.inicio is not null
      and anterior.ano < p_ano
      and not exists (
        select 1 from public.edicoes x
        where x.festa_id = f.id and x.ano = p_ano
      )
    on conflict (festa_id, ano) do nothing
    returning id, festa_id, ano
  ),
  -- Para cada edição nova, a edição de onde o conteúdo veio. O snapshot do
  -- statement não vê as linhas acabadas de inserir, e o `ano <` reforça-o.
  origens as (
    select n.id as nova_id, anterior.id as origem_id
    from novas n
    join lateral (
      select e.id
      from public.edicoes e
      where e.festa_id = n.festa_id
        and e.ano < n.ano
        and e.estado in ('confirmada', 'provisoria')
      order by e.ano desc
      limit 1
    ) anterior on true
  ),
  sublocais as (
    insert into public.edicoes_sublocalizacoes (
      edicao_id, nome, tipo, tipo_personalizado, descricao,
      location, ordem, horario, acessivel, visivel, estado
    )
    select
      o.nova_id, s.nome, s.tipo, s.tipo_personalizado, s.descricao,
      s.location, s.ordem, s.horario, s.acessivel, s.visivel, 'rascunho'
    from origens o
    join public.edicoes_sublocalizacoes s on s.edicao_id = o.origem_id
    where s.estado = 'confirmada'
    returning 1
  ),
  blocos as (
    insert into public.edicoes_blocos (edicao_id, chave, tipo, titulo, conteudo, visivel, ordem)
    select o.nova_id, b.chave, b.tipo, b.titulo, b.conteudo, b.visivel, b.ordem
    from origens o
    join public.edicoes_blocos b on b.edicao_id = o.origem_id
    returning 1
  )
  select count(*) into v_criadas from novas;

  return v_criadas;
end;
$$;

revoke all on function app_private.gerar_edicoes_anuais(integer) from public;
