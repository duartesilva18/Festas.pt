import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Rollover anual das edições.
 *
 * Sem isto, uma festa anual desaparece do mapa assim que a última edição
 * confirmada passa e nunca mais volta. Corre todos os meses e cria as edições
 * em falta como 'provisoria' — nunca como confirmada: as datas são uma
 * estimativa até o organizador ou o admin as validar.
 *
 * Gera o ano corrente e o seguinte. O ano corrente importa em janeiro, quando
 * uma festa de fevereiro ainda não tem edição criada.
 */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  const autorizacao = req.headers.get("authorization");
  // Em produção o segredo é obrigatório: sem ele a rota fica fechada, em vez de
  // ficar aberta a quem descobrir o caminho.
  if (!segredo || autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Sem permissões." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const anoAtual = new Date().getUTCFullYear();
  const resultados: { ano: number; criadas: number }[] = [];

  for (const ano of [anoAtual, anoAtual + 1]) {
    const resposta = await fetch(`${url}/rest/v1/rpc/gerar_edicoes_anuais`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_ano: ano }),
      cache: "no-store",
    });
    if (!resposta.ok) {
      return NextResponse.json(
        { error: "Falhou a geração de edições.", ano, ja_criadas: resultados },
        { status: 502 },
      );
    }
    const criadas = await resposta.json().catch(() => 0);
    resultados.push({ ano, criadas: typeof criadas === "number" ? criadas : 0 });
  }

  const total = resultados.reduce((soma, item) => soma + item.criadas, 0);
  return NextResponse.json(
    { ok: true, total, resultados },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
