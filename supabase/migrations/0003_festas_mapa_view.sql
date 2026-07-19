-- View que alimenta o mapa: cada festa com a sua próxima edição confirmada.
-- security_invoker=on para respeitar as políticas RLS de quem consulta.

create or replace view festas_mapa
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
  e.cartaz_url
from festas f
join concelhos c on c.id = f.concelho_id
join lateral (
  select *
  from edicoes e
  where e.festa_id = f.id
    and e.estado = 'confirmada'
    and coalesce(e.data_fim, e.data_inicio) >= current_date
  order by e.data_inicio
  limit 1
) e on true
where f.location is not null;
