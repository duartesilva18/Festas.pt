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
  avaliacoes.total_criticas
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
