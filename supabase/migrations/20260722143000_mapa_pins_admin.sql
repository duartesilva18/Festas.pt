create table if not exists public.mapa_pins (
  tipo text primary key check (tipo in ('festa_a_decorrer', 'festa_em_breve', 'festa_mais_tarde', 'grupo_festas', 'estacionamento', 'entrada_principal', 'casas_banho', 'palco_after')),
  nome text not null check (char_length(nome) between 2 and 80),
  imagem_url text not null check (imagem_url ~ '^https?://'),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.mapa_pins enable row level security;
revoke all on table public.mapa_pins from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mapa-pins', 'mapa-pins', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];
