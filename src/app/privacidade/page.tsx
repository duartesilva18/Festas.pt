import type { Metadata } from "next";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = { title: "Privacidade | Achafestas" };

export default function Privacidade() {
  return <div className="min-h-dvh bg-white text-[#1A2E4F]"><Navbar /><main className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Legal</p><h1 className="mt-2 text-3xl font-bold text-[#102745]">Privacidade</h1><div className="mt-8 space-y-6 text-sm leading-relaxed text-[#1A2E4F]/70"><p>Usamos a tua conta Google apenas para autenticação e para associar festas guardadas, preferências e críticas à tua sessão.</p><p>A localização só é usada no dispositivo quando a pedes para calcular distâncias; não é guardada pelo Achafestas.</p><p>Podes alterar os dados e preferências disponíveis no perfil. Para questões sobre dados pessoais, contacta a equipa do projeto.</p></div></main></div>;
}
