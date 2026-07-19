import Image from "next/image";
import FestaMap from "@/components/FestaMap";
import { fetchFestasGeoJSON } from "@/lib/eventos";

export const revalidate = 300;

const LEGENDA = [
  { cor: "#E63946", texto: "A decorrer" },
  { cor: "#FFB703", texto: "Nos próximos 7 dias" },
  { cor: "#457B9D", texto: "Mais tarde" },
] as const;

export default async function Home() {
  const dados = await fetchFestasGeoJSON();

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#FFF8F0]">
      <FestaMap dados={dados} />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 sm:p-4">
        <div className="pointer-events-auto rounded-2xl bg-[#FFF8F0]/95 px-4 py-2.5 shadow-lg ring-1 ring-[#1D3557]/10 backdrop-blur">
          <Image src="/logo.svg" alt="Achafestas" width={172} height={35} priority />
          <p className="mt-0.5 hidden text-xs font-medium text-[#457B9D] sm:block">
            O mapa das festas populares de Portugal
          </p>
        </div>
        <div className="pointer-events-auto rounded-full bg-[#FFF8F0]/95 px-4 py-2 text-sm font-semibold text-[#1D3557] shadow-lg ring-1 ring-[#1D3557]/10 backdrop-blur">
          {dados.features.length} festas no mapa
        </div>
      </header>

      <aside className="pointer-events-none absolute bottom-6 left-3 z-10 sm:left-4">
        <ul className="pointer-events-auto space-y-1.5 rounded-2xl bg-[#FFF8F0]/95 px-4 py-3 shadow-lg ring-1 ring-[#1D3557]/10 backdrop-blur">
          {LEGENDA.map((item) => (
            <li key={item.texto} className="flex items-center gap-2.5 text-xs font-medium text-[#1D3557]">
              <span
                className="inline-block size-3 rounded-full ring-2 ring-[#FFF8F0]"
                style={{ backgroundColor: item.cor }}
              />
              {item.texto}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
