-- Rollover anual das edições.
--
-- O modelo festa ≠ edição só rende se alguém criar a edição do ano seguinte.
-- Até aqui ninguém criava: assim que a última edição confirmada passava, a festa
-- desaparecia do mapa (a view faz inner join com data_fim >= current_date) e não
-- voltava. Isto gera as edições em falta como 'provisoria' — o estado que já
-- existia no schema e no DESIGN.md (contorno tracejado) mas que nunca era usado.
--
-- Provisória significa "esta festa costuma realizar-se por esta altura, datas por
-- confirmar". Nunca inventamos uma confirmação: só o organizador ou o admin
-- promove a edição a 'confirmada'.

-- ---------------------------------------------------------------------------
-- 1. Regra que define quando a festa se repete
-- ---------------------------------------------------------------------------

alter table public.festas
  add column if not exists regra_data jsonb;

comment on column public.festas.regra_data is
  'Como se calcula a data da próxima edição. NULL = repetir o mesmo dia/mês. '
  '{"tipo":"fim_de_semana","mes":9,"dia_semana":5,"ordinal":2} = 2.º fim de semana '
  '(sexta) de setembro. {"tipo":"pascoa","offset_dias":60} = 60 dias após a Páscoa '
  '(Corpo de Deus, Espírito Santo e outras festas móveis).';

alter table public.festas drop constraint if exists festas_regra_data_check;
alter table public.festas add constraint festas_regra_data_check check (
  regra_data is null
  or (
    jsonb_typeof(regra_data) = 'object'
    and regra_data->>'tipo' in ('datas_fixas', 'fim_de_semana', 'pascoa')
  )
);

-- ---------------------------------------------------------------------------
-- 2. Domingo de Páscoa (algoritmo gregoriano anónimo)
--    Muitas romarias portuguesas dependem dele: Corpo de Deus, Espírito Santo.
-- ---------------------------------------------------------------------------

create or replace function app_private.domingo_pascoa(p_ano integer)
returns date
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  a integer; b integer; c integer; d integer; e integer;
  f integer; g integer; h integer; i integer; k integer;
  l integer; m integer; v_mes integer; v_dia integer;
begin
  a := p_ano % 19;
  b := p_ano / 100;
  c := p_ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  v_mes := (h + l - 7 * m + 114) / 31;
  v_dia := ((h + l - 7 * m + 114) % 31) + 1;
  return make_date(p_ano, v_mes, v_dia);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. N-ésimo dia da semana de um mês ("3.º sábado de agosto")
--    Devolve NULL se o mês não tiver esse n-ésimo dia, para o gerador saltar
--    a festa em vez de inventar uma data no mês seguinte.
-- ---------------------------------------------------------------------------

create or replace function app_private.enesimo_dia_semana(
  p_ano integer,
  p_mes integer,
  p_dia_semana integer,  -- ISO: 1 = segunda ... 7 = domingo
  p_ordinal integer
)
returns date
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_primeiro date;
  v_deslocamento integer;
  v_data date;
begin
  if p_mes not between 1 and 12
     or p_dia_semana not between 1 and 7
     or p_ordinal not between 1 and 5 then
    return null;
  end if;

  v_primeiro := make_date(p_ano, p_mes, 1);
  v_deslocamento := (p_dia_semana - extract(isodow from v_primeiro)::integer + 7) % 7;
  v_data := v_primeiro + v_deslocamento + (p_ordinal - 1) * 7;

  if extract(month from v_data)::integer <> p_mes then
    return null;  -- não existe (ex.: 5.º sábado num mês que só tem 4)
  end if;
  return v_data;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Data de início da próxima edição
-- ---------------------------------------------------------------------------

create or replace function app_private.data_inicio_edicao(
  p_regra jsonb,
  p_ano integer,
  p_inicio_anterior date
)
returns date
language plpgsql
immutable
set search_path = app_private, pg_catalog
as $$
declare
  v_tipo text := coalesce(p_regra->>'tipo', 'datas_fixas');
  v_mes integer;
  v_dia integer;
