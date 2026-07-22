/**
 * Quem deve receber um aviso por email — e quem optou por não receber.
 * Devolve null se o perfil não existe, não tem email ou desligou as
 * notificações de eventos no perfil.
 */
export async function perfilNotificavel(url: string, serviceKey: string, userId: string | null | undefined) {
  if (!userId) return null;
  try {
    const resposta = await fetch(
      `${url}/rest/v1/perfis?id=eq.${encodeURIComponent(userId)}&select=nome,email,notificacoes_eventos`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
    );
    if (!resposta.ok) return null;
    const linhas = await resposta.json();
    const perfil = linhas?.[0];
    if (!perfil?.email || perfil.notificacoes_eventos === false) return null;
    return { nome: perfil.nome as string | null, email: perfil.email as string };
  } catch {
    return null;
  }
}
