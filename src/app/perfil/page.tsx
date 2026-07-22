import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import PedidoOrganizador from "@/components/PedidoOrganizador";
import AvisoOrganizador from "@/components/AvisoOrganizador";
import CriticasRecebidas from "@/components/CriticasRecebidas";
import FestasGuardadasPerfil from "@/components/FestasGuardadasPerfil";
import DefinicoesPerfil from "@/components/DefinicoesPerfil";
import EstadoEventoOrganizador from "@/components/EstadoEventoOrganizador";
import EscutaPedidoOrganizador from "@/components/EscutaPedidoOrganizador";
import { supabaseServer } from "@/lib/supabase/server";
import { formatarDatas } from "@/lib/festa-ui";

export const metadata: Metadata = { title: "O meu perfil | Achafestas", robots: { index: false } };

type FestaGuardada = {
  id: string;
  slug: string;
  nome: string;
  concelho: string;
  concelho_slug: string;
  distrito: string;
  data_inicio: string;
  data_fim: string | null;
  cartaz_url: string | null;
  tipo_recorrencia: string;
  dias_semana: number[];
};

type EventoCriado = {
  id: string;
  ano: number;
  data_inicio: string;
  data_fim: string | null;
  created_at: string;
  estado: "pendente" | "confirmada" | "provisoria" | "cancelada";
  cartaz_url: string | null;
  nota_moderacao: string | null;
  dias_semana: number[];
  festa: { id: string; slug: string; nome: string; concelho: string; concelho_slug: string; distrito: string; tipo_recorrencia: string }[] | null;
};

type CriticaRecebida = {
  id: string;
  festa_id: string;
  autor_nome: string | null;
  nota: number;
  texto: string;
  created_at: string;
};

const PAPEIS: Record<string, string> = { membro: "Membro", organizador: "Organizador", admin: "Administrador" };
const ESTADOS_EVENTO: Record<EventoCriado["estado"], { texto: string; classe: string }> = {
  confirmada: { texto: "Publicado", classe: "bg-[#20856D]/10 text-[#15705c]" },
  pendente: { texto: "Em revisão", classe: "bg-[#F97B16]/10 text-[#bb5000]" },
  provisoria: { texto: "Provisório", classe: "bg-[#1A2E4F]/[0.07] text-[#1A2E4F]/70" },
  cancelada: { texto: "Cancelado", classe: "bg-[#EC2456]/10 text-[#b41e47]" },
};

function iniciais(nome: string | null, email: string | null) {
  const base = (nome ?? email ?? "?").trim();
  const partes = base.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
}

function Icone({ tipo }: { tipo: "calendario" | "marcador" | "check" | "bookmark" | "mais" }) {
  const comum = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tipo === "calendario") return <svg {...comum}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>;
  if (tipo === "marcador") return <svg {...comum}><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg>;
  if (tipo === "bookmark") return <svg {...comum}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
  if (tipo === "mais") return <svg {...comum}><path d="M12 5v14M5 12h14" /></svg>;
  return <svg {...comum}><path d="m5 12 4 4L19 6" /></svg>;
}

function ImagemEvento({ src }: { src: string | null }) {
  if (!src) return <div className="flex size-full items-center justify-center bg-gradient-to-br from-[#F97B16] to-[#EC2456]"><Icone tipo="calendario" /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" />;
}

