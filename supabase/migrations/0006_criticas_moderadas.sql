create table criticas (
  id uuid primary key default gen_random_uuid(),
  festa_id uuid not null references festas(id) on delete cascade,
  autor_nome text check (char_length(autor_nome) between 2 and 60),
  nota smallint not null check (nota between 1 and 5),
  texto text not null check (char_length(texto) between 20 and 1200),
  estado text not null default 'pendente' check (estado in ('pendente', 'aprovada', 'rejeitada')),
  created_at timestamptz not null default now(),
  moderada_em timestamptz
);

create index criticas_festa_estado_created_idx on criticas (festa_id, estado, created_at desc);

alter table criticas enable row level security;
grant select on public.criticas to anon, authenticated;

create policy "Leitura publica de criticas aprovadas"
on criticas for select to anon, authenticated
using (estado = 'aprovada');
