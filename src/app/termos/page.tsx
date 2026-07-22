import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Termos | Achafestas" };

export default function Termos() {
  return <div className="min-h-dvh bg-white text-[#1A2E4F]"><Navbar /><main className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Legal</p><h1 className="mt-2 text-3xl font-bold text-[#102745]">Termos de utilização</h1><div className="mt-8 space-y-6 text-sm leading-relaxed text-[#1A2E4F]/70"><p>O Achafestas agrega informação sobre festas e romarias. Procuramos mantê-la atualizada, mas a confirmação final de horários, acessos e condições deve ser feita junto da organização.</p><p>As críticas devem refletir experiências reais, sem linguagem ofensiva, dados pessoais ou publicidade. Podemos moderar ou remover conteúdo que não cumpra estas regras.</p><p>Organizadores são responsáveis pela exatidão da informação que submetem. <Link href="/ajuda" className="font-bold text-[#EC2456]">Consulta a ajuda</Link> para saberes como funcionam críticas e verificação.</p></div></main></div>;
}
