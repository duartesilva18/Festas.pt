"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIPOS = [
  ["junta_freguesia", "Junta de freguesia"],
  ["camara_municipal", "Câmara municipal"],
  ["comissao_festas", "Comissão de festas"],
  ["associacao", "Associação"],
  ["outro", "Outro"],
] as const;

const CAMPO =
  "mt-1.5 w-full rounded-lg border border-[#1A2E4F]/15 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#EC2456]";
const ETIQUETA = "mt-3 block text-xs font-semibold text-[#1A2E4F]/75";

export default function PedidoOrganizador({ textoBotao }: { textoBotao: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nomeEntidade, setNomeEntidade] = useState("");
  const [tipoEntidade, setTipoEntidade] = useState<string>("junta_freguesia");
  const [concelho, setConcelho] = useState("");
  const [contacto, setContacto] = useState("");
  const [link, setLink] = useState("");
  const [justificacao, setJustificacao] = useState("");
  const [website, setWebsite] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [inicioFormulario] = useState(() => Date.now());

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");
    if (justificacao.trim().length < 20) {
      setErro("Explica em pelo menos 20 caracteres porque representas esta entidade.");
      return;
    }
    setAEnviar(true);
    try {
      const resposta = await fetch("/api/organizador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeEntidade,
          tipoEntidade,
          concelho,
          contacto,
          link,
          justificacao,
          website,
          tempoPreenchimento: Date.now() - inicioFormulario,
        }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(dados?.error ?? "Não foi possível enviar o pedido.");
      setEnviado(true);
      setTimeout(() => router.refresh(), 1500);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível enviar o pedido.");
    } finally {
      setAEnviar(false);
    }
  };

  if (enviado) {
    return (
      <div role="status" className="mt-3 flex items-center gap-2 rounded-lg border border-[#20856D]/20 bg-[#20856D]/[0.05] px-3 py-2.5 text-xs text-[#1A2E4F]/70">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#20856D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        Pedido enviado — vamos analisá-lo e recebes a resposta no teu perfil.
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 rounded-full bg-[#EC2456] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d11a47]"
      >
        {textoBotao}
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-4 rounded-xl border border-[#EC2456]/20 bg-[#fff8fa] p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#102745]">Pedido de verificação</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[#1A2E4F]/60">
            Diz-nos que entidade representas. Analisamos cada pedido manualmente.
          </p>
        </div>
        <button type="button" onClick={() => setAberto(false)} className="text-xs font-bold text-[#1A2E4F]/55 hover:text-[#EC2456]">Cancelar</button>
      </div>

      <label className={`${ETIQUETA} mt-4`}>Nome da entidade
        <input value={nomeEntidade} onChange={(e) => setNomeEntidade(e.target.value)} required minLength={2} maxLength={120} placeholder="Ex.: Junta de Freguesia de…" className={CAMPO} />
      </label>

      <label className={ETIQUETA}>Tipo de entidade
        <select value={tipoEntidade} onChange={(e) => setTipoEntidade(e.target.value)} className={CAMPO}>
          {TIPOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ETIQUETA}>Concelho
          <input value={concelho} onChange={(e) => setConcelho(e.target.value)} required minLength={2} maxLength={80} placeholder="Ex.: Ponte de Lima" className={CAMPO} />
        </label>
        <label className={ETIQUETA}>Contacto institucional
          <input value={contacto} onChange={(e) => setContacto(e.target.value)} required minLength={5} maxLength={120} placeholder="Email ou telefone oficial" className={CAMPO} />
        </label>
      </div>

      <label className={ETIQUETA}>Link comprovativo <span className="font-normal text-[#1A2E4F]/45">(opcional)</span>
        <input value={link} onChange={(e) => setLink(e.target.value)} type="url" maxLength={300} placeholder="Site oficial ou página de Facebook" className={CAMPO} />
      </label>

      <label className={ETIQUETA}>Porque deves ser verificado?
        <textarea value={justificacao} onChange={(e) => setJustificacao(e.target.value)} required maxLength={1000} placeholder="Ex.: Organizamos as festas de… todos os anos e queremos publicá-las na plataforma." className="mt-1.5 min-h-24 w-full resize-none rounded-lg border border-[#1A2E4F]/15 bg-white p-3 text-sm font-normal outline-none transition focus:border-[#EC2456]" />
      </label>
      <div className="mt-1 flex justify-between text-[11px] text-[#1A2E4F]/45">
        <span>Mínimo de 20 caracteres</span>
        <span>{justificacao.length}/1000</span>
      </div>

      <input name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {erro && <p role="alert" className="mt-3 text-xs font-semibold text-[#c43d4b]">{erro}</p>}

      <button type="submit" disabled={aEnviar} className="mt-4 w-full rounded-lg bg-[#EC2456] py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47] disabled:cursor-wait disabled:opacity-60">
        {aEnviar ? "A enviar…" : "Enviar pedido"}
      </button>
    </form>
  );
}
