import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

// Cliente Supabase para componentes do browser (partilha a sessão via cookies).
export function supabaseBrowser(): SupabaseClient {
  if (cliente) return cliente;
  cliente = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cliente;
}
