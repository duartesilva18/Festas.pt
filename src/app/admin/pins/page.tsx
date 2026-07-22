import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminTabs from "@/components/AdminTabs";
import GestorPinsMapa from "@/components/GestorPinsMapa";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pins do mapa — Achafestas", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PaginaPinsMapa() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "admin") redirect("/");

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#EC2456]">Mapa</p>
          <h1 className="mt-1 text-2xl font-bold text-[#102745]">Pins do mapa</h1>
          <p className="mt-1 text-sm text-[#1A2E4F]/60">Carrega uma imagem, vê-a no mapa e escolhe exatamente a que tipo de ponto pertence.</p>
        </div>
        <AdminTabs ativa="/admin/pins" />
        <GestorPinsMapa />
      </main>
    </div>
  );
}
