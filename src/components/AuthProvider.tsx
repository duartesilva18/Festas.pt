"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

export type Utilizador = {
  id: string;
  nome: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type AuthContexto = {
  utilizador: Utilizador | null;
  aCarregar: boolean;
  papel: string | null;
  favoritos: Set<string>;
  guardado: (festaId: string) => boolean;
  alternar: (festaId: string) => void;
  entrarComGoogle: () => void;
  terminarSessao: () => Promise<void>;
  pedirLogin: () => void;
};

const Contexto = createContext<AuthContexto | null>(null);

function paraUtilizador(user: User | null): Utilizador | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    nome: (meta.full_name as string) ?? (meta.name as string) ?? null,
    email: user.email ?? null,
    avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  const [papel, setPapel] = useState<string | null>(null);
  const [promptAberto, setPromptAberto] = useState(false);

  useEffect(() => {
    if (!promptAberto) return;
    const aoTecla = (e: KeyboardEvent) => { if (e.key === "Escape") setPromptAberto(false); };
    document.addEventListener("keydown", aoTecla);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", aoTecla); document.body.style.overflow = ""; };
  }, [promptAberto]);

  const carregarFavoritos = useCallback(
    async (id: string | null) => {
      if (!id) {
        setFavoritos(new Set());
        return;
      }
      const { data } = await supabase.from("favoritos").select("festa_id").eq("user_id", id);
      const linhas = (data ?? []) as { festa_id: string }[];
      setFavoritos(new Set(linhas.map((linha) => linha.festa_id)));
    },
    [supabase],
  );

  const carregarPapel = useCallback(
    async (id: string | null) => {
      if (!id) {
        setPapel(null);
        return;
      }
      const { data } = await supabase.from("perfis").select("papel").eq("id", id).single();
      setPapel((data as { papel: string } | null)?.papel ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = paraUtilizador(data.user);
      setUtilizador(u);
      setACarregar(false);
      void carregarFavoritos(u?.id ?? null);
      void carregarPapel(u?.id ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      const u = paraUtilizador(sessao?.user ?? null);
      setUtilizador(u);
      void carregarFavoritos(u?.id ?? null);
      void carregarPapel(u?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, carregarFavoritos, carregarPapel]);

  const entrarComGoogle = useCallback(() => {
    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Mostra sempre o seletor de contas em vez de entrar com a última usada.
        queryParams: { prompt: "select_account" },
      },
    });
  }, [supabase]);

  const terminarSessao = useCallback(async () => {
    await supabase.auth.signOut();
    setUtilizador(null);
    setFavoritos(new Set());
    setPapel(null);
  }, [supabase]);

  const pedirLogin = useCallback(() => setPromptAberto(true), []);

  const guardado = useCallback((festaId: string) => favoritos.has(festaId), [favoritos]);

  const alternar = useCallback(
    (festaId: string) => {
      const u = utilizador;
      if (!u) {
        setPromptAberto(true);
        return;
      }
      const jaGuardado = favoritos.has(festaId);
      // Atualização otimista.
      setFavoritos((atual) => {
        const proximo = new Set(atual);
        if (jaGuardado) proximo.delete(festaId);
        else proximo.add(festaId);
        return proximo;
      });
      const operacao = jaGuardado
        ? supabase.from("favoritos").delete().eq("user_id", u.id).eq("festa_id", festaId)
        : supabase.from("favoritos").insert({ user_id: u.id, festa_id: festaId });
      void operacao.then(({ error }) => {
        if (error) void carregarFavoritos(u.id); // reverte para o estado real
      });
    },
    [utilizador, favoritos, supabase, carregarFavoritos],
  );

  return (
    <Contexto.Provider
      value={{
        utilizador,
        aCarregar,
        papel,
        favoritos,
        guardado,
        alternar,
        entrarComGoogle,
        terminarSessao,
        pedirLogin,
      }}
    >
      {children}
      {promptAberto && (
        <div
          onClick={() => setPromptAberto(false)}
          className="lightbox-fade fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex flex-col items-center px-6 pb-6 pt-7 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-b from-[#F97B16] to-[#EC2456] text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
              </span>
              <h2 className="mt-4 text-lg font-bold text-[#102745]">Guarda as tuas festas</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#1A2E4F]/65">
                Entra com a Google para guardar festas e encontrá-las mais tarde, em qualquer dispositivo.
              </p>
              <button
                type="button"
                onClick={entrarComGoogle}
                className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#1A2E4F]/15 bg-white py-2.5 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/[0.03]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
                Continuar com a Google
              </button>
              <button type="button" onClick={() => setPromptAberto(false)} className="mt-2.5 py-1 text-xs font-semibold text-[#1A2E4F]/50 transition hover:text-[#1A2E4F]">
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexto.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAuth precisa de estar dentro de <AuthProvider>");
  return ctx;
}
