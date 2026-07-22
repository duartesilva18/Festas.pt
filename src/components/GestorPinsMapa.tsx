"use client";

/* eslint-disable @next/next/no-img-element -- pré-visualizações locais e SVGs data URL não beneficiam do otimizador */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { iconeRecintoSVG, pinFestaSVG, pinGrupoSVG, svgDataUrl } from "@/lib/mapa-pins";

type TipoPin = {
  id: string;
  titulo: string;
  grupo: "Festas" | "No recinto";
  descricao: string;
  cor: string;
};

type PinGuardado = { tipo: string; nome: string; imagem_url: string; atualizado_em: string };

const TIPOS: TipoPin[] = [
  { id: "festa_a_decorrer", titulo: "Festa a decorrer", grupo: "Festas", descricao: "Evento que está a acontecer", cor: "#EC2456" },
  { id: "festa_em_breve", titulo: "Festa em breve", grupo: "Festas", descricao: "Evento nos próximos 7 dias", cor: "#F97B16" },
  { id: "festa_mais_tarde", titulo: "Festa mais tarde", grupo: "Festas", descricao: "Evento futuro", cor: "#8793AA" },
  { id: "grupo_festas", titulo: "Grupo de festas", grupo: "Festas", descricao: "Vários eventos muito próximos", cor: "#EC2456" },
  { id: "estacionamento", titulo: "Estacionamento", grupo: "No recinto", descricao: "Parque ou zona de estacionamento", cor: "#2877BD" },
  { id: "entrada_principal", titulo: "Entrada principal", grupo: "No recinto", descricao: "Entrada no recinto", cor: "#20856D" },
  { id: "casas_banho", titulo: "Casas de banho", grupo: "No recinto", descricao: "WC disponível no recinto", cor: "#208AA0" },
  { id: "palco_after", titulo: "Palco / After", grupo: "No recinto", descricao: "Palco, DJ ou after", cor: "#7546B9" },
];

const ADMIN_PARA_RECINTO: Record<string, string> = {
  estacionamento: "estacionamento",
  entrada_principal: "entrada",
  casas_banho: "wc",
  palco_after: "palco",
};

function IconePadrao({ tipo, tamanho = 48 }: { tipo: TipoPin; tamanho?: number }) {
  if (tipo.id.startsWith("festa_")) {
    return <img src={svgDataUrl(pinFestaSVG(tipo.cor))} alt="" style={{ width: tamanho, height: "auto" }} />;
  }
  if (tipo.id === "grupo_festas") {
    return <span className="relative grid place-items-center" style={{ width: tamanho, height: tamanho }}><img src={svgDataUrl(pinGrupoSVG(tipo.cor))} alt="" className="absolute inset-0 size-full object-contain" /><strong className="relative text-white" style={{ fontSize: Math.max(10, Math.round(tamanho * 0.24)), transform: `translateY(-${Math.round(tamanho * 0.055)}px)` }}>12</strong></span>;
  }
  const tipoRecinto = ADMIN_PARA_RECINTO[tipo.id] ?? "outro";
  const escala = tamanho / 36;
  return <span aria-hidden="true" className="mapa-sublocalizacao pointer-events-none" style={{ "--pin-cor": tipo.cor, transform: `scale(${escala})` } as CSSProperties}><span className="mapa-sublocalizacao-icone" dangerouslySetInnerHTML={{ __html: iconeRecintoSVG(tipoRecinto) }} /></span>;
}

