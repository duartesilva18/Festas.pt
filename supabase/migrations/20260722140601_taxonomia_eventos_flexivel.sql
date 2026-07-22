-- Taxonomia ampla para eventos: uma categoria estável para pesquisa/filtros,
-- um formato livre (Sunset, Romaria, DJ set, etc.) e tags complementares.
-- A escolha visual dos pins permanece independente destes campos.

alter table public.festas
  add column if not exists categoria_principal text not null default 'festa_popular',
  add column if not exists formato_evento text,
  add column if not exists tags_evento text[] not null default '{}';

alter table public.festas drop constraint if exists festas_categoria_principal_check;
alter table public.festas add constraint festas_categoria_principal_check
  check (categoria_principal in (
    'festa_popular',
    'musica_noite',
    'gastronomia',
    'cultura_artes',
    'feiras_mercados',
    'religiao_tradicao',
    'desporto_aventura',
    'familia',
    'academico',
    'comunidade',
    'outro'
  ));

alter table public.festas drop constraint if exists festas_formato_evento_tamanho_check;
alter table public.festas add constraint festas_formato_evento_tamanho_check
  check (formato_evento is null or char_length(formato_evento) between 2 and 80);

alter table public.festas drop constraint if exists festas_tags_evento_check;
alter table public.festas add constraint festas_tags_evento_check
  check (
    coalesce(cardinality(tags_evento), 0) <= 8
    and array_position(tags_evento, null) is null
    and octet_length(array_to_string(tags_evento, '', '')) <= 320
  );

-- Mantém os eventos existentes bem classificados sem apagar o campo legado.
update public.festas
set categoria_principal = case
  when categorias && array['Música']::text[] then 'musica_noite'
  when categorias && array['Gastronomia']::text[] then 'gastronomia'
  when categorias && array['Feira']::text[] then 'feiras_mercados'
  when categorias && array['Religiosa']::text[] then 'religiao_tradicao'
  when categorias && array['Família']::text[] then 'familia'
  else 'festa_popular'
end,
formato_evento = coalesce(
  formato_evento,
  case
    when categorias && array['Romaria']::text[] then 'Romaria'
    when categorias && array['Arraial']::text[] then 'Arraial'
    when categorias && array['Feira']::text[] then 'Feira'
    else null
  end
);

create index if not exists festas_categoria_principal_idx
  on public.festas (categoria_principal);

create index if not exists festas_tags_evento_idx
  on public.festas using gin (tags_evento);

create index if not exists mapa_pins_atualizado_por_idx
  on public.mapa_pins (atualizado_por)
  where atualizado_por is not null;

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
  f.tags_evento
from public.festas f
join public.concelhos c on c.id = f.concelho_id
join lateral (
  select e.id, e.ano, e.data_inicio, e.data_fim, e.estado, e.cartaz_url
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
