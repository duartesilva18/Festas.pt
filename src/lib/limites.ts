/**
 * Limites de utilização partilhados por todas as instâncias.
 *
 * Contadores em memória não servem em serverless: cada instância tem o seu, e
 * o limite real acaba por ser N vezes maior do que o configurado. O estado vive
 * no Postgres, através de uma função que incrementa e decide numa só ida.
 */

const DEGRADAR_ABERTO = true; // uma falha do contador não deve bloquear o site

export async function dentroDoLimite(chave: string, limite: number, janelaSegundos: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return DEGRADAR_ABERTO;

  try {
    const resposta = await fetch(`${url}/rest/v1/rpc/consumir_limite`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_chave: chave, p_limite: limite, p_janela_segundos: janelaSegundos }),
      cache: "no-store",
    });
    if (!resposta.ok) return DEGRADAR_ABERTO;
    return (await resposta.json()) === true;
  } catch {
    return DEGRADAR_ABERTO;
  }
}

/** Identificador de quem faz o pedido, quando não há sessão. */
export function identificarPedido(req: Request) {
  const cabecalho = req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local";
  return cabecalho.trim().slice(0, 64) || "local";
}
