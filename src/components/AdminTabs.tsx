import Link from "next/link";
import { contarPendentes, type Pendentes } from "@/lib/pendentes";

const ABAS = [
  ["/admin/eventos", "Eventos", "eventos"],
  ["/admin/eventos/todos", "Todos", null],
  ["/admin/criticas", "Críticas", "criticas"],
  ["/admin/pedidos", "Pedidos", "pedidos"],
  ["/admin/pins", "Pins do mapa", null],
] as const;

export default async function AdminTabs({ ativa }: { ativa: (typeof ABAS)[number][0] }) {
  const pendentes = await contarPendentes();

  return (
    <nav className="mt-5 grid grid-cols-5 rounded-lg bg-[#1A2E4F]/[0.045] p-1">
      {ABAS.map(([href, texto, chave]) => {
        const contagem = chave ? pendentes[chave as keyof Pendentes] : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center text-[12px] font-bold transition ${
              ativa === href ? "bg-white text-[#EC2456] shadow-sm" : "text-[#1A2E4F]/55 hover:text-[#1A2E4F]"
            }`}
          >
            {texto}
            {contagem > 0 && (
              <span
                aria-label={`${contagem} por moderar`}
                className="inline-flex min-w-4 items-center justify-center rounded-full bg-[#EC2456] px-1 text-[10px] font-bold leading-4 text-white"
              >
                {contagem > 99 ? "99+" : contagem}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
