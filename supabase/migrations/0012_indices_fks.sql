-- Índices em chaves estrangeiras sem cobertura (advisor de performance):
-- acelera a remoção em cascata e as consultas por festa/autor.
create index if not exists favoritos_festa_id_idx on public.favoritos (festa_id);
create index if not exists criticas_autor_id_idx on public.criticas (autor_id) where autor_id is not null;
