import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Identidade a partir do JWT.
 *
 * `getClaims()` verifica a assinatura — ao contrário de `getSession()`, que
 * confia no cookie — e com chaves assimétricas resolve tudo localmente, com a
 * JWKS em cache. Como o middleware já o chama em cada pedido, a cache está
 * quente. Se o projeto ainda usar o segredo simétrico, cai para a verificação
 * remota: nunca menos seguro do que `getUser()`, só às vezes igual de lento.
 */
async function idDoUtilizador(supabase: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" && sub ? sub : null;
}

/** Confirma no servidor que quem chama tem sessão válida e papel de admin. */
export async function validarAdmin(): Promise<{ id: string } | null> {
  const supabase = await supabaseServer();
  const id = await idDoUtilizador(supabase);
  if (!id) return null;
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", id).single();
  return perfil?.papel === "admin" ? { id } : null;
}

/**
 * Portão das páginas de admin, pensado para correr **em paralelo** com o
 * carregamento dos dados.
 *
 * A ordem natural — autenticar, depois ir buscar os dados — encadeia dois
 * round-trips à base de dados antes de a página começar sequer a renderizar.
 * Como os dados são lidos com a service key no servidor e descartados se o
 * portão fechar, nada escapa a quem não é admin, e a página passa a custar o
 * mais lento dos dois em vez da soma.
 *
 * Usar sempre assim, com o redirect FORA do Promise.all (redirect() lança):
 *
 *   const [admin, dados] = await Promise.all([ehAdmin(), carregarDados()]);
 *   if (!admin) redirect("/");
 */
export async function ehAdmin(): Promise<boolean> {
  return (await validarAdmin()) !== null;
}

/** Igual a `ehAdmin`, mas já redireciona. Só para páginas sem dados a carregar. */
export async function exigirAdmin() {
  if (!(await ehAdmin())) redirect("/");
}
