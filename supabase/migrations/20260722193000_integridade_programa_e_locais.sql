-- Garante que o programa usa datas ISO dentro da edição e que pontos de
-- recinto só se tornam públicos depois de confirmados.

create or replace function app_private.programa_edicao_valido(
  p_programa jsonb,
  p_inicio date,
  p_fim date,
  p_padrao text,
  p_dias smallint[]
) returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  dia jsonb;
  evento jsonb;
  data_programa date;
begin
  if p_programa is null then return true; end if;
  if jsonb_typeof(p_programa) <> 'array' or jsonb_array_length(p_programa) > 100 then return false; end if;
  for dia in select value from jsonb_array_elements(p_programa) loop
    if jsonb_typeof(dia) <> 'object' or coalesce(dia->>'dia', '') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
    data_programa := (dia->>'dia')::date;
    if data_programa < p_inicio or data_programa > coalesce(p_fim, p_inicio) then return false; end if;
    if p_padrao = 'fins_de_semana' and not (extract(isodow from data_programa)::smallint = any(p_dias)) then return false; end if;
    if jsonb_typeof(dia->'eventos') <> 'array' or jsonb_array_length(dia->'eventos') = 0 then return false; end if;
    for evento in select value from jsonb_array_elements(dia->'eventos') loop
      if jsonb_typeof(evento) <> 'object' or length(trim(coalesce(evento->>'titulo', ''))) = 0 then return false; end if;
      if evento ? 'hora' and evento->>'hora' !~ '^([01]\d|2[0-3]):[0-5]\d$' then return false; end if;
    end loop;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

-- O programa legado das Feiras Novas correspondia à sexta, sábado e domingo
-- desta edição, mas guardava rótulos de uma edição anterior.
update public.edicoes e
set programa = (
  select jsonb_agg(
    jsonb_set(dia, '{dia}', to_jsonb(case dia->>'dia'
      when 'Sexta, 4 de setembro' then '2026-09-11'
      when 'Sábado, 5 de setembro' then '2026-09-12'
      when 'Domingo, 6 de setembro' then '2026-09-13'
      else dia->>'dia'
    end), false)
    order by ordem
  )
  from jsonb_array_elements(e.programa) with ordinality as itens(dia, ordem)
)
from public.festas f
where f.id = e.festa_id
  and f.slug = 'feiras-novas'
  and e.ano = 2026
  and e.programa is not null;

alter table public.edicoes drop constraint if exists edicoes_programa_datas_check;
alter table public.edicoes add constraint edicoes_programa_datas_check
  check (app_private.programa_edicao_valido(programa, data_inicio, data_fim, padrao_recorrencia, dias_semana));

alter table public.edicoes_sublocalizacoes
  add column if not exists estado text not null default 'rascunho';
alter table public.edicoes_sublocalizacoes drop constraint if exists edicoes_sublocalizacoes_estado_check;
alter table public.edicoes_sublocalizacoes add constraint edicoes_sublocalizacoes_estado_check
  check (estado in ('rascunho', 'confirmada', 'rejeitada'));

update public.edicoes_sublocalizacoes
set estado = 'rejeitada'
where nome ilike '%(demo)%' and estado <> 'rejeitada';

drop policy if exists "Leitura publica de sublocalizacoes confirmadas" on public.edicoes_sublocalizacoes;
create policy "Leitura publica de sublocalizacoes confirmadas"
on public.edicoes_sublocalizacoes for select to anon, authenticated
using (
  visivel
  and estado = 'confirmada'
  and exists (
    select 1 from public.edicoes
    where edicoes.id = edicoes_sublocalizacoes.edicao_id
      and edicoes.estado = 'confirmada'
  )
);

create or replace function app_private.sincronizar_sublocalizacoes_confirmadas()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.estado = 'confirmada' and old.estado is distinct from new.estado then
    update public.edicoes_sublocalizacoes
      set estado = 'confirmada', updated_at = now()
      where edicao_id = new.id and estado = 'rascunho';
  elsif new.estado <> 'confirmada' and old.estado = 'confirmada' then
    update public.edicoes_sublocalizacoes
      set estado = 'rascunho', updated_at = now()
      where edicao_id = new.id and estado = 'confirmada';
  end if;
  return new;
end;
$$;

drop trigger if exists sincronizar_sublocalizacoes_confirmadas on public.edicoes;
create trigger sincronizar_sublocalizacoes_confirmadas
after update of estado on public.edicoes
for each row execute function app_private.sincronizar_sublocalizacoes_confirmadas();

revoke execute on function app_private.programa_edicao_valido(jsonb, date, date, text, smallint[]) from public, anon, authenticated;
revoke execute on function app_private.sincronizar_sublocalizacoes_confirmadas() from public, anon, authenticated;
