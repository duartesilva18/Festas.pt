"use client";

export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f8fa] p-6 text-center text-[#1A2E4F]">
      <section className="max-w-sm rounded-xl bg-white p-7 shadow-xl ring-1 ring-[#1A2E4F]/10">
        <p className="text-sm font-bold text-[#EC2456]">Não foi possível carregar o Achafestas</p>
        <h1 className="mt-2 text-xl font-bold">Tenta novamente dentro de instantes.</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#1A2E4F]/65">Pode ser uma falha temporária de ligação aos dados das festas.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-md bg-[#EC2456] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47]">Tentar novamente</button>
      </section>
    </main>
  );
}
