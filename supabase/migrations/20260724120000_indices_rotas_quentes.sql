-- 1) Página de evento: o filtro é por slug isolado, mas o único índice era o
--    composto (concelho_id, slug), que não serve de prefixo. Dava seq scan em
--    cada visita a uma ficha de festa.
create index if not exists festas_slug_idx on public.festas (slug);

-- 2) Perfil: último pedido do utilizador. O índice existente só cobre pedidos
--    pendentes, por isso quem já tinha sido aprovado/rejeitado caía em seq
--    scan — e o perfil sonda esta linha a cada 15s enquanto está pendente.
create index if not exists pedidos_organizador_user_created_idx
  on public.pedidos_organizador (user_id, created_at desc);

-- 3) Fila de moderação de críticas e o contador do badge (corre em cada carga
--    de página do admin). Parcial: só interessam as pendentes.
create index if not exists criticas_pendentes_idx
  on public.criticas (created_at) where estado = 'pendente';
