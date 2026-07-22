-- Nota do admin ao moderar um evento (mostrada ao organizador quando rejeitado)
-- e índice para a fila de moderação.
alter table public.edicoes
  add column if not exists nota_moderacao text
  check (nota_moderacao is null or char_length(nota_moderacao) <= 500);

create index if not exists edicoes_pendentes_idx
  on public.edicoes (submetida_em desc)
  where estado = 'pendente';