begin
  if p_inicio_anterior is null then
    return null;
  end if;

  if v_tipo = 'pascoa' then
    return app_private.domingo_pascoa(p_ano)
           + coalesce((p_regra->>'offset_dias')::integer, 0);
  end if;

  if v_tipo = 'fim_de_semana' then
    return app_private.enesimo_dia_semana(
      p_ano,
      coalesce((p_regra->>'mes')::integer, extract(month from p_inicio_anterior)::integer),
      coalesce((p_regra->>'dia_semana')::integer, extract(isodow from p_inicio_anterior)::integer),
      coalesce((p_regra->>'ordinal')::integer, 1)
    );
  end if;

  -- 'datas_fixas' (e o caso sem regra): mesmo dia e mês do ano anterior.
  v_mes := extract(month from p_inicio_anterior)::integer;
  v_dia := extract(day from p_inicio_anterior)::integer;

  -- 29 de fevereiro só existe em anos bissextos; recua para 28.
  if v_mes = 2 and v_dia = 29
     and not (p_ano % 4 = 0 and (p_ano % 100 <> 0 or p_ano % 400 = 0)) then
    v_dia := 28;
  end if;

  return make_date(p_ano, v_mes, v_dia);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Gerador — cria as edições em falta de um ano, como 'provisoria'
--    Idempotente: unique (festa_id, ano) e o not exists garantem que correr
--    duas vezes não duplica nem sobrepõe o que já foi confirmado à mão.
-- ---------------------------------------------------------------------------

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
    -- A posse transita, senão o organizador perde a própria festa: as três
    -- verificações de posse (perfil, editar, cancelar) filtram por criado_por,
    -- e uma edição gerada sem dono ficaria invisível e intocável para ele.
    anterior.criado_por,
    -- O conteúdo descritivo é da festa, não do ano: transita.
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
  on conflict (festa_id, ano) do nothing;

  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

-- O PostgREST só expõe o schema public; este wrapper é o ponto de entrada e só
-- o service_role o pode executar.
create or replace function public.gerar_edicoes_anuais(p_ano integer)
returns integer
language sql
security definer
set search_path = public, app_private, pg_catalog
as $$
  select app_private.gerar_edicoes_anuais(p_ano);
$$;

revoke all on function app_private.domingo_pascoa(integer) from public;
revoke all on function app_private.enesimo_dia_semana(integer, integer, integer, integer) from public;
revoke all on function app_private.data_inicio_edicao(jsonb, integer, date) from public;
revoke all on function app_private.gerar_edicoes_anuais(integer) from public;
revoke all on function public.gerar_edicoes_anuais(integer) from public;

-- ATENÇÃO: revogar de `public` NÃO chega. O Supabase concede EXECUTE a anon e
-- authenticated por default privileges no schema public, e como a função é
-- SECURITY DEFINER qualquer visitante conseguiria gerar edições. É obrigatório
-- revogar dos papéis nomeados.
revoke all on function public.gerar_edicoes_anuais(integer) from anon, authenticated;

grant execute on function public.gerar_edicoes_anuais(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Tornar as provisórias visíveis
--    A view é security_invoker, por isso sem alterar a policy o anon continuaria
--    a não ver nada de 'provisoria'.
-- ---------------------------------------------------------------------------

drop policy if exists "Leitura publica de edicoes confirmadas" on public.edicoes;
create policy "Leitura publica de edicoes publicadas" on public.edicoes
  for select using (estado in ('confirmada', 'provisoria'));

create or replace view public.festas_mapa
with (security_invoker = on) as
select
  f.id,
  f.slug,
  f.nome,
  f.freguesia,
  f.categorias,
  c.nome as concelho,
  c.slug as concelho_slug,
  c.distrito,
  extensions.st_x(f.location::extensions.geometry) as lng,
  extensions.st_y(f.location::extensions.geometry) as lat,
  e.id as edicao_id,
  e.ano,
  e.data_inicio,
  e.data_fim,
  e.estado,
  e.cartaz_url,
  avaliacoes.media_criticas,
  avaliacoes.total_criticas,
  f.categoria_principal,
  f.formato_evento,
  f.tags_evento,
  f.tipo_recorrencia,
  e.padrao_recorrencia,
  e.dias_semana
from public.festas f
join public.concelhos c on c.id = f.concelho_id
join lateral (
  select
    e.id,
    e.ano,
    e.data_inicio,
    e.data_fim,
    e.estado,
    e.cartaz_url,
    e.padrao_recorrencia,
    e.dias_semana
  from public.edicoes e
  where e.festa_id = f.id
    and e.estado in ('confirmada', 'provisoria')
    and coalesce(e.data_fim, e.data_inicio) >= current_date
  -- Havendo duas edições a começar no mesmo dia, a confirmada manda.
  order by e.data_inicio, (e.estado = 'confirmada') desc
  limit 1
) e on true
left join lateral (
  select
    round(avg(cr.nota)::numeric, 1) as media_criticas,
    count(*)::integer as total_criticas
  from public.criticas cr
  where cr.festa_id = f.id
    and cr.estado = 'aprovada'
) avaliacoes on true
where f.location is not null;

grant select on public.festas_mapa to anon, authenticated;
