/**
 * Envio de email transacional (Resend, via REST — sem dependência nova).
 *
 * Sem RESEND_API_KEY configurada não envia nada e não rebenta: o site continua
 * a funcionar, apenas sem avisos. Nunca deixar uma falha de email quebrar a
 * moderação, que é a operação importante.
 */

const REMETENTE = process.env.EMAIL_REMETENTE ?? "Achafestas <avisos@achafestas.com>";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://achafestas.com";

type Destinatario = { email: string | null; nome: string | null };

function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function enviar(para: string, assunto: string, corpoHtml: string, corpoTexto: string) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return false;
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMETENTE, to: [para], subject: assunto, html: corpoHtml, text: corpoTexto }),
      cache: "no-store",
    });
    return resposta.ok;
  } catch {
    return false;
  }
}

function moldura(titulo: string, paragrafos: string[], acao?: { texto: string; href: string }) {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1A2E4F">${p}</p>`).join("");
  const botao = acao
    ? `<a href="${acao.href}" style="display:inline-block;margin-top:6px;background:#EC2456;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:6px">${acao.texto}</a>`
    : "";
  return `<!doctype html><html lang="pt"><body style="margin:0;background:#f6f7f9;padding:28px 14px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid rgba(26,46,79,.10);border-radius:8px" cellpadding="0" cellspacing="0">
<tr><td style="padding:22px 26px 0"><span style="font-size:13px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#EC2456">Achafestas</span></td></tr>
<tr><td style="padding:10px 26px 26px">
<h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#102745">${titulo}</h1>
${corpo}${botao}
</td></tr></table>
<p style="max-width:520px;margin:14px auto 0;font-size:11px;line-height:1.6;color:rgba(26,46,79,.5);text-align:center">
Recebes este aviso porque tens eventos no Achafestas. Podes desligar as notificações no teu perfil.</p>
</td></tr></table></body></html>`;
}

/** Um evento foi aprovado e está publicado no mapa. */
export function emailEventoAprovado(para: Destinatario, nomeEvento: string, href: string) {
  if (!para.email) return Promise.resolve(false);
  const nome = escaparHtml(nomeEvento);
  const link = `${BASE}${href}`;
  return enviar(
    para.email,
    `“${nomeEvento}” já está publicado`,
    moldura("O teu evento foi aprovado", [
      `Olá${para.nome ? ` ${escaparHtml(para.nome.split(" ")[0])}` : ""},`,
      `<strong>${nome}</strong> foi revisto pela nossa equipa e já aparece no mapa do Achafestas.`,
      "Podes editar a informação a qualquer momento — as correções ficam visíveis de imediato.",
    ], { texto: "Ver o evento", href: link }),
    `O teu evento "${nomeEvento}" foi aprovado e já está publicado: ${link}`,
  );
}

/** Um evento foi rejeitado, com o motivo dado pela moderação. */
export function emailEventoRejeitado(para: Destinatario, nomeEvento: string, motivo: string | null) {
  if (!para.email) return Promise.resolve(false);
  const nome = escaparHtml(nomeEvento);
  return enviar(
    para.email,
    `“${nomeEvento}” não foi aprovado`,
    moldura("O teu evento não foi aprovado", [
      `Olá${para.nome ? ` ${escaparHtml(para.nome.split(" ")[0])}` : ""},`,
      `Revimos <strong>${nome}</strong> e não o conseguimos publicar como está.`,
      motivo ? `<strong>Motivo:</strong> ${escaparHtml(motivo)}` : "Confirma se a informação está completa e correta.",
      "Podes corrigir os dados e voltar a submeter — não é preciso começar do zero.",
    ], { texto: "Rever o evento", href: `${BASE}/perfil` }),
    `O teu evento "${nomeEvento}" não foi aprovado.${motivo ? ` Motivo: ${motivo}` : ""} Corrige em ${BASE}/perfil`,
  );
}

/** Um evento foi cancelado por outra pessoa (moderação). */
export function emailEventoCancelado(para: Destinatario, nomeEvento: string) {
  if (!para.email) return Promise.resolve(false);
  const nome = escaparHtml(nomeEvento);
  return enviar(
    para.email,
    `“${nomeEvento}” foi cancelado`,
    moldura("O teu evento foi cancelado", [
      `Olá${para.nome ? ` ${escaparHtml(para.nome.split(" ")[0])}` : ""},`,
      `<strong>${nome}</strong> foi cancelado pela nossa equipa e deixou de aparecer no mapa.`,
      "Se achas que foi um engano, responde a este email e resolvemos.",
    ], { texto: "Ver os meus eventos", href: `${BASE}/perfil` }),
    `O teu evento "${nomeEvento}" foi cancelado e deixou de aparecer no mapa.`,
  );
}
