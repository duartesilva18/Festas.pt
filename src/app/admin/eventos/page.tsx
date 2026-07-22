import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminTabs from "@/components/AdminTabs";
import ModerarEvento from "@/components/ModerarEvento";
import { supabaseServer } from "@/lib/supabase/server";
import { formatarDatas } from "@/lib/festa-ui";

export const metadata: Metadata = { title: "Moderação de eventos — Achafestas", robots: { index: false } };
export const dynamic = "force-dynamic";

type ProgramaDia = { dia: string; eventos: { hora?: string; titulo: string }[] };

type EdicaoPendente = {
  id: string;
  ano: number;
  data_inicio: string;
  data_fim: string | null;
  padrao_recorrencia: string;
  dias_semana: number[];
  cartaz_url: string | null;
  fotos: string[] | null;
  resumo: string | null;
  descricao: string | null;
  programa: ProgramaDia[] | null;
  contactos: { tipo: string; valor: string }[] | null;
  submetida_em: string | null;
  criado_por: string | null;
  festas: {
    nome: string;
    slug: string;
    freguesia: string | null;
    local_nome: string | null;
    morada: string | null;
    categoria_principal: string | null;
    formato_evento: string | null;
    concelhos: { nome: string; slug: string } | null;
  } | null;
};

const DIAS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function quando(data: string | null) {
  if (!data) return "sem data";
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data));
}