export default function GestorPinsMapa() {
  const [pins, setPins] = useState<Record<string, PinGuardado>>({});
  const [aCarregarPins, setACarregarPins] = useState(true);
  const [selecionado, setSelecionado] = useState(TIPOS[0].id);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tipo = useMemo(() => TIPOS.find((item) => item.id === selecionado) ?? TIPOS[0], [selecionado]);

  useEffect(() => {
    let ativo = true;
    fetch("/api/admin/pins", { cache: "no-store" })
      .then((resposta) => resposta.ok ? resposta.json() : Promise.reject())
      .then((dados: { pins?: PinGuardado[] }) => {
        if (!ativo) return;
        setPins(Object.fromEntries((dados.pins ?? []).map((pin) => [pin.tipo, pin])));
      })
      .catch(() => setMensagem("Não foi possível carregar os pins guardados."))
      .finally(() => { if (ativo) setACarregarPins(false); });
    return () => { ativo = false; };
  }, []);

  const preview = useMemo(() => ficheiro ? URL.createObjectURL(ficheiro) : null, [ficheiro]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function escolherFicheiro(evento: React.ChangeEvent<HTMLInputElement>) {
    const novo = evento.target.files?.[0] ?? null;
    if (!novo) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(novo.type) || novo.size > 2 * 1024 * 1024) {
      setMensagem("Usa PNG, JPG ou WebP até 2 MB.");
      evento.target.value = "";
      return;
    }
    const url = URL.createObjectURL(novo);
    try {
      const dimensoes = await new Promise<{ largura: number; altura: number }>((resolve, reject) => {
        const imagem = new Image();
        imagem.onload = () => resolve({ largura: imagem.naturalWidth, altura: imagem.naturalHeight });
        imagem.onerror = () => reject(new Error());
        imagem.src = url;
      });
      if (dimensoes.largura < 16 || dimensoes.altura < 16 || dimensoes.largura > 4096 || dimensoes.altura > 4096 || dimensoes.largura * dimensoes.altura > 12_000_000) throw new Error();
    } catch {
      URL.revokeObjectURL(url);
      setMensagem("Usa uma imagem válida entre 16 px e 4096 px por lado.");
      evento.target.value = "";
      return;
    }
    URL.revokeObjectURL(url);
    setFicheiro(novo);
    setMensagem(null);
  }

  async function guardar() {
    if (!ficheiro || aGuardar) return;
    setAGuardar(true);
    setMensagem(null);
    const dados = new FormData();
    dados.set("tipo", tipo.id);
    dados.set("ficheiro", ficheiro);
    try {
      const resposta = await fetch("/api/admin/pins", { method: "POST", body: dados });
      const resultado = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(resultado.error || "Não foi possível guardar o pin.");
      setPins((atuais) => ({ ...atuais, [tipo.id]: resultado.pin }));
      setFicheiro(null);
      if (inputRef.current) inputRef.current.value = "";
      setMensagem(`Pin de “${tipo.titulo}” atualizado.`);
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "Não foi possível guardar o pin.");
    } finally { setAGuardar(false); }
  }

  const imagemAtiva = preview ?? pins[tipo.id]?.imagem_url ?? null;

  return (
    <section className="mt-7 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]" aria-busy={aCarregarPins}>
      <div className="rounded-xl border border-[#1A2E4F]/10 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#1A2E4F]/45">Atribuir pin</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {TIPOS.map((item) => {
            const ativo = item.id === tipo.id;
            return <button key={item.id} type="button" aria-pressed={ativo} onClick={() => { setSelecionado(item.id); setFicheiro(null); setMensagem(null); }} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition ${ativo ? "border-[#EC2456]/45 bg-[#EC2456]/[0.045]" : "border-[#1A2E4F]/10 hover:border-[#1A2E4F]/25"}`}>
              {pins[item.id]?.imagem_url ? <img src={pins[item.id].imagem_url} alt="" className="size-10 object-contain" /> : <IconePadrao tipo={item} tamanho={40} />}
              <span className="min-w-0"><span className="block text-sm font-bold text-[#102745]">{item.titulo}</span><span className="block text-xs text-[#1A2E4F]/55">{item.descricao}</span></span>
            </button>;
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#EC2456]">{tipo.grupo}</p><h2 className="mt-1 text-lg font-bold text-[#102745]">{tipo.titulo}</h2><p className="mt-1 text-sm text-[#1A2E4F]/60">{tipo.descricao}</p></div><span className="rounded-full bg-[#1A2E4F]/[0.05] px-2.5 py-1 text-[11px] font-bold text-[#1A2E4F]/60">{pins[tipo.id] ? "Personalizado" : "Predefinido"}</span></div>
        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dashed border-[#1A2E4F]/20 bg-[#1A2E4F]/[0.02] p-4 transition hover:border-[#EC2456]/45 hover:bg-[#EC2456]/[0.025]">
          <span><span className="block text-sm font-bold text-[#102745]">Escolher imagem</span><span className="mt-0.5 block text-xs text-[#1A2E4F]/55">PNG ou WebP transparente recomendado · máximo 2 MB</span></span><span className="rounded-md bg-[#EC2456] px-3 py-2 text-xs font-bold text-white">Carregar</span>
          <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={escolherFicheiro} aria-describedby="requisitos-pin" />
        </label>
        <p id="requisitos-pin" className="sr-only">São aceites ficheiros PNG, JPG e WebP até 2 MB e 4096 píxeis por lado.</p>
        <div className="mt-5 rounded-xl border border-[#1A2E4F]/10 bg-[#DDE9F7] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#1A2E4F]/45">Pré-visualização no mapa</p>
          <div className="mt-4 flex h-36 items-end justify-center rounded-lg bg-[linear-gradient(135deg,rgba(255,255,255,.65)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.65)_50%,rgba(255,255,255,.65)_75%,transparent_75%)] bg-[length:24px_24px] pb-5">
            {imagemAtiva ? <img src={imagemAtiva} alt={`Pré-visualização: ${tipo.titulo}`} className="size-[72px] object-contain drop-shadow-md" /> : <IconePadrao tipo={tipo} tamanho={72} />}
          </div>
          <p className="mt-3 text-center text-[11px] text-[#1A2E4F]/50">Confirma sempre se continua legível em tamanho pequeno.</p>
          <div className="mt-3 flex items-end justify-center gap-8 rounded-lg bg-white/55 px-4 py-3">
            {[32, 40, 48].map((tamanho) => <span key={tamanho} className="flex min-w-12 flex-col items-center gap-2"><span className="flex h-14 items-end justify-center">{imagemAtiva ? <img src={imagemAtiva} alt="" style={{ width: tamanho, height: tamanho }} className="object-contain" /> : <IconePadrao tipo={tipo} tamanho={tamanho} />}</span><span className="text-[10px] font-semibold text-[#1A2E4F]/45">{tamanho}px</span></span>)}
          </div>
        </div>
        {ficheiro && <p className="mt-3 truncate text-xs text-[#1A2E4F]/60">Selecionado: {ficheiro.name}</p>}
        {mensagem && <p role="status" aria-live="polite" className="mt-4 text-sm font-medium text-[#1A2E4F]/75">{mensagem}</p>}
        <button type="button" disabled={!ficheiro || aGuardar} onClick={guardar} className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-md bg-[#EC2456] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#D61D4A] disabled:cursor-not-allowed disabled:opacity-45">{aGuardar ? "A guardar…" : `Aplicar a ${tipo.titulo}`}</button>
      </div>
    </section>
  );
}
