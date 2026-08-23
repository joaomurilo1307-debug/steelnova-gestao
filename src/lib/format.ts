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
