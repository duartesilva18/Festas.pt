"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DefinicoesPerfil({ nomeInicial, avatarInicial, eventosInicial, criticasInicial }: { nomeInicial: string | null; avatarInicial: string | null; eventosInicial: boolean; criticasInicial: boolean }) {
  const { utilizador } = useAuth();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(nomeInicial ?? "");
  const [avatar, setAvatar] = useState(avatarInicial ?? "");
  const [eventos, setEventos] = useState(eventosInicial);
  const [criticas, setCriticas] = useState(criticasInicial);
  const [estado, setEstado] = useState<"parado" | "aGuardar" | "erro" | "guardado">("parado");

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!utilizador) return;
    const nomeLimpo = nome.trim();
    const avatarLimpo = avatar.trim();
    if (nomeLimpo.length < 2 || nomeLimpo.length > 80) { setEstado("erro"); return; }
    if (avatarLimpo && !/^https?:\/\//i.test(avatarLimpo)) { setEstado("erro"); return; }
    setEstado("aGuardar");
    const { error } = await supabase.from("perfis").update({ nome: nomeLimpo, avatar_url: avatarLimpo || null, notificacoes_eventos: eventos, notificacoes_criticas: criticas }).eq("id", utilizador.id);
    if (error) { setEstado("erro"); return; }
    setEstado("guardado");
    router.refresh();
  };

  return <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Conta</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Dados e notificações</h2></div><button type="button" onClick={() => setAberto((valor) => !valor)} aria-expanded={aberto} className="cursor-pointer text-sm font-bold text-[#EC2456] transition hover:text-[#d11a47]">{aberto ? "Fechar" : "Editar"}</button></div>{aberto && <form onSubmit={guardar} className="mt-5 border-t border-[#1A2E4F]/8 pt-5"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-[#1A2E4F]/70">Nome<input value={nome} onChange={(event) => setNome(event.target.value)} minLength={2} maxLength={80} required className="mt-1.5 w-full rounded-lg border border-[#1A2E4F]/15 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#EC2456]" /></label><label className="text-xs font-bold text-[#1A2E4F]/70">Foto (ligação)<input value={avatar} onChange={(event) => setAvatar(event.target.value)} type="url" maxLength={500} placeholder="https://…" className="mt-1.5 w-full rounded-lg border border-[#1A2E4F]/15 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#EC2456]" /></label></div><div className="mt-5 space-y-3"><p className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45">Notificações</p><label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-[#1A2E4F]/[0.035] px-3 py-3 text-sm"><span><strong className="block text-[#102745]">Atualizações de eventos guardados</strong><span className="text-xs text-[#1A2E4F]/55">Alterações de data ou estado.</span></span><input type="checkbox" checked={eventos} onChange={(event) => setEventos(event.target.checked)} className="size-4 accent-[#EC2456]" /></label><label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-[#1A2E4F]/[0.035] px-3 py-3 text-sm"><span><strong className="block text-[#102745]">Críticas dos meus eventos</strong><span className="text-xs text-[#1A2E4F]/55">Avisos para novas críticas públicas.</span></span><input type="checkbox" checked={criticas} onChange={(event) => setCriticas(event.target.checked)} className="size-4 accent-[#EC2456]" /></label></div>{estado === "erro" && <p role="alert" className="mt-3 text-xs font-semibold text-[#b41e47]">Confirma o nome e usa uma ligação válida para a foto.</p>}{estado === "guardado" && <p role="status" className="mt-3 text-xs font-semibold text-[#20856D]">Alterações guardadas.</p>}<button type="submit" disabled={estado === "aGuardar"} className="mt-5 cursor-pointer rounded-lg bg-[#EC2456] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47] disabled:cursor-wait disabled:opacity-60">{estado === "aGuardar" ? "A guardar…" : "Guardar alterações"}</button></form>}</section>;
}
