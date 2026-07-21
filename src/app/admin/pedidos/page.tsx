import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminTabs from "@/components/AdminTabs";
import ModerarPedido from "@/components/ModerarPedido";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pedidos de organizador — Achafestas", robots: { index: false } };
export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  junta_freguesia: "Junta de freguesia",
  camara_municipal: "Câmara municipal",
  comissao_festas: "Comissão de festas",
  associacao: "Associação",
  outro: "Outro",
};

type PedidoPendente = {
  id: string;
  nome_entidade: string;
  tipo_entidade: string;
  concelho: string;
  contacto: string;
  link: string | null;
  justificacao: string;
  created_at: string;
  perfis: { nome: string | null; email: string | null } | null;
};

function quando(data: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(data));
}

export default async function PaginaPedidos() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "admin") redirect("/");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let pendentes: PedidoPendente[] = [];
  let indisponivel = false;

  if (url && serviceKey) {
    const select = "id,nome_entidade,tipo_entidade,concelho,contacto,link,justificacao,created_at,perfis(nome,email)";
    const resposta = await fetch(
      `${url}/rest/v1/pedidos_organizador?estado=eq.pendente&select=${encodeURIComponent(select)}&order=created_at.asc&limit=100`,
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
            <h1 className="text-2xl font-bold text-[#102745]">Pedidos de organizador</h1>
            <p className="mt-1 text-sm text-[#1A2E4F]/60">
              Entidades que pediram verificação. Aprovar dá permissão para publicar eventos.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EC2456]/10 px-3 py-1.5 text-sm font-bold text-[#EC2456]">
            {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
          </span>
        </div>

        <AdminTabs ativa="/admin/pedidos" />

        {indisponivel && (
          <p className="mt-8 rounded-lg border border-[#c43d4b]/25 bg-[#c43d4b]/[0.04] p-4 text-sm text-[#c43d4b]">
            Não foi possível carregar os pedidos. Confirma a configuração do servidor.
          </p>
        )}

        {!indisponivel && pendentes.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1A2E4F]/15 py-16 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#20856D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <p className="text-sm font-semibold text-[#1A2E4F]/70">Tudo tratado</p>
            <p className="text-xs text-[#1A2E4F]/50">Não há pedidos à espera de validação.</p>
          </div>
        )}

        <ul className="mt-6 space-y-4">
          {pendentes.map((pedido) => (
            <li key={pedido.id} className="rounded-xl border border-[#1A2E4F]/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#102745]">
                    {pedido.nome_entidade}
                    <span className="ml-1.5 rounded bg-[#F97B16]/10 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[#d65c00]">
                      {TIPOS[pedido.tipo_entidade] ?? pedido.tipo_entidade}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-[#1A2E4F]/55">
                    {pedido.perfis?.nome || "Sem nome"}
                    {pedido.perfis?.email && <span> · {pedido.perfis.email}</span>}
                    <span> · {quando(pedido.created_at)}</span>
                  </p>
                </div>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-[#1A2E4F]/70">
                <div><dt className="inline font-semibold text-[#102745]">Concelho: </dt><dd className="inline">{pedido.concelho}</dd></div>
                <div><dt className="inline font-semibold text-[#102745]">Contacto: </dt><dd className="inline">{pedido.contacto}</dd></div>
                {pedido.link && (
                  <div>
                    <dt className="inline font-semibold text-[#102745]">Comprovativo: </dt>
                    <dd className="inline">
                      <a href={pedido.link} target="_blank" rel="noopener noreferrer" className="break-all text-[#EC2456] underline underline-offset-2 hover:text-[#d11a47]">
                        {pedido.link}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              <p className="mt-3 whitespace-pre-line rounded-lg bg-[#1A2E4F]/[0.03] p-3.5 text-sm leading-relaxed text-[#1A2E4F]/80">
                {pedido.justificacao}
              </p>

              <div className="mt-4">
                <ModerarPedido pedidoId={pedido.id} />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
