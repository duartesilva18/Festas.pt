import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CriadorEvento from "@/components/CriadorEvento";
import Navbar from "@/components/Navbar";
import { normalizarDadosEvento, type RascunhoEvento } from "@/lib/criar-evento";
import { dadosDoEvento, SELECT_EDICAO_EDITAR, type EdicaoParaEditar } from "@/lib/editar-evento";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar evento | Achafestas", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CriarEventoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const parametros = await searchParams;
  const paraEditar = typeof parametros.editar === "string" && UUID.test(parametros.editar) ? parametros.editar : null;
  const paraDuplicar = typeof parametros.duplicar === "string" && UUID.test(parametros.duplicar) ? parametros.duplicar : null;
  const origem = paraEditar ?? paraDuplicar;

  const [{ data: perfil }, { data: concelhos }] = await Promise.all([
    supabase.from("perfis").select("papel").eq("id", user.id).single(),
    supabase.from("concelhos").select("id,nome,distrito").order("nome"),
  ]);

  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") redirect("/perfil");

  let rascunhoInicial: RascunhoEvento | null = null;
  let edicaoOrigem: string | null = null;
  let modo: "novo" | "editar" | "duplicar" = "novo";

  if (origem) {
    // Só carrega eventos do próprio organizador (o admin pode editar qualquer um).
    let consulta = supabase.from("edicoes").select(SELECT_EDICAO_EDITAR).eq("id", origem);
    if (perfil.papel !== "admin") consulta = consulta.eq("criado_por", user.id);
    const { data: edicao } = await consulta.maybeSingle();

    if (edicao) {
      const manterDatas = Boolean(paraEditar);
      rascunhoInicial = {
        id: "",
        nome: (edicao as unknown as EdicaoParaEditar).festas?.nome ?? "Evento",
        dados: dadosDoEvento(edicao as unknown as EdicaoParaEditar, manterDatas),
        versao: 0,
        updated_at: new Date().toISOString(),
      };
      edicaoOrigem = paraEditar;
      modo = paraEditar ? "editar" : "duplicar";
    }
  }

  if (!rascunhoInicial) {
    const { data: rascunho } = await supabase
      .from("eventos_rascunho")
      .select("id,nome,dados,versao,updated_at,edicao_origem")
      .eq("user_id", user.id)
      .is("edicao_origem", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rascunho) {
      rascunhoInicial = {
        id: rascunho.id,
        nome: rascunho.nome,
        dados: normalizarDadosEvento(rascunho.dados),
        versao: rascunho.versao,
        updated_at: rascunho.updated_at,
      };
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#1A2E4F]">
      <Navbar />
      <CriadorEvento
        concelhos={concelhos ?? []}
        rascunhoInicial={rascunhoInicial}
        edicaoOrigem={edicaoOrigem}
        modo={modo}
      />
    </div>
  );
}
