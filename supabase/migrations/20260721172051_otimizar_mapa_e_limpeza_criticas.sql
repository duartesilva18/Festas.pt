-- O mapa só precisa de metadados para criar os pins. As fotos são carregadas
-- apenas quando o utilizador abre o detalhe da festa.
drop view if exists public.festas_mapa;

create view public.festas_mapa
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
where f.location is not null;

grant select on public.festas_mapa to anon, authenticated;

-- A lateral da view procura repetidamente a próxima edição pública de cada festa.
create index if not exists edicoes_confirmadas_por_festa_data_idx
  on public.edicoes (festa_id, data_inicio)
  where estado = 'confirmada';

-- Metadados anti-spam só são necessários para a janela de 24 horas.
-- Mantemos 48 horas para diagnóstico, removidas automaticamente uma vez por dia.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.unschedule(jobid)
from cron.job
where jobname = 'limpar-controle-criticas';

select cron.schedule(
  'limpar-controle-criticas',
  '17 3 * * *',
  $$delete from app_private.criticas_controle where created_at < now() - interval '48 hours';$$
);
