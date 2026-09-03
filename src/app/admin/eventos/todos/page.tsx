import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import AdminTabs from "@/components/AdminTabs";
import EstadoEventoOrganizador from "@/components/EstadoEventoOrganizador";
import { ehAdmin } from "@/lib/admin";
import { formatarDatas } from "@/lib/festa-ui";

export const metadata: Metadata = { title: "Todos os eventos — Achafestas", robots: { index: false } };
export const dynamic = "force-dynamic";

type Edicao = {
  id: string;
  ano: number;
  data_inicio: string;
  data_fim: string | null;
  estado: string;
  cartaz_url: string | null;
  criado_por: string | null;
  submetida_em: string | null;
  nota_moderacao: string | null;
  festas: {
    nome: string;
    slug: string;
    freguesia: string | null;
    concelhos: { nome: string; distrito: string | null; slug: string } | null;
  } | null;
};

const ESTADOS = {
  confirmada: { texto: "Publicado", classe: "bg-[#20856D]/10 text-[#15705c]" },
  pendente: { texto: "Em revisão", classe: "bg-[#F97B16]/10 text-[#d65c00]" },
  provisoria: { texto: "Provisório", classe: "bg-[#1A2E4F]/8 text-[#1A2E4F]/70" },
  cancelada: { texto: "Cancelado", classe: "bg-[#c43d4b]/10 text-[#c43d4b]" },
} as const;

const FILTROS = [
  ["", "Todos"],
  ["confirmada", "Publicados"],
  ["pendente", "Em revisão"],
  ["cancelada", "Cancelados"],
] as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const POR_PAGINA = 50;

type DadosTodos = {
  eventos: Edicao[];
  organizadores: Map<string, { nome: string | null; email: string | null }>;
  total: number;
  indisponivel: boolean;
};

async function carregarEventos(estado: string, procura: string, pagina: number): Promise<DadosTodos> {
  const vazio: DadosTodos = { eventos: [], organizadores: new Map(), total: 0, indisponivel: true };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return vazio;

  const cabecalhos = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  // Filtrar, ordenar e paginar no Postgres. Antes vinham 400 edicoes para
  // serem filtradas em memoria, o que alem de desperdicio era incorreto:
  // passadas 400, a pesquisa deixava de encontrar as mais antigas.
  const resposta = await fetch(`${url}/rest/v1/rpc/admin_listar_edicoes`, {
    method: "POST",
    headers: { ...cabecalhos, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_estado: estado || null,
      p_procura: procura || null,
      p_limite: POR_PAGINA,
      p_offset: (pagina - 1) * POR_PAGINA,
    }),
    cache: "no-store",
  });
  if (!resposta.ok) return vazio;

  const linhas: { evento: Edicao; total: number | null }[] = await resposta.json();
  const eventos: Edicao[] = linhas.map((l) => l.evento);
  const total = Number(linhas[0]?.total ?? 0);
  const organizadores = new Map<string, { nome: string | null; email: string | null }>();
  const ids = [...new Set(eventos.map((e) => e.criado_por).filter((id): id is string => Boolean(id)))];
  if (ids.length) {
    const perfisResposta = await fetch(
      `${url}/rest/v1/perfis?id=in.(${ids.join(",")})&select=id,nome,email`,
      { headers: cabecalhos, cache: "no-store" },
    );
    if (perfisResposta.ok) {
      const linhas: { id: string; nome: string | null; email: string | null }[] = await perfisResposta.json();
      for (const l of linhas) organizadores.set(l.id, { nome: l.nome, email: l.email });
    }
  }
  return { eventos, organizadores, total, indisponivel: false };
}

