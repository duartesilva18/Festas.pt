-- Coluna de fotos em falta na edições, e reparação de mojibake introduzido
-- pelo seed manual inicial (dupla codificação UTF-8/Latin1).

alter table edicoes add column if not exists fotos text[];

update festas set
  nome = convert_from(convert_to(nome, 'LATIN1'), 'UTF8'),
  freguesia = convert_from(convert_to(freguesia, 'LATIN1'), 'UTF8'),
  descricao = convert_from(convert_to(descricao, 'LATIN1'), 'UTF8')
where nome ~ 'Ã|Â';

update concelhos set
  nome = convert_from(convert_to(nome, 'LATIN1'), 'UTF8'),
  distrito = convert_from(convert_to(distrito, 'LATIN1'), 'UTF8')
where nome ~ 'Ã|Â' or distrito ~ 'Ã|Â';

-- View do mapa passa a incluir fotos.
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
  e.cartaz_url,
  e.fotos
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
