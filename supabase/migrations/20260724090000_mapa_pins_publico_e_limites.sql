-- 1) mapa_pins tinha RLS ligado e zero policies: qualquer leitura pelo cliente
--    devolvia vazio em silêncio. Os pins são conteúdo público do mapa.
drop policy if exists "mapa_pins leitura publica" on public.mapa_pins;
create policy "mapa_pins leitura publica"
  on public.mapa_pins for select
  to anon, authenticated
  using (true);

-- A policy sozinha não chega: falta também o GRANT ao nível da tabela.
grant select on public.mapa_pins to anon, authenticated;

-- 2) Limites de utilização partilhados entre instâncias (os contadores em
--    memória não sobrevivem ao modelo serverless: cada instância tinha o seu).
create table if not exists app_private.limites_uso (
  chave text primary key,
  contador integer not null default 0,
  janela_inicio timestamptz not null default now()
);

create or replace function app_private.consumir_limite(
  p_chave text,
  p_limite integer,
  p_janela_segundos integer
) returns boolean
language plpgsql
security definer
set search_path = app_private, pg_catalog
as $$
declare
  v_contador integer;
begin
  insert into app_private.limites_uso (chave, contador, janela_inicio)
  values (p_chave, 1, now())
  on conflict (chave) do update
    set contador = case
          when app_private.limites_uso.janela_inicio < now() - make_interval(secs => p_janela_segundos)
          then 1
          else app_private.limites_uso.contador + 1
        end,
        janela_inicio = case
          when app_private.limites_uso.janela_inicio < now() - make_interval(secs => p_janela_segundos)
          then now()
          else app_private.limites_uso.janela_inicio
        end
  returning contador into v_contador;

  -- Limpeza oportunista: sem isto a tabela só cresce.
  if random() < 0.01 then
    delete from app_private.limites_uso
    where janela_inicio < now() - interval '1 day';
  end if;

  return v_contador <= p_limite;
end;
$$;

revoke all on function app_private.consumir_limite(text, integer, integer) from public;
grant execute on function app_private.consumir_limite(text, integer, integer) to service_role;

-- O PostgREST só expõe o schema public; este wrapper é o ponto de entrada da
-- API e só o service_role o pode executar (nunca anon nem authenticated).
create or replace function public.consumir_limite(
  p_chave text,
  p_limite integer,
  p_janela_segundos integer
) returns boolean
language sql
security definer
set search_path = public, app_private, pg_catalog
as $$
  select app_private.consumir_limite(p_chave, p_limite, p_janela_segundos);
$$;

revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;

notify pgrst, 'reload schema';
