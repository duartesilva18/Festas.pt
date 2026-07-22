import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Criar evento — Achafestas", robots: { index: false } };

export default async function CriarEventoPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") redirect("/perfil");

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10">
        <Link href="/" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#1A2E4F]/60 transition hover:text-[#EC2456]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Voltar ao mapa
        </Link>
        <section className="mt-8 rounded-2xl border border-[#1A2E4F]/10 bg-[#1A2E4F]/[0.02] p-7 sm:p-9">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#EC2456]/10 text-[#EC2456]"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
          <h1 className="mt-5 text-2xl font-bold text-[#102745]">Criar evento</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#1A2E4F]/65">A área para publicares as festas da tua entidade está a ser preparada. Em breve poderás criar e gerir eventos aqui.</p>
        </section>
      </main>
    </div>
  );
}