export default async function PaginaPerfil() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: perfil } = await supabase.from("perfis").select("nome,email,avatar_url,papel,notificacoes_eventos,notificacoes_criticas").eq("id", user.id).single();
  const nome = perfil?.nome ?? (user.user_metadata?.full_name as string) ?? null;
  const email = perfil?.email ?? user.email ?? null;
  const avatarUrl = perfil?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null;
  const papel = (perfil?.papel as string) ?? "membro";
  const verificado = papel === "organizador" || papel === "admin";

  const [{ data: favoritos }, { data: pedidos }, { data: edicoes }] = await Promise.all([
    supabase.from("favoritos").select("festa_id,created_at").eq("user_id", user.id),
    supabase.from("pedidos_organizador").select("id,nome_entidade,estado,nota_admin,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("edicoes").select("id,ano,data_inicio,data_fim,dias_semana,estado,cartaz_url,created_at,nota_moderacao,festa:festas(id,slug,nome,concelho,concelho_slug,distrito,tipo_recorrencia)").eq("criado_por", user.id).order("data_inicio", { ascending: false }),
  ]);

  const ids = (favoritos ?? []).map((f) => f.festa_id as string);
  let festas: FestaGuardada[] = [];
  if (ids.length) {
    const { data } = await supabase.from("festas_mapa").select("id,slug,nome,concelho,concelho_slug,distrito,data_inicio,data_fim,cartaz_url,tipo_recorrencia,dias_semana").in("id", ids).order("data_inicio");
    festas = (data ?? []) as FestaGuardada[];
  }

  const pedido = (pedidos?.[0] ?? null) as { id: string; nome_entidade: string; estado: string; nota_admin: string | null; created_at: string } | null;
  const eventosCriados = (edicoes ?? []) as EventoCriado[];
  const eventosPublicados = eventosCriados.filter((evento) => evento.estado === "confirmada").length;
  const festasCriadas = eventosCriados.flatMap((evento) => evento.festa ?? []);
  const idsFestasCriadas = [...new Set(festasCriadas.map((festa) => festa.id))];
  const nomesFestasCriadas = new Map(festasCriadas.map((festa) => [festa.id, festa.nome]));
  let criticasRecebidas: CriticaRecebida[] = [];
  if (idsFestasCriadas.length) {
    const { data } = await supabase
      .from("criticas")
      .select("id,festa_id,autor_nome,nota,texto,created_at")
      .in("festa_id", idsFestasCriadas)
      .order("created_at", { ascending: false })
    criticasRecebidas = (data ?? []) as CriticaRecebida[];
  }
  const criticasPerfil = criticasRecebidas.map((critica) => ({ id: critica.id, autor: critica.autor_nome ?? "Participante", evento: nomesFestasCriadas.get(critica.festa_id) ?? "Evento", nota: critica.nota, texto: critica.texto, criadaEm: critica.created_at }));
  const nomesFestasGuardadas = new Map(festas.map((festa) => [festa.id, festa.nome]));
  const atividade = [
    ...eventosCriados.map((evento) => ({ id: `evento-${evento.id}`, data: evento.created_at, texto: `Submeteste ${evento.festa?.[0]?.nome ?? "um evento"}` })),
    ...(favoritos ?? []).flatMap((favorito) => typeof favorito.created_at === "string" ? [{ id: `guardado-${favorito.festa_id}`, data: favorito.created_at, texto: `Guardaste ${nomesFestasGuardadas.get(favorito.festa_id) ?? "uma festa"}` }] : []),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 4);
  const mediaCriticas = criticasRecebidas.length ? criticasRecebidas.reduce((total, critica) => total + critica.nota, 0) / criticasRecebidas.length : null;
  const hoje = new Date().toISOString().slice(0, 10);
  const proximoEvento = eventosCriados.filter((evento) => evento.estado !== "cancelada" && (evento.data_fim ?? evento.data_inicio) >= hoje).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] ?? null;
  const festaProxima = proximoEvento?.festa?.[0] ?? null;

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-8 sm:pt-10">
        <section className="border-b border-[#1A2E4F]/10 pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-14 shrink-0 rounded-full object-cover ring-1 ring-[#1A2E4F]/10 sm:size-16" />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#F97B16] to-[#EC2456] text-lg font-bold text-white sm:size-16">{iniciais(nome, email)}</span>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-[#102745]">{nome ?? "A minha conta"}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#1A2E4F]/60">{email && <span className="truncate">{email}</span>}<span className="rounded-full bg-[#1A2E4F]/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]/70">{PAPEIS[papel] ?? "Membro"}</span></div>
              </div>
            </div>
            {verificado ? (
              <Link href="/criar-evento" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#EC2456] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d11a47] hover:shadow-md"><Icone tipo="mais" />Criar evento</Link>
            ) : (
              <Link href="#organizador" className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#1A2E4F]/15 px-4 py-2.5 text-sm font-bold text-[#1A2E4F] transition hover:border-[#EC2456]/40 hover:text-[#EC2456]"><Icone tipo="check" />Ser organizador</Link>
            )}
          </div>
          <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"><div className="flex items-baseline gap-1.5"><dd className="text-lg font-bold text-[#102745]">{eventosCriados.length}</dd><dt className="text-[#1A2E4F]/55">Eventos criados</dt></div><span className="hidden h-4 w-px bg-[#1A2E4F]/15 sm:block" /><div className="flex items-baseline gap-1.5"><dd className="text-lg font-bold text-[#102745]">{eventosPublicados}</dd><dt className="text-[#1A2E4F]/55">Publicados</dt></div><span className="hidden h-4 w-px bg-[#1A2E4F]/15 sm:block" /><div className="flex items-baseline gap-1.5"><dd className="text-lg font-bold text-[#102745]">{festas.length}</dd><dt className="text-[#1A2E4F]/55">Festas guardadas</dt></div></dl>
          {proximoEvento && <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#1A2E4F]/8 pt-4 text-sm"><span className="font-semibold text-[#1A2E4F]/60">Próximo evento</span>{festaProxima ? <Link href={`/festas/${festaProxima.concelho_slug}/${festaProxima.slug}`} className="font-bold text-[#102745] transition hover:text-[#EC2456]">{festaProxima.nome}</Link> : <span className="font-bold text-[#102745]">Evento por completar</span>}<span className="text-[#1A2E4F]/55">{formatarDatas(proximoEvento.data_inicio, proximoEvento.data_fim, festaProxima?.tipo_recorrencia, proximoEvento.dias_semana)}</span></div>}
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-7">
            <section id="organizador" className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Organização</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Organizador de eventos</h2></div>{verificado && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#20856D]/10 px-2.5 py-1 text-xs font-bold text-[#15705c]"><Icone tipo="check" />Verificado</span>}</div>
              {verificado && pedido?.estado === "aprovado" ? <AvisoOrganizador userId={user.id} pedidoId={pedido.id} /> : null}
              {pedido?.estado === "pendente" && <EscutaPedidoOrganizador pedidoId={pedido.id} estadoInicial={pedido.estado} />}
              {verificado ? (
                <div className="mt-5 rounded-xl bg-[#1A2E4F]/[0.035] p-4"><p className="text-sm font-semibold text-[#102745]">O teu espaço de organização está ativo.</p><p className="mt-1 text-xs leading-relaxed text-[#1A2E4F]/60">Cria eventos, acompanha o estado de publicação e mantém as informações da tua entidade atualizadas.</p><Link href="/criar-evento" className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[#EC2456] transition hover:text-[#d11a47]"><Icone tipo="mais" />Criar um evento</Link></div>
              ) : pedido?.estado === "pendente" ? (
                <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#F97B16]/25 bg-[#F97B16]/[0.05] p-4"><span className="mt-0.5 text-[#d65c00]"><Icone tipo="calendario" /></span><div><p className="text-sm font-bold text-[#102745]">Pedido em análise</p><p className="mt-1 text-xs leading-relaxed text-[#1A2E4F]/60">O pedido para <span className="font-semibold">{pedido.nome_entidade}</span> foi recebido. Damos-te resposta aqui em breve.</p></div></div>
              ) : pedido?.estado === "rejeitado" ? (
                <div className="mt-5 rounded-xl border border-[#EC2456]/20 bg-[#EC2456]/[0.04] p-4"><p className="text-sm font-bold text-[#102745]">O último pedido não foi aprovado</p><p className="mt-1 text-xs leading-relaxed text-[#1A2E4F]/60">{pedido.nota_admin ? `Nota da equipa: “${pedido.nota_admin}”` : "Podes corrigir os dados e voltar a submeter."}</p><PedidoOrganizador textoBotao="Submeter novo pedido" /></div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-[#1A2E4F]/15 p-5"><p className="text-sm font-semibold text-[#102745]">Representas uma junta, câmara ou comissão de festas?</p><p className="mt-1 max-w-xl text-xs leading-relaxed text-[#1A2E4F]/60">Pede a verificação da tua entidade para criares e gerires eventos no Achafestas.</p><PedidoOrganizador textoBotao="Pedir verificação" /></div>
              )}
            </section>

            {verificado && <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Gestão</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Eventos criados</h2><p className="mt-1 text-sm text-[#1A2E4F]/60">Acompanha as edições submetidas por ti.</p></div><Link href="/criar-evento" className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-[#EC2456] transition hover:text-[#d11a47]"><Icone tipo="mais" />Novo evento</Link></div>
              {eventosCriados.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-[#1A2E4F]/15 px-5 py-9 text-center"><span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-[#EC2456]/10 text-[#EC2456]"><Icone tipo="calendario" /></span><p className="mt-3 text-sm font-semibold text-[#102745]">Ainda não criaste eventos</p><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#1A2E4F]/55">Quando criares um evento, o seu estado e a próxima edição aparecem aqui.</p><Link href="/criar-evento" className="mt-4 inline-flex cursor-pointer rounded-lg bg-[#EC2456] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47]">Criar o primeiro evento</Link></div> : <ul className="mt-5 grid gap-3 sm:grid-cols-2">{eventosCriados.map((evento) => { const estado = ESTADOS_EVENTO[evento.estado] ?? ESTADOS_EVENTO.pendente; const festa = evento.festa?.[0] ?? null; return <li key={evento.id} className="group overflow-hidden rounded-xl ring-1 ring-[#1A2E4F]/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#EC2456]/30"><div className="flex min-h-28"><div className="relative size-28 shrink-0 overflow-hidden"><ImagemEvento src={evento.cartaz_url} /></div><div className="min-w-0 flex-1 p-3"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold text-[#102745]">{festa?.nome ?? "Evento sem nome"}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${estado.classe}`}>{estado.texto}</span></div><p className="mt-1 flex items-center gap-1 truncate text-xs text-[#1A2E4F]/60"><Icone tipo="marcador" />{festa ? `${festa.concelho} · ${festa.distrito}` : "Localização por definir"}</p><p className="mt-2 inline-flex items-center gap-1 rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]"><Icone tipo="calendario" />{formatarDatas(evento.data_inicio, evento.data_fim, festa?.tipo_recorrencia, evento.dias_semana)} · {evento.ano}</p><p className="mt-1.5 text-[11px] text-[#1A2E4F]/50">{evento.estado === "pendente" ? "Em revisão pela equipa" : `Submetido em ${new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(evento.created_at))}`}</p>{evento.estado === "cancelada" && evento.nota_moderacao && <p className="mt-2 rounded-md bg-[#c43d4b]/[0.06] px-2 py-1.5 text-[11px] leading-relaxed text-[#c43d4b]">Motivo: {evento.nota_moderacao}</p>}</div></div><div className="flex items-center gap-3 border-t border-[#1A2E4F]/8 px-3 py-2 text-xs font-bold">{festa && <Link href={`/festas/${festa.concelho_slug}/${festa.slug}`} className="cursor-pointer text-[#1A2E4F]/65 transition hover:text-[#EC2456]">Ver página</Link>}<Link href={`/criar-evento?editar=${evento.id}`} className="cursor-pointer text-[#1A2E4F]/65 transition hover:text-[#EC2456]">Editar</Link><Link href={`/criar-evento?duplicar=${evento.id}`} className="cursor-pointer text-[#EC2456] transition hover:text-[#d11a47]">Duplicar edição</Link><span className="ml-auto"><EstadoEventoOrganizador edicaoId={evento.id} cancelado={evento.estado === "cancelada"} /></span></div></li>; })}</ul>}
            </section>}

            {verificado && <CriticasRecebidas criticas={criticasPerfil} media={mediaCriticas} total={criticasRecebidas.length} />}

            <FestasGuardadasPerfil festas={festas} />

            <DefinicoesPerfil nomeInicial={nome} avatarInicial={avatarUrl} eventosInicial={perfil?.notificacoes_eventos ?? true} criticasInicial={perfil?.notificacoes_criticas ?? true} />

            {atividade.length > 0 && <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Atividade</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Últimos movimentos</h2><ul className="mt-4 divide-y divide-[#1A2E4F]/8">{atividade.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><p className="min-w-0 truncate text-sm font-medium text-[#1A2E4F]/75">{item.texto}</p><time dateTime={item.data} className="shrink-0 text-[11px] text-[#1A2E4F]/45">{new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(new Date(item.data))}</time></li>)}</ul></section>}
          </div>

          <aside className="h-fit rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm lg:sticky lg:top-5"><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Antes de publicar</p><h2 className="mt-1 text-lg font-bold text-[#102745]">Uma boa ficha de evento</h2><ul className="mt-5 space-y-4 text-sm text-[#1A2E4F]/70"><li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EC2456]/10 text-[#EC2456]"><Icone tipo="calendario" /></span><span><strong className="block text-[#102745]">Datas e programa</strong><span className="text-xs">Indica os dias e os momentos principais.</span></span></li><li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#20856D]/10 text-[#20856D]"><Icone tipo="marcador" /></span><span><strong className="block text-[#102745]">Localização útil</strong><span className="text-xs">Acrescenta estacionamento, entradas e palcos.</span></span></li><li className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#F97B16]/10 text-[#d65c00]"><Icone tipo="check" /></span><span><strong className="block text-[#102745]">Recorrência</strong><span className="text-xs">Escolhe se é um evento anual ou uma edição única.</span></span></li></ul>{verificado && <Link href="/criar-evento" className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#EC2456] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47]"><Icone tipo="mais" />Criar evento</Link>}</aside>
        </div>
      </main>
    </div>
  );
}
