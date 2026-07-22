-- Preferências do perfil e limitação explícita das colunas atualizáveis pelo browser.

alter table public.perfis
  add column if not exists notificacoes_eventos boolean not null default true,
  add column if not exists notificacoes_criticas boolean not null default true;

alter table public.perfis
  drop constraint if exists perfis_nome_valido,
  drop constraint if exists perfis_avatar_url_valido,
  add constraint perfis_nome_valido check (nome is null or char_length(trim(nome)) between 2 and 80),
  add constraint perfis_avatar_url_valido check (avatar_url is null or (avatar_url ~* '^https?://' and char_length(avatar_url) <= 500));

revoke update on table public.perfis from anon, authenticated;
grant update (nome, avatar_url, notificacoes_eventos, notificacoes_criticas) on table public.perfis to authenticated;
