// Defesa extra contra CSRF: confirma que o pedido veio do próprio site.
// Pedidos de escrita legítimos (fetch same-origin) enviam sempre o header Origin.
export function origemValida(req: Request) {
  const origem = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origem || !host) return false;
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}
