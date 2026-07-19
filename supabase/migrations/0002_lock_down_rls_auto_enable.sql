-- A opção "Enable automatic RLS" do Supabase cria a função rls_auto_enable()
-- como SECURITY DEFINER exposta na API pública. Fechar execução a anon/authenticated.

revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
