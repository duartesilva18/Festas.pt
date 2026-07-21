import { type NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  matcher: [
    // Tudo exceto estáticos, imagens e o favicon.
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|logo-mark.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