export default async function PaginaTodosEventos({ searchParams }: Props) {
  const parametros = await searchParams;
  const estadoBruto = typeof parametros.estado === "string" ? parametros.estado : "";
  const estado = estadoBruto in ESTADOS ? estadoBruto : "";
  const procura = (typeof parametros.q === "string" ? parametros.q : "").trim().slice(0, 80);

  const paginaBruta = Number(typeof parametros.pagina === "string" ? parametros.pagina : "1");
  const pagina = Number.isInteger(paginaBruta) && paginaBruta > 0 ? Math.min(paginaBruta, 1000) : 1;

  // Portão e dados em paralelo — ver a nota em @/lib/admin.
  const [admin, dados] = await Promise.all([ehAdmin(), carregarEventos(estado, procura, pagina)]);
  if (!admin) redirect("/");
  const { eventos: visiveis, organizadores, total, indisponivel } = dados;
  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));
  const ligacao = (destino: number) => {
    const query = new URLSearchParams();
    if (estado) query.set("estado", estado);
    if (procura) query.set("q", procura);
    if (destino > 1) query.set("pagina", String(destino));
    return query.toString() ? `/admin/eventos/todos?${query}` : "/admin/eventos/todos";
  };

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#102745]">Todos os eventos</h1>
            <p className="mt-1 text-sm text-[#1A2E4F]/60">
              Gere qualquer evento do site, independentemente de quem o criou.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EC2456]/10 px-3 py-1.5 text-sm font-bold text-[#EC2456]">
            {total} evento{total === 1 ? "" : "s"}
          </span>
        </div>

        <AdminTabs ativa="/admin/eventos/todos" />

        <form className="mt-5 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={procura}
            placeholder="Procurar por nome, concelho ou distrito…"
            className="min-w-0 flex-1 rounded-lg border border-[#1A2E4F]/15 px-3 py-2 text-sm outline-none transition focus:border-[#EC2456]"
          />
          {estado && <input type="hidden" name="estado" value={estado} />}
          <button type="submit" className="cursor-pointer rounded-lg bg-[#EC2456] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d11a47]">
            Procurar
          </button>
        </form>

        <nav className="mt-3 flex flex-wrap gap-1.5">
          {FILTROS.map(([valor, texto]) => {
            const query = new URLSearchParams();
            if (valor) query.set("estado", valor);
            if (procura) query.set("q", procura);
            const destino = query.toString() ? `/admin/eventos/todos?${query}` : "/admin/eventos/todos";
            return (
              <Link
                key={valor || "todos"}
                href={destino}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                  estado === valor ? "bg-[#EC2456]/10 text-[#EC2456]" : "bg-[#1A2E4F]/[0.045] text-[#1A2E4F]/55 hover:text-[#1A2E4F]"
                }`}
              >
                {texto}
              </Link>
            );
          })}
        </nav>

        {indisponivel && (
          <p className="mt-8 rounded-lg border border-[#c43d4b]/25 bg-[#c43d4b]/[0.04] p-4 text-sm text-[#c43d4b]">
            Não foi possível carregar os eventos. Confirma a configuração do servidor.
          </p>
        )}

        {!indisponivel && visiveis.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#1A2E4F]/15 py-16 text-center">
            <p className="text-sm font-semibold text-[#1A2E4F]/70">Nenhum evento encontrado</p>
            <p className="text-xs text-[#1A2E4F]/50">Ajusta a pesquisa ou o filtro de estado.</p>
          </div>
        )}

        <ul className="mt-5 space-y-3">
          {visiveis.map((evento) => {
            const festa = evento.festas;
            const etiqueta = ESTADOS[evento.estado as keyof typeof ESTADOS] ?? ESTADOS.pendente;
            const organizador = evento.criado_por ? organizadores.get(evento.criado_por) : null;
            const local = [festa?.freguesia, festa?.concelhos?.nome, festa?.concelhos?.distrito].filter(Boolean).join(" · ");

            return (
              <li key={evento.id} className="overflow-hidden rounded-xl border border-[#1A2E4F]/10">
                <div className="flex gap-3 p-4">
                  {evento.cartaz_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={evento.cartaz_url} alt="" className="h-20 w-14 shrink-0 rounded-md object-cover ring-1 ring-[#1A2E4F]/10" />
                  ) : (
                    <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-[#1A2E4F]/15 text-[10px] text-[#1A2E4F]/40">
                      Sem cartaz
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-bold text-[#102745]">{festa?.nome ?? "Evento sem nome"}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${etiqueta.classe}`}>{etiqueta.texto}</span>
                    </div>
                    {local && <p className="mt-0.5 truncate text-xs text-[#1A2E4F]/60">{local}</p>}
                    <p className="mt-1.5 inline-flex items-center rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]">
                      {formatarDatas(evento.data_inicio, evento.data_fim)} · {evento.ano}
                    </p>
                    <p className="mt-1.5 truncate text-[11px] text-[#1A2E4F]/50">
                      {organizador?.nome || organizador?.email || "Criado pela equipa"}
                    </p>
                    {evento.estado === "cancelada" && evento.nota_moderacao && (
                      <p className="mt-2 rounded-md bg-[#c43d4b]/[0.06] px-2 py-1.5 text-[11px] leading-relaxed text-[#c43d4b]">
                        Motivo: {evento.nota_moderacao}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-[#1A2E4F]/8 px-4 py-2 text-xs font-bold">
                  {festa?.concelhos?.slug && festa.slug && (
                    <Link href={`/festas/${festa.concelhos.slug}/${festa.slug}`} target="_blank" className="cursor-pointer text-[#1A2E4F]/65 transition hover:text-[#EC2456]">
                      Ver página
                    </Link>
                  )}
                  <Link href={`/criar-evento?editar=${evento.id}`} className="cursor-pointer text-[#EC2456] transition hover:text-[#d11a47]">
                    Editar
                  </Link>
                  {evento.estado === "pendente" && (
                    <Link href="/admin/eventos" className="cursor-pointer text-[#1A2E4F]/65 transition hover:text-[#EC2456]">
                      Moderar
                    </Link>
                  )}
                  <span className="ml-auto">
                    <EstadoEventoOrganizador edicaoId={evento.id} cancelado={evento.estado === "cancelada"} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {ultimaPagina > 1 && (
          <nav className="mt-6 flex items-center justify-between gap-3 border-t border-[#1A2E4F]/8 pt-4" aria-label="Paginação">
            {pagina > 1 ? (
              <Link href={ligacao(pagina - 1)} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-bold text-[#EC2456] transition hover:bg-[#EC2456]/[0.07]">
                ← Anteriores
              </Link>
            ) : <span />}
            <span className="text-xs font-semibold text-[#1A2E4F]/50">
              Página {pagina} de {ultimaPagina}
            </span>
            {pagina < ultimaPagina ? (
              <Link href={ligacao(pagina + 1)} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-bold text-[#EC2456] transition hover:bg-[#EC2456]/[0.07]">
                Seguintes →
              </Link>
            ) : <span />}
          </nav>
        )}
      </main>
    </div>
  );
}
