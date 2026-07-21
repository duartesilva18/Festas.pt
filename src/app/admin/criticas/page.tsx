import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminTabs from "@/components/AdminTabs";
import ModerarCritica from "@/components/ModerarCritica";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Moderação de críticas — Achafestas", robots: { index: false } };
export const dynamic = "force-dynamic";

type CriticaPendente = {
  id: string;
  autor_nome: string | null;
  autor_id: string | null;
  nota: number;
  texto: string;
  created_at: string;
  festas: { nome: string; slug: string; concelhos: { nome: string; slug: string } } | null;
};

function quando(data: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data));
}

export default async function PaginaModeracao() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "admin") redirect("/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let pendentes: CriticaPendente[] = [];
  let indisponivel = false;

  if (url && serviceKey) {
    const select = "id,autor_nome,autor_id,nota,texto,created_at,festas(nome,slug,concelhos(nome,slug))";
    const resposta = await fetch(
      `${url}/rest/v1/criticas?estado=eq.pendente&select=${encodeURIComponent(select)}&order=created_at.asc&limit=100`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
    );
    if (resposta.ok) pendentes = await resposta.json();
    else indisponivel = true;
  } else {
    indisponivel = true;
  }

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#102745]">Moderação de críticas</h1>
            <p className="mt-1 text-sm text-[#1A2E4F]/60">
              Críticas anónimas ficam aqui até aprovares. As de contas Google publicam-se automaticamente.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EC2456]/10 px-3 py-1.5 text-sm font-bold text-[#EC2456]">
            {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
          </span>
        </div>

        <AdminTabs ativa="/admin/criticas" />

        {indisponivel && (
          <p className="mt-8 rounded-lg border border-[#c43d4b]/25 bg-[#c43d4b]/[0.04] p-4 text-sm text-[#c43d4b]">
            Não foi possível carregar as críticas pendentes. Confirma a configuração do servidor.
          </p>
        )}

        {!indisponivel && pendentes.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1A2E4F]/15 py-16 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#20856D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <p className="text-sm font-semibold text-[#1A2E4F]/70">Tudo moderado</p>
            <p className="text-xs text-[#1A2E4F]/50">Não há críticas à espera de validação.</p>
          </div>
        )}

        <ul className="mt-6 space-y-4">
          {pendentes.map((critica) => (
            <li key={critica.id} className="rounded-xl border border-[#1A2E4F]/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#102745]">
                    {critica.festas?.nome ?? "Festa removida"}
                    {critica.festas?.concelhos?.nome && (
                      <span className="font-medium text-[#1A2E4F]/55"> · {critica.festas.concelhos.nome}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-[#1A2E4F]/55">
                    {critica.autor_nome || "Sem nome"} · {quando(critica.created_at)}
                    {!critica.autor_id && (
                      <span className="ml-1.5 rounded bg-[#F97B16]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#d65c00]">Anónima</span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-sm tracking-wide text-[#F97B16]">
                  {"★".repeat(critica.nota)}
                  <span className="text-[#1A2E4F]/15">{"★".repeat(5 - critica.nota)}</span>
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line rounded-lg bg-[#1A2E4F]/[0.03] p-3.5 text-sm leading-relaxed text-[#1A2E4F]/80">
                {critica.texto}
              </p>

              <div className="mt-4">
                <ModerarCritica criticaId={critica.id} />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