export default async function PaginaModeracaoEventos() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "admin") redirect("/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let pendentes: EdicaoPendente[] = [];
  let organizadores = new Map<string, { nome: string | null; email: string | null }>();
  let indisponivel = false;

  if (url && serviceKey) {
    const cabecalhos = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const select =
      "id,ano,data_inicio,data_fim,padrao_recorrencia,dias_semana,cartaz_url,fotos,resumo,descricao,programa,contactos,submetida_em,criado_por," +
      "festas(nome,slug,freguesia,local_nome,morada,categoria_principal,formato_evento,concelhos(nome,slug))";
    const resposta = await fetch(
      `${url}/rest/v1/edicoes?estado=eq.pendente&select=${encodeURIComponent(select)}&order=submetida_em.asc&limit=100`,
      { headers: cabecalhos, cache: "no-store" },
    );
    if (resposta.ok) {
      pendentes = await resposta.json();
      const ids = [...new Set(pendentes.map((e) => e.criado_por).filter((id): id is string => Boolean(id)))];
      if (ids.length) {
        const perfisResposta = await fetch(
          `${url}/rest/v1/perfis?id=in.(${ids.join(",")})&select=id,nome,email`,
          { headers: cabecalhos, cache: "no-store" },
        );
        if (perfisResposta.ok) {
          const linhas: { id: string; nome: string | null; email: string | null }[] = await perfisResposta.json();
          organizadores = new Map(linhas.map((l) => [l.id, { nome: l.nome, email: l.email }]));
        }
      }
    } else {
      indisponivel = true;
    }
  } else {
    indisponivel = true;
  }

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#102745]">Moderação de eventos</h1>
            <p className="mt-1 text-sm text-[#1A2E4F]/60">
              Eventos submetidos por organizadores. Aprovar publica-os no mapa.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EC2456]/10 px-3 py-1.5 text-sm font-bold text-[#EC2456]">
            {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
          </span>
        </div>

        <AdminTabs ativa="/admin/eventos" />

        {indisponivel && (
          <p className="mt-8 rounded-lg border border-[#c43d4b]/25 bg-[#c43d4b]/[0.04] p-4 text-sm text-[#c43d4b]">
            Não foi possível carregar os eventos pendentes. Confirma a configuração do servidor.
          </p>
        )}

        {!indisponivel && pendentes.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1A2E4F]/15 py-16 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#20856D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <p className="text-sm font-semibold text-[#1A2E4F]/70">Tudo moderado</p>
            <p className="text-xs text-[#1A2E4F]/50">Não há eventos à espera de aprovação.</p>
          </div>
        )}

        <ul className="mt-6 space-y-4">
          {pendentes.map((edicao) => {
            const festa = edicao.festas;
            const organizador = edicao.criado_por ? organizadores.get(edicao.criado_por) : null;
            const local = [festa?.local_nome, festa?.freguesia, festa?.concelhos?.nome].filter(Boolean).join(", ");
            const totalPrograma = (edicao.programa ?? []).reduce((soma, dia) => soma + (dia.eventos?.length ?? 0), 0);
            const fotos = edicao.fotos ?? [];

            return (
              <li key={edicao.id} className="rounded-xl border border-[#1A2E4F]/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#102745]">
                      {festa?.nome ?? "Evento sem nome"}
                      {(festa?.formato_evento || festa?.categoria_principal) && (
                        <span className="ml-1.5 rounded bg-[#F97B16]/10 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[#d65c00]">
                          {festa.formato_evento || festa.categoria_principal}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-[#1A2E4F]/55">
                      {organizador?.nome || "Organizador"}
                      {organizador?.email && <span> · {organizador.email}</span>}
                      <span> · submetido {quando(edicao.submetida_em)}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-3">
                  {edicao.cartaz_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={edicao.cartaz_url} alt="" className="h-28 w-20 shrink-0 rounded-md object-cover ring-1 ring-[#1A2E4F]/10" />
                  ) : (
                    <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-[#1A2E4F]/15 text-[10px] text-[#1A2E4F]/40">
                      Sem cartaz
                    </div>
                  )}
                  <dl className="min-w-0 flex-1 space-y-1 text-xs text-[#1A2E4F]/70">
                    <div>
                      <dt className="inline font-semibold text-[#102745]">Datas: </dt>
                      <dd className="inline">
                        {formatarDatas(edicao.data_inicio, edicao.data_fim)} · {edicao.ano}
                        {edicao.padrao_recorrencia === "fins_de_semana" && edicao.dias_semana?.length > 0 && (
                          <span className="ml-1 text-[#d65c00]">
                            (só {edicao.dias_semana.map((d) => DIAS[d] ?? d).join(", ")})
                          </span>
                        )}
                      </dd>
                    </div>
                    {local && <div><dt className="inline font-semibold text-[#102745]">Local: </dt><dd className="inline">{local}</dd></div>}
                    {festa?.morada && <div><dt className="inline font-semibold text-[#102745]">Morada: </dt><dd className="inline">{festa.morada}</dd></div>}
                    <div>
                      <dt className="inline font-semibold text-[#102745]">Conteúdo: </dt>
                      <dd className="inline">
                        {totalPrograma > 0 ? `${totalPrograma} itens de programa` : "sem programa"}
                        {fotos.length > 0 && ` · ${fotos.length} foto${fotos.length === 1 ? "" : "s"}`}
                        {(edicao.contactos?.length ?? 0) > 0 && ` · ${edicao.contactos!.length} contacto${edicao.contactos!.length === 1 ? "" : "s"}`}
                      </dd>
                    </div>
                  </dl>
                </div>

                {(edicao.resumo || edicao.descricao) && (
                  <p className="mt-3 line-clamp-4 whitespace-pre-line rounded-lg bg-[#1A2E4F]/[0.03] p-3.5 text-sm leading-relaxed text-[#1A2E4F]/80">
                    {edicao.resumo || edicao.descricao}
                  </p>
                )}

                {festa?.concelhos?.slug && festa.slug && (
                  <Link
                    href={`/festas/${festa.concelhos.slug}/${festa.slug}`}
                    target="_blank"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#EC2456] transition hover:text-[#d11a47]"
                  >
                    Pré-visualizar página do evento
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>
                  </Link>
                )}

                <div className="mt-4">
                  <ModerarEvento edicaoId={edicao.id} />
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
