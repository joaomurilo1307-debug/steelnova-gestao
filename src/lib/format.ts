export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBRLCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return formatBRL(value);
}

const STATUS_LABEL: Record<string, string> = {
  PLANEJAMENTO: "Planejamento",
  EM_ANDAMENTO: "Em andamento",
  PAUSADA: "Pausada",
  CONCLUIDA: "Concluída",
};

export function obraStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

// Período do contrato de uma Proposta: se já virou Obra, o período REAL vem do Planejamento
// da Obra; antes disso, mostra a estimativa lançada na proposta (dataInicioPrevista +
// prazoDiasContrato).
export function periodoContratoLabel(p: {
  obra?: { dataInicio: string; prazoPrevistoDias: number } | null;
  dataInicioPrevista?: string | null;
  prazoDiasContrato?: number | null;
}): string {
  if (p.obra?.dataInicio && p.obra?.prazoPrevistoDias) {
    const ini = new Date(p.obra.dataInicio);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + p.obra.prazoPrevistoDias);
    return `${ini.toLocaleDateString("pt-BR", { timeZone: "UTC" })} – ${fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;
  }
  if (p.dataInicioPrevista && p.prazoDiasContrato) {
    const ini = new Date(p.dataInicioPrevista);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + p.prazoDiasContrato);
    return `${ini.toLocaleDateString("pt-BR", { timeZone: "UTC" })} – ${fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })} (estimado)`;
  }
  return "—";
}
