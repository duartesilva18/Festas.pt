import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textoLimpo(valor: unknown, limite: number) {
  if (typeof valor !== "string") return "";
  return valor
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite + 1);
}

function origemValida(req: Request) {
  const origem = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origem || !host) return false;
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

function respostaGenerica() {
  return NextResponse.json({ error: "Não foi possível enviar a crítica. Tenta novamente." }, { status: 400 });
}

export async function GET(req: Request) {
  const festaId = new URL(req.url).searchParams.get("festa");
  if (!festaId || !UUID.test(festaId)) return NextResponse.json({ error: "Festa inválida." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Críticas indisponíveis." }, { status: 503 });

  try {
    const resposta = await fetch(
      `${url}/rest/v1/criticas?festa_id=eq.${encodeURIComponent(festaId)}&estado=eq.aprovada&select=id,autor_nome,nota,texto,created_at&order=created_at.desc&limit=50`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } },
    );
    if (!resposta.ok) throw new Error("SUPABASE_REVIEWS");
    const criticas = await resposta.json();
    return NextResponse.json(Array.isArray(criticas) ? criticas : [], { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Críticas indisponíveis." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(tamanho) || tamanho > 4096 || !origemValida(req)) return respostaGenerica();

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return respostaGenerica();
  }

  // Honeypot: devolve sucesso para não dar feedback útil a bots.
  if (typeof corpo.website === "string" && corpo.website) return NextResponse.json({ ok: true });

  const festaId = typeof corpo.festaId === "string" ? corpo.festaId : "";
  const nome = textoLimpo(corpo.nome, 60);
  const texto = textoLimpo(corpo.texto, 1200);
  const nota = typeof corpo.nota === "number" ? corpo.nota : 0;
  const tempoPreenchimento = typeof corpo.tempoPreenchimento === "number" ? corpo.tempoPreenchimento : 0;
  const pareceHtml = /<\/?[a-z][\s\S]*>/i.test(texto);
  const urls = texto.match(/https?:\/\//gi)?.length ?? 0;
  const repeticaoExcessiva = /(.)\1{14,}/u.test(texto);
  if (
    !UUID.test(festaId) ||
    !Number.isInteger(nota) ||
    nota < 1 ||
    nota > 5 ||
    texto.length < 20 ||
    texto.length > 1200 ||
    (nome.length > 0 && nome.length < 2) ||
    tempoPreenchimento < 1500 ||
    tempoPreenchimento > 2 * 60 * 60 * 1000 ||
    pareceHtml ||
    urls > 2 ||
    repeticaoExcessiva
  ) {
    return NextResponse.json({ error: "Confirma a avaliação e escreve uma crítica válida." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "A publicação de críticas ainda não está configurada." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";
  // IP nunca é guardado: apenas um HMAC impossível de reverter sem a chave de servidor.
  const ipHash = createHmac("sha256", serviceKey).update(ip).digest("hex");

  const resposta = await fetch(`${url}/rest/v1/rpc/submeter_critica`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_festa_id: festaId,
      p_autor_nome: nome || null,
      p_nota: nota,
      p_texto: texto,
      p_ip_hash: ipHash,
    }),
    cache: "no-store",
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    if (detalhe.includes("RATE_LIMIT")) {
      return NextResponse.json({ error: "Já enviaste várias críticas hoje. Tenta novamente amanhã." }, { status: 429 });
    }
    if (detalhe.includes("DUPLICADA")) {
      return NextResponse.json({ error: "Já recebemos esta crítica. Obrigado." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível enviar a crítica. Tenta novamente." }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
