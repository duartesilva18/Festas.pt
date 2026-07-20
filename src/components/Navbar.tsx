import Image from "next/image";
import Link from "next/link";

export default function Navbar({ contagem }: { contagem?: number }) {
  return (
    <header className="z-20 shrink-0 bg-white">
      <div className="flex h-16 items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/logo.svg" alt="Achafestas" width={188} height={40} priority />
        </Link>

        <div className="mx-auto hidden min-w-0 max-w-md flex-1 md:block">
          <div className="flex items-center gap-2.5 rounded-full border border-[#1A2E4F]/15 bg-[#1A2E4F]/[0.03] px-4 py-2 transition focus-within:border-[#EC2456]/50 focus-within:bg-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A2E4F" strokeWidth="2.2" strokeLinecap="round" className="opacity-40">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Procura uma festa, vila ou concelho…"
              className="w-full bg-transparent text-sm text-[#1A2E4F] outline-none placeholder:text-[#1A2E4F]/40"
            />
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          {contagem != null && (
            <span className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#1A2E4F]/70 lg:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EC2456] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[#EC2456]" />
              </span>
              {contagem} festas no mapa
            </span>
          )}
          <Link
            href="/"
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/5 lg:block"
          >
            Mapa
          </Link>
          <span
            className="hidden cursor-not-allowed rounded-full px-3 py-2 text-sm font-medium text-[#1A2E4F]/40 lg:block"
            title="Disponível em breve"
          >
            Submeter festa
          </span>
          <button
            type="button"
            className="ml-1 cursor-not-allowed rounded-full bg-gradient-to-b from-[#F97B16] to-[#EC2456] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
            title="Disponível em breve"
          >
            Entrar
          </button>
        </nav>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-[#F97B16] via-[#EC2456] to-[#1A2E4F]" />
    </header>
  );
}
