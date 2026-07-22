import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Ajuda | Achafestas" };

const PERGUNTAS = [
  ["Como encontro uma festa?", "Usa a pesquisa por nome, vila ou concelho, ou explora o mapa. Os filtros mostram o que está a decorrer, os próximos sete dias e eventos mais à frente."],
  ["Como funcionam as críticas?", "Podes enviar uma crítica sem conta; nesse caso é validada pela equipa. Com sessão Google confirmada, a crítica é publicada automaticamente, desde que cumpra as regras."],
  ["Como guardo uma festa?", "Entra com a Google e carrega em Guardar na ficha da festa. Fica disponível no teu perfil, organizada por festas a decorrer, próximas e passadas."],
  ["Como me torno organizador?", "No teu perfil, pede verificação indicando a entidade que representas. Depois da validação pela equipa, podes criar e gerir as edições da tua entidade."],
];

export default function Ajuda() {
  return <div className="min-h-dvh bg-white text-[#1A2E4F]"><Navbar /><main className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Ajuda</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-[#102745]">Como funciona o Achafestas</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#1A2E4F]/65">O essencial para encontrares festas, participares e manteres a informação útil para todos.</p><dl className="mt-9 divide-y divide-[#1A2E4F]/10 border-y border-[#1A2E4F]/10">{PERGUNTAS.map(([pergunta, resposta]) => <div key={pergunta} className="py-5"><dt className="text-base font-bold text-[#102745]">{pergunta}</dt><dd className="mt-2 text-sm leading-relaxed text-[#1A2E4F]/70">{resposta}</dd></div>)}</dl></main></div>;
}
