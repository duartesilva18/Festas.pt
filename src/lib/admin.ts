import { supabaseServer } from "@/lib/supabase/server";

// Confirma no servidor que quem chama tem sessão válida e papel de admin.
export async function validarAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  return perfil?.papel === "admin" ? user : null;
}
