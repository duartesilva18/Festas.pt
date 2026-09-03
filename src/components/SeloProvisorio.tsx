/**
 * Marca uma edição cujas datas ainda não foram confirmadas.
 *
 * O rollover anual cria as edições do ano seguinte a partir da anterior, para a
 * festa não desaparecer do mapa. As datas são uma estimativa até o organizador
 * ou o admin as validar — e quem visita tem de o saber antes de meter-se ao
 * caminho. Contorno tracejado, como manda o DESIGN.md para 'provisoria'.
 */
export default function SeloProvisorio({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-dashed border-[#8B93A7]/70 bg-[#8B93A7]/[0.07] px-2 py-0.5 text-[11px] font-bold text-[#1A2E4F]/70 ${className ?? ""}`}
      title="Datas estimadas a partir da edição anterior. Confirma junto da organização."
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      Datas por confirmar
    </span>
  );
}
