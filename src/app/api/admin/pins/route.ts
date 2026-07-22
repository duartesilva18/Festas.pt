import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validarAdmin } from "@/lib/admin";
import { origemValida } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPOS = new Set(["festa_a_decorrer", "festa_em_breve", "festa_mais_tarde", "grupo_festas", "estacionamento", "entrada_principal", "casas_banho", "palco_after"]);
const NOMES: Record<string, string> = {
  festa_a_decorrer: "Festa a decorrer", festa_em_breve: "Festa em breve", festa_mais_tarde: "Festa mais tarde", grupo_festas: "Grupo de festas",
  estacionamento: "Estacionamento", entrada_principal: "Entrada principal", casas_banho: "Casas de banho", palco_after: "Palco / After",
};
const FORMATOS: Record<string, { extensao: string; assinatura: number[] }> = {
  "image/png": { extensao: "png", assinatura: [137, 80, 78, 71] },
  "image/jpeg": { extensao: "jpg", assinatura: [255, 216, 255] },
  "image/webp": { extensao: "webp", assinatura: [82, 73, 70, 70] },
};
const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const DIMENSAO_MAXIMA = 4096;
const PIXEIS_MAXIMOS = 12_000_000;
const JANELA_LIMITADOR_MS = 60_000;
const MAX_UPLOADS_JANELA = 8;
const tentativas = new Map<string, { inicio: number; total: number }>();

function clienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
}

function podeCarregar(userId: string) {
  const agora = Date.now();
  const atual = tentativas.get(userId);
  if (!atual || agora - atual.inicio >= JANELA_LIMITADOR_MS) {
    tentativas.set(userId, { inicio: agora, total: 1 });
    return true;
  }
  if (atual.total >= MAX_UPLOADS_JANELA) return false;
  atual.total += 1;
  return true;
}

function dimensoesImagem(tipo: string, bytes: Uint8Array): { largura: number; altura: number } | null {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (tipo === "image/png" && bytes.length >= 24) return { largura: vista.getUint32(16), altura: vista.getUint32(20) };
  if (tipo === "image/jpeg") {
    for (let indice = 2; indice + 9 < bytes.length;) {
      if (bytes[indice] !== 0xff) { indice += 1; continue; }
      const marcador = bytes[indice + 1];
      indice += 2;
      if (marcador === 0xd8 || marcador === 0xd9 || (marcador >= 0xd0 && marcador <= 0xd7)) continue;
      if (indice + 2 > bytes.length) return null;
      const tamanho = vista.getUint16(indice);
      if (tamanho < 7 || indice + tamanho > bytes.length) return null;
      if (marcador >= 0xc0 && marcador <= 0xc3) return { largura: vista.getUint16(indice + 5), altura: vista.getUint16(indice + 3) };
      indice += tamanho;
    }
  }
  if (tipo === "image/webp" && bytes.length >= 30 && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const subtipo = String.fromCharCode(...bytes.slice(12, 16));
    if (subtipo === "VP8X") return { largura: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), altura: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (subtipo === "VP8 ") return { largura: vista.getUint16(26, true) & 0x3fff, altura: vista.getUint16(28, true) & 0x3fff };
    if (subtipo === "VP8L" && bytes[20] === 0x2f) {
      const bits = vista.getUint32(21, true);
      return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

function respostaJson(corpo: object, estado = 200) {
  return NextResponse.json(corpo, { status: estado, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function GET() {
  const admin = await validarAdmin();
  if (!admin) return respostaJson({ error: "Sem permissões." }, 403);
  const supabase = clienteServidor();
  if (!supabase) return respostaJson({ error: "Configuração indisponível." }, 503);
  const { data, error } = await supabase.from("mapa_pins").select("tipo,nome,imagem_url,atualizado_em").order("tipo");
  if (error) return respostaJson({ error: "Não foi possível carregar os pins." }, 502);
  return respostaJson({ pins: data ?? [] });
}

export async function POST(req: Request) {
  const tamanhoPedido = Number(req.headers.get("content-length") ?? 0);
  const contentType = req.headers.get("content-type") ?? "";
  if (!origemValida(req) || !contentType.startsWith("multipart/form-data") || (Number.isFinite(tamanhoPedido) && tamanhoPedido > TAMANHO_MAXIMO + 32_768)) return respostaJson({ error: "Pedido inválido." }, 400);
  const admin = await validarAdmin();
  if (!admin) return respostaJson({ error: "Sem permissões." }, 403);
  if (!podeCarregar(admin.id)) return respostaJson({ error: "Aguarda um minuto antes de voltares a carregar imagens." }, 429);
  const supabase = clienteServidor();
  if (!supabase) return respostaJson({ error: "Configuração indisponível." }, 503);

  let formulario: FormData;
  try { formulario = await req.formData(); } catch { return respostaJson({ error: "Ficheiro inválido." }, 400); }
  const tipo = formulario.get("tipo");
  const ficheiro = formulario.get("ficheiro");
  if (typeof tipo !== "string" || !TIPOS.has(tipo) || !(ficheiro instanceof File) || ficheiro.size === 0 || ficheiro.size > TAMANHO_MAXIMO) {
    return respostaJson({ error: "Usa uma imagem válida até 2 MB." }, 400);
  }
  const formato = FORMATOS[ficheiro.type];
  const bytes = new Uint8Array(await ficheiro.arrayBuffer());
  if (!formato || !formato.assinatura.every((valor, indice) => bytes[indice] === valor)) {
    return respostaJson({ error: "Só são aceites PNG, JPG ou WebP válidos." }, 400);
  }
  const dimensoes = dimensoesImagem(ficheiro.type, bytes);
  if (!dimensoes || dimensoes.largura < 16 || dimensoes.altura < 16 || dimensoes.largura > DIMENSAO_MAXIMA || dimensoes.altura > DIMENSAO_MAXIMA || dimensoes.largura * dimensoes.altura > PIXEIS_MAXIMOS) return respostaJson({ error: "A imagem deve ter entre 16 px e 4096 px por lado." }, 400);

  const { data: anterior } = await supabase.from("mapa_pins").select("imagem_url").eq("tipo", tipo).maybeSingle();
  const caminho = `pins/${tipo}-${crypto.randomUUID()}.${formato.extensao}`;
  const { error: erroUpload } = await supabase.storage.from("mapa-pins").upload(caminho, bytes, { contentType: ficheiro.type, cacheControl: "31536000", upsert: false });
  if (erroUpload) return respostaJson({ error: "Não foi possível carregar a imagem." }, 502);

  const { data: publico } = supabase.storage.from("mapa-pins").getPublicUrl(caminho);
  const imagemUrl = publico.publicUrl;
  const { data: pin, error: erroPin } = await supabase.from("mapa_pins").upsert({ tipo, nome: NOMES[tipo], imagem_url: imagemUrl, atualizado_em: new Date().toISOString(), atualizado_por: admin.id }, { onConflict: "tipo" }).select("tipo,nome,imagem_url,atualizado_em").single();
  if (erroPin) {
    await supabase.storage.from("mapa-pins").remove([caminho]);
    return respostaJson({ error: "Não foi possível associar a imagem ao pin." }, 502);
  }

  const anteriorUrl = anterior?.imagem_url;
  const marcador = "/storage/v1/object/public/mapa-pins/";
  if (anteriorUrl?.includes(marcador)) {
    const antigo = anteriorUrl.split(marcador)[1]?.split("?")[0];
    if (antigo) await supabase.storage.from("mapa-pins").remove([antigo]);
  }
  return respostaJson({ pin });
}
