-- Liga um rascunho à edição que está a ser editada. Quando presente, submeter
-- atualiza essa edição em vez de criar um evento novo (duplicar deixa a null).
alter table public.eventos_rascunho
  add column if not exists edicao_origem uuid references public.edicoes(id) on delete set null;

create index if not exists eventos_rascunho_edicao_origem_idx
  on public.eventos_rascunho (user_id, edicao_origem)
  where edicao_origem is not null;
