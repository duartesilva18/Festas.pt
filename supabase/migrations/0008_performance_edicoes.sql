create index if not exists edicoes_criado_por_idx on public.edicoes (criado_por);

drop policy if exists "Leitura publica de edicoes confirmadas" on public.edicoes;
drop policy if exists "Utilizador ve as suas proprias submissoes" on public.edicoes;

create policy "Leitura de edicoes publicas ou proprias"
on public.edicoes for select to anon, authenticated
using (estado = 'confirmada' or (select auth.uid()) = criado_por);
