import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { origemValida } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORMATOS: Record<string, { extensao: string; assinatura: number[] }> = {
  "image/png": { extensao: "png", assinatura: [137, 80, 78, 71] },
  "image/jpeg": { extensao: "jpg", assinatura: [255, 216, 255] },
  "image/webp": { extensao: "webp", assinatura: [82, 73, 70, 70] },
};
const MAXIMO = 8 * 1024 * 1024;
const MAXIMO_DIMENSAO = 8192;
const MAXIMO_PIXEIS = 32_000_000;
const tentativas = new Map<string, { inicio: number; total: number }>();

function resposta(corpo: object, status = 200) {
  return NextResponse.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

function clienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
}

function dentroDoLimite(userId: string) {
  const agora = Date.now();
  const atual = tentativas.get(userId);
  if (!atual || agora - atual.inicio > 60_000) { tentativas.set(userId, { inicio: agora, total: 1 }); return true; }
  if (atual.total >= 12) return false;
  atual.total += 1;
  return true;
}

function dimensoes(tipo: string, bytes: Uint8Array): { largura: number; altura: number } | null {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (tipo === "image/png" && bytes.length >= 24) return { largura: vista.getUint32(16), altura: vista.getUint32(20) };
  if (tipo === "image/jpeg") {
    for (let indice = 2; indice + 9 < bytes.length;) {
      if (bytes[indice] !== 0xff) { indice += 1; continue; }
      const marcador = bytes[indice + 1]; indice += 2;
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
    if (subtipo === "VP8L" && bytes[20] === 0x2f) { const bits = vista.getUint32(21, true); return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (!origemValida(req) || !contentType.startsWith("multipart/form-data") || (Number.isFinite(tamanho) && tamanho > MAXIMO + 32_768)) return resposta({ error: "Pedido inválido." }, 400);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return resposta({ error: "Inicia sessão para carregar imagens." }, 401);
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") return resposta({ error: "Sem permissões." }, 403);
  if (!dentroDoLimite(user.id)) return resposta({ error: "Fizeste demasiados carregamentos. Aguarda um minuto." }, 429);

  let formulario: FormData;
  try { formulario = await req.formData(); } catch { return resposta({ error: "Ficheiro inválido." }, 400); }
  const tipo = formulario.get("tipo");
  const ficheiro = formulario.get("ficheiro");
  if ((tipo !== "cartaz" && tipo !== "foto") || !(ficheiro instanceof File) || ficheiro.size < 1 || ficheiro.size > MAXIMO) return resposta({ error: "Escolhe uma imagem até 8 MB." }, 400);

  const formato = FORMATOS[ficheiro.type];
  const bytes = new Uint8Array(await ficheiro.arrayBuffer());
  if (!formato || !formato.assinatura.every((valor, indice) => bytes[indice] === valor)) return resposta({ error: "Só são aceites imagens JPG, PNG ou WebP válidas." }, 400);
  const tamanhoImagem = dimensoes(ficheiro.type, bytes);
  if (!tamanhoImagem || tamanhoImagem.largura < 64 || tamanhoImagem.altura < 64 || tamanhoImagem.largura > MAXIMO_DIMENSAO || tamanhoImagem.altura > MAXIMO_DIMENSAO || tamanhoImagem.largura * tamanhoImagem.altura > MAXIMO_PIXEIS) return resposta({ error: "A imagem tem dimensões inválidas." }, 400);

  const admin = clienteServidor();
  if (!admin) return resposta({ error: "O carregamento de imagens não está configurado." }, 503);
  const caminho = `${user.id}/rascunhos/${tipo}-${crypto.randomUUID()}.${formato.extensao}`;
  const { error } = await admin.storage.from("eventos-media").upload(caminho, bytes, { contentType: ficheiro.type, cacheControl: "31536000", upsert: false });
  if (error) return resposta({ error: "Não foi possível guardar a imagem." }, 502);
  const { data } = admin.storage.from("eventos-media").getPublicUrl(caminho);
  return resposta({ url: data.publicUrl, largura: tamanhoImagem.largura, altura: tamanhoImagem.altura }, 201);
}
