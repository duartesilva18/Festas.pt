-- Internal anti-abuse metadata. This schema is not exposed through the Data API.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

create table if not exists app_private.criticas_controle (
  critica_id uuid primary key references public.criticas(id) on delete cascade,
  ip_hash text not null check (char_length(ip_hash) = 64),
  created_at timestamptz not null default now()
);

alter table app_private.criticas_controle enable row level security;
revoke all on table app_private.criticas_controle from public, anon, authenticated;
grant select, insert, delete on table app_private.criticas_controle to service_role;
create policy "Acesso apenas pelo servidor"
on app_private.criticas_controle for all to service_role
using (true) with check (true);

create index if not exists criticas_controle_ip_created_idx
  on app_private.criticas_controle (ip_hash, created_at desc);

-- This RPC is server-only. It is not callable with the anon or authenticated keys.
create or replace function public.submeter_critica(
  p_festa_id uuid,
  p_autor_nome text,
  p_nota smallint,
  p_texto text,
  p_ip_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  nova_critica_id uuid;
  nome_limpo text := nullif(btrim(p_autor_nome), '');
  texto_limpo text := btrim(p_texto);
begin
  if p_festa_id is null or not exists (select 1 from public.festas where id = p_festa_id) then
    raise exception 'FESTA_INVALIDA';
  end if;

  if p_nota not between 1 and 5 then raise exception 'NOTA_INVALIDA'; end if;
  if nome_limpo is not null and char_length(nome_limpo) not between 2 and 60 then raise exception 'NOME_INVALIDO'; end if;
  if char_length(texto_limpo) not between 20 and 1200 then raise exception 'TEXTO_INVALIDO'; end if;
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'PEDIDO_INVALIDO'; end if;

  if (select count(*) from app_private.criticas_controle where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'RATE_LIMIT';
  end if;

  if exists (
    select 1 from public.criticas c
    join app_private.criticas_controle cc on cc.critica_id = c.id
    where cc.ip_hash = p_ip_hash and c.festa_id = p_festa_id and c.texto = texto_limpo
      and c.created_at > now() - interval '7 days'
  ) then raise exception 'DUPLICADA'; end if;

  insert into public.criticas (festa_id, autor_nome, nota, texto, estado)
  values (p_festa_id, nome_limpo, p_nota, texto_limpo, 'pendente')
  returning id into nova_critica_id;

  insert into app_private.criticas_controle (critica_id, ip_hash)
  values (nova_critica_id, p_ip_hash);
  return nova_critica_id;
end;
$$;

revoke all on function public.submeter_critica(uuid, text, smallint, text, text) from public, anon, authenticated;
grant execute on function public.submeter_critica(uuid, text, smallint, text, text) to service_role;
