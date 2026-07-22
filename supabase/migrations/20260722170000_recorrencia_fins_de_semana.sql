-- Recorrência semanal dentro de uma edição, sem duplicar a festa ou os pins.

alter table public.festas drop constraint if exists festas_tipo_recorrencia_check;
alter table public.festas add constraint festas_tipo_recorrencia_check
  check (tipo_recorrencia in ('anual', 'unica', 'fins_de_semana'));

alter table public.edicoes
  add column if not exists padrao_recorrencia text not null default 'continuo',
  add column if not exists dias_semana smallint[] not null default '{}';

alter table public.edicoes drop constraint if exists edicoes_padrao_recorrencia_check;
alter table public.edicoes add constraint edicoes_padrao_recorrencia_check
  check (padrao_recorrencia in ('continuo', 'fins_de_semana'));

alter table public.edicoes drop constraint if exists edicoes_dias_semana_check;
alter table public.edicoes add constraint edicoes_dias_semana_check
  check (
    array_position(dias_semana, null) is null
    and (
      (padrao_recorrencia = 'continuo' and cardinality(dias_semana) = 0)
      or (
        padrao_recorrencia = 'fins_de_semana'
        and cardinality(dias_semana) between 1 and 3
        and dias_semana <@ array[5, 6, 7]::smallint[]
      )
    )
  );

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
    and e.estado = 'confirmada'
    and coalesce(e.data_fim, e.data_inicio) >= current_date
  order by e.data_inicio
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
