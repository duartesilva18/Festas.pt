export type Pendentes = { eventos: number; criticas: number; pedidos: number; total: number };

const VAZIO: Pendentes = { eventos: 0, criticas: 0, pedidos: 0, total: 0 };

// Conta linhas sem as trazer: HEAD + count=exact devolve só o Content-Range.
async function contar(url: string, serviceKey: string, tabela: string) {
  try {
    const resposta = await fetch(`${url}/rest/v1/${tabela}?estado=eq.pendente&select=id`, {
      method: "HEAD",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: "count=exact", Range: "0-0" },
      cache: "no-store",
    });
    if (!resposta.ok && resposta.status !== 206) return 0;
    const total = Number(resposta.headers.get("content-range")?.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

/** Fila de moderação do admin. Devolve zeros se o servidor não estiver configurado. */
export async function contarPendentes(): Promise<Pendentes> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return VAZIO;

  const [eventos, criticas, pedidos] = await Promise.all([
    contar(url, serviceKey, "edicoes"),
    contar(url, serviceKey, "criticas"),
    contar(url, serviceKey, "pedidos_organizador"),
  ]);

  return { eventos, criticas, pedidos, total: eventos + criticas + pedidos };
}
