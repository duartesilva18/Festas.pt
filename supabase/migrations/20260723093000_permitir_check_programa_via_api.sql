-- A CHECK constraint edicoes_programa_datas_check chama
-- app_private.programa_edicao_valido, e o Postgres avalia funções de CHECK com
-- o papel que executa o INSERT/UPDATE. Sem EXECUTE, qualquer escrita em edicoes
-- feita pela API (service_role) ou por um organizador (authenticated, via RLS)
-- falhava com "permission denied for function" — o que bloqueava tanto a
-- submissão de eventos como a sua moderação.
grant usage on schema app_private to authenticated;

grant execute on function app_private.programa_edicao_valido(jsonb, date, date, text, smallint[])
  to service_role, authenticated;
