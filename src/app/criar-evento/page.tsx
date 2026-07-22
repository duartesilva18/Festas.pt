import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CriadorEvento from "@/components/CriadorEvento";
import Navbar from "@/components/Navbar";
import { normalizarDadosEvento, type RascunhoEvento } from "@/lib/criar-evento";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar evento | Achafestas", robots: { index: false } };

export default async function CriarEventoPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: perfil }, { data: concelhos }, { data: rascunho }] = await Promise.all([
    supabase.from("perfis").select("papel").eq("id", user.id).single(),
    supabase.from("concelhos").select("id,nome,distrito").order("nome"),
    supabase.from("eventos_rascunho").select("id,nome,dados,versao,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") redirect("/perfil");

  const rascunhoInicial: RascunhoEvento | null = rascunho ? {
    id: rascunho.id,
    nome: rascunho.nome,
    dados: normalizarDadosEvento(rascunho.dados),
    versao: rascunho.versao,
    updated_at: rascunho.updated_at,
  } : null;

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#1A2E4F]">
      <Navbar />
      <CriadorEvento concelhos={concelhos ?? []} rascunhoInicial={rascunhoInicial} />
    </div>
  );
}
