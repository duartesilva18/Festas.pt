-- Pedidos de verificação de entidade organizadora (juntas, câmaras, comissões).
-- O admin aprova/rejeita; aprovar promove o perfil a papel='organizador'.

create table pedidos_organizador (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  nome_entidade text not null check (char_length(nome_entidade) between 2 and 120),
  tipo_entidade text not null check (tipo_entidade in
    ('junta_freguesia','camara_municipal','comissao_festas','associacao','outro')),
  concelho text not null check (char_length(concelho) between 2 and 80),
  contacto text not null check (char_length(contacto) between 5 and 120),
  link text check (link is null or (link ~* '^https?://' and char_length(link) <= 300)),
  justificacao text not null check (char_length(justificacao) between 20 and 1000),
  estado text not null default 'pendente' check (estado in ('pendente','aprovado','rejeitado')),
  nota_admin text check (nota_admin is null or char_length(nota_admin) <= 500),
  created_at timestamptz not null default now(),
  moderado_em timestamptz
);

-- Só um pedido pendente por utilizador; novo pedido após rejeição é permitido.
create unique index pedidos_um_pendente_idx on pedidos_organizador (user_id) where estado = 'pendente';

alter table pedidos_organizador enable row level security;

create policy "Ver os proprios pedidos" on pedidos_organizador
  for select using ((select auth.uid()) = user_id);

create policy "Submeter pedido proprio" on pedidos_organizador
  for insert with check ((select auth.uid()) = user_id and estado = 'pendente');
