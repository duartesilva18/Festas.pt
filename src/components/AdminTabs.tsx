import Link from "next/link";

const ABAS = [
  ["/admin/eventos", "Eventos"],
  ["/admin/eventos/todos", "Todos"],
  ["/admin/criticas", "Críticas"],
  ["/admin/pedidos", "Pedidos"],
  ["/admin/pins", "Pins do mapa"],
] as const;

// Quantos eventos estão à espera de aprovação (mostrado só na aba da fila).
async function contarPendentes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return 0;
  try {
    const resposta = await fetch(`${url}/rest/v1/edicoes?estado=eq.pendente&select=id`, {
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

export default async function AdminTabs({ ativa }: { ativa: (typeof ABAS)[number][0] }) {
  const pendentes = await contarPendentes();

  return (
    <nav className="mt-5 grid grid-cols-5 rounded-lg bg-[#1A2E4F]/[0.045] p-1">
      {ABAS.map(([href, texto]) => {
        const marcar = href === "/admin/eventos" && pendentes > 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center text-[12px] font-bold transition ${
              ativa === href ? "bg-white text-[#EC2456] shadow-sm" : "text-[#1A2E4F]/55 hover:text-[#1A2E4F]"
            }`}
          >
            {texto}
            {marcar && (
              <span
                aria-label={`${pendentes} evento${pendentes === 1 ? "" : "s"} por aprovar`}
                className="inline-flex min-w-4 items-center justify-center rounded-full bg-[#EC2456] px-1 text-[10px] font-bold leading-4 text-white"
              >
                {pendentes > 99 ? "99+" : pendentes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
