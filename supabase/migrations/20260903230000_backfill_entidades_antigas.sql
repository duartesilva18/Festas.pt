-- Organizadores aprovados ANTES do modelo de entidade ficaram sem nenhuma: na
-- altura a aprovação só mudava o papel. Sem isto criariam festas sem dono --
-- precisamente o problema que as entidades vieram resolver.
-- Os dados estão todos no pedido aprovado, portanto dá para recuperar.
do $$
declare
  r record;
  v_entidade_id uuid;
  v_concelho_id uuid;
  v_slug text;
  v_sufixo integer;
begin
  for r in
    select distinct on (pd.user_id)
      pd.user_id, pd.nome_entidade, pd.tipo_entidade, pd.concelho, pd.contacto, pd.link
    from public.pedidos_organizador pd
    join public.perfis p on p.id = pd.user_id
    where pd.estado = 'aprovado'
      and p.papel = 'organizador'
      and not exists (select 1 from public.entidade_membros m where m.user_id = pd.user_id)
    order by pd.user_id, pd.moderado_em desc nulls last, pd.created_at desc
  loop
    select id into v_concelho_id
    from public.concelhos
    where app_private.normalizar_texto(nome) = app_private.normalizar_texto(r.concelho)
    limit 1;

    v_sufixo := 0;
    v_slug := coalesce(app_private.slugificar(r.nome_entidade), 'entidade');
    while exists (select 1 from public.entidades where slug = v_slug) loop
      v_sufixo := v_sufixo + 1;
      v_slug := coalesce(app_private.slugificar(r.nome_entidade), 'entidade') || '-' || v_sufixo::text;
    end loop;

    insert into public.entidades (nome, slug, tipo, concelho_id, contacto, link)
    values (r.nome_entidade, v_slug, r.tipo_entidade, v_concelho_id, r.contacto, r.link)
    returning id into v_entidade_id;

    insert into public.entidade_membros (entidade_id, user_id, papel)
    values (v_entidade_id, r.user_id, 'dono')
    on conflict (entidade_id, user_id) do nothing;
  end loop;
end $$;
