import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabaseServer } from "@/lib/supabase/server";
import { formatarDatas } from "@/lib/festa-ui";

export const metadata: Metadata = { title: "O meu perfil — Achafestas", robots: { index: false } };

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
};

const PAPEIS: Record<string, string> = {
  membro: "Membro",
  organizador: "Organizador",
  admin: "Administrador",
};

function iniciais(nome: string | null, email: string | null) {
  const base = (nome ?? email ?? "?").trim();
  const partes = base.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase() || "?";
}

export default async function PaginaPerfil() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome,email,avatar_url,papel")
    .eq("id", user.id)
    .single();

  const nome = perfil?.nome ?? (user.user_metadata?.full_name as string) ?? null;
  const email = perfil?.email ?? user.email ?? null;
  const avatarUrl = perfil?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null;
  const papel = (perfil?.papel as string) ?? "membro";

  const { data: favoritos } = await supabase.from("favoritos").select("festa_id").eq("user_id", user.id);
  const ids = (favoritos ?? []).map((f) => f.festa_id as string);

  let festas: FestaGuardada[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("festas_mapa")
      .select("id,slug,nome,concelho,concelho_slug,distrito,data_inicio,data_fim,cartaz_url")
      .in("id", ids)
      .order("data_inicio");
    festas = (data ?? []) as FestaGuardada[];
  }

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <Navbar />

      <main className="mx-auto max-w-4xl px-5 pb-20 pt-8">
        <section className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="size-16 shrink-0 rounded-full object-cover ring-1 ring-[#1A2E4F]/10" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#F97B16] to-[#EC2456] text-lg font-bold text-white">
              {iniciais(nome, email)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-[#102745]">{nome ?? "A minha conta"}</h1>
            {email && <p className="truncate text-sm text-[#1A2E4F]/60">{email}</p>}
            <span className="mt-1.5 inline-block rounded-full bg-[#1A2E4F]/[0.06] px-2.5 py-0.5 text-xs font-semibold text-[#1A2E4F]/70">
              {PAPEIS[papel] ?? "Membro"}
            </span>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-[#102745]">Festas guardadas</h2>
          {festas.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#1A2E4F]/15 py-14 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A2E4F" strokeWidth="1.6" strokeLinejoin="round" className="opacity-30"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
              <p className="text-sm font-semibold text-[#1A2E4F]/70">Ainda não guardaste nenhuma festa</p>
              <p className="max-w-xs text-xs text-[#1A2E4F]/50">Carrega em “Guardar” numa festa no mapa e ela aparece aqui.</p>
              <Link href="/" className="mt-2 rounded-full bg-[#EC2456] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#d11a47]">Explorar o mapa</Link>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {festas.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/festas/${f.concelho_slug}/${f.slug}`}
                    className="group flex overflow-hidden rounded-xl ring-1 ring-[#1A2E4F]/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#EC2456]/30"
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden">
                      {f.cartaz_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.cartaz_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-[#F97B16] to-[#EC2456]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 p-3">
                      <p className="truncate text-sm font-bold text-[#102745]">{f.nome}</p>
                      <p className="mt-0.5 truncate text-xs text-[#1A2E4F]/60">{f.concelho} · {f.distrito}</p>
                      <p className="mt-1.5 inline-block rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]">
                        {formatarDatas(f.data_inicio, f.data_fim)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
