create table edicoes_sublocalizacoes (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references edicoes(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('estacionamento', 'entrada', 'palco', 'after', 'bar', 'wc', 'primeiros_socorros', 'outro')),
  descricao text,
  location extensions.geography(point, 4326) not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index edicoes_sublocalizacoes_edicao_idx on edicoes_sublocalizacoes (edicao_id, ordem);
create index edicoes_sublocalizacoes_location_idx on edicoes_sublocalizacoes using gist (location);

alter table edicoes_sublocalizacoes enable row level security;
grant select on public.edicoes_sublocalizacoes to anon, authenticated;

create policy "Leitura publica de sublocalizacoes confirmadas"
on edicoes_sublocalizacoes for select to anon, authenticated
using (
  exists (
    select 1 from edicoes
    where edicoes.id = edicoes_sublocalizacoes.edicao_id
      and edicoes.estado = 'confirmada'
  )
);
