-- O perfil deixa de sondar de 15 em 15 segundos: passa a receber a decisão da
-- moderação em tempo real. A policy de SELECT já limita cada utilizador aos
-- seus próprios pedidos, e o Realtime aplica essa mesma RLS ao subscrever
-- (verificado: um cliente anónimo subscrito ao mesmo id não recebe nada).
alter publication supabase_realtime add table public.pedidos_organizador;
