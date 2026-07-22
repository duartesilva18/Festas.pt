import Link from "next/link";

const ABAS = [
  ["/admin/criticas", "Críticas"],
  ["/admin/pedidos", "Pedidos"],
  ["/admin/pins", "Pins do mapa"],
] as const;

export default function AdminTabs({ ativa }: { ativa: (typeof ABAS)[number][0] }) {
  return (
    <nav className="mt-5 grid grid-cols-3 rounded-lg bg-[#1A2E4F]/[0.045] p-1">
      {ABAS.map(([href, texto]) => (
        <Link
          key={href}
          href={href}
          className={`rounded-md px-1 py-1.5 text-center text-[12px] font-bold transition ${
            ativa === href ? "bg-white text-[#EC2456] shadow-sm" : "text-[#1A2E4F]/55 hover:text-[#1A2E4F]"
          }`}
        >
          {texto}
        </Link>
      ))}
    </nav>
  );
}
