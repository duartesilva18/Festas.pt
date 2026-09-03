-- Reclamar uma festa que já está no site.
--
-- O modelo de entidade resolveu a posse, mas deixou um buraco: uma entidade só
-- podia ser dona de festas que criasse de raiz. As 31 do arranque ficavam órfãs
-- para sempre, porque não havia forma de uma comissão dizer "esta festa é nossa".
--
-- Isto muda o convite de "venham criar uma página" — trabalho para quem já tem
-- pouco tempo — para "a vossa festa já cá está, querem ficar donos dela?".
--
-- Reaproveita a fila de moderação que já existe: uma reclamação é um pedido de
-- organizador ancorado a uma festa. Sem tabela nova, sem segunda fila.

alter table public.pedidos_organizador
  add column if not exists festa_id uuid references public.festas(id) on delete cascade;

comment on column public.pedidos_organizador.festa_id is
  'Quando preenchido, o pedido é uma reclamação de uma festa existente. '
  'NULL = pedido de verificação normal.';

create index if not exists pedidos_festa_idx on public.pedidos_organizador (festa_id);

-- O índice antigo permitia um só pedido pendente por utilizador, o que
-- impediria alguém de reclamar duas festas ao mesmo tempo. Passa a valer só
-- para pedidos de verificação; as reclamações limitam-se a uma por festa, para
-- não haver duas pessoas a reclamar a mesma coisa em simultâneo.
drop index if exists public.pedidos_um_pendente_idx;

create unique index if not exists pedidos_uma_verificacao_pendente_idx
  on public.pedidos_organizador (user_id)
  where estado = 'pendente' and festa_id is null;

create unique index if not exists pedidos_uma_reclamacao_por_festa_idx
  on public.pedidos_organizador (festa_id)
  where estado = 'pendente' and festa_id is not null;

-- ---------------------------------------------------------------------------
-- Aprovação passa a saber lidar com reclamações
-- ---------------------------------------------------------------------------

create or replace function app_private.aprovar_pedido_organizador(
  p_pedido_id uuid,
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = app_private, public, pg_catalog
as $$
declare
  v_pedido public.pedidos_organizador;
  v_entidade_id uuid;
  v_concelho_id uuid;
  v_slug text;
  v_sufixo integer := 0;
  v_afetadas integer;
begin
  select * into v_pedido
  from public.pedidos_organizador
  where id = p_pedido_id and estado = 'pendente'
  for update;

  if not found then
    raise exception 'PEDIDO_NAO_PENDENTE';
  end if;

  -- Quem já representa uma entidade não ganha outra por reclamar mais uma
  -- festa: a festa vai para a entidade que já tem. Havendo várias, a mais
  -- antiga em que é dono — caso raro, e é sempre corrigível a seguir.
  select m.entidade_id into v_entidade_id
  from public.entidade_membros m
  where m.user_id = v_pedido.user_id
  order by (m.papel = 'dono') desc, m.created_at
  limit 1;

  if v_entidade_id is null then
    select id into v_concelho_id
    from public.concelhos
    where app_private.normalizar_texto(nome) = app_private.normalizar_texto(v_pedido.concelho)
    limit 1;

    v_slug := coalesce(app_private.slugificar(v_pedido.nome_entidade), 'entidade');
    while exists (select 1 from public.entidades where slug = v_slug) loop
      v_sufixo := v_sufixo + 1;
      v_slug := coalesce(app_private.slugificar(v_pedido.nome_entidade), 'entidade') || '-' || v_sufixo::text;
    end loop;

    insert into public.entidades (nome, slug, tipo, concelho_id, contacto, link)
    values (v_pedido.nome_entidade, v_slug, v_pedido.tipo_entidade, v_concelho_id,
            v_pedido.contacto, v_pedido.link)
    returning id into v_entidade_id;

    insert into public.entidade_membros (entidade_id, user_id, papel)
    values (v_entidade_id, v_pedido.user_id, 'dono')
    on conflict (entidade_id, user_id) do nothing;
  end if;

  -- Reclamação: liga a festa à entidade. O `entidade_id is null` no filtro é a
  -- salvaguarda que interessa — uma festa que já tem dono nunca muda de mãos
  -- por esta via, mesmo que o admin carregue em aprovar por engano.
  if v_pedido.festa_id is not null then
    update public.festas
    set entidade_id = v_entidade_id
    where id = v_pedido.festa_id and entidade_id is null;
    get diagnostics v_afetadas = row_count;
    if v_afetadas = 0 then
      raise exception 'FESTA_JA_TEM_DONO';
    end if;
  end if;

  -- Nunca despromover um admin.
  update public.perfis
  set papel = 'organizador'
  where id = v_pedido.user_id and papel = 'membro';

  update public.pedidos_organizador
  set estado = 'aprovado', nota_admin = p_nota, moderado_em = now()
  where id = p_pedido_id;

  return v_entidade_id;
end;
$$;

revoke all on function app_private.aprovar_pedido_organizador(uuid, text) from public;
