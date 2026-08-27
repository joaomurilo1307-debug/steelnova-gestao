import { prisma } from "@/lib/prisma";

function addDias(d: Date, dias: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + dias);
  return n;
}
function isoDia(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type CurvaSData = {
  previsto: { data: string; pct: number }[];
  realizado: { data: string; pct: number; valor: number }[];
  pctPrevistoHoje: number;
  pctRealizadoAtual: number;
  desvio: number;
};

// Curva S: previsto (linha contínua, ponderada por esforço — HH de cada atividade
// distribuído nos dias em que ela roda, conforme o Planejamento) x realizado (pontos =
// medições lançadas, acumuladas). Tudo em % do contrato/prazo.
export async function getCurvaSData(obraId: string): Promise<CurvaSData | null> {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { dataInicio: true, prazoPrevistoDias: true, valorContrato: true },
  });
  if (!obra) return null;

  const [tarefas, medicoes] = await Promise.all([
    prisma.tarefa.findMany({
      where: { obraId, dataInicio: { not: null } },
      select: { dataInicio: true, duracaoDias: true, pessoas: true, horas: true },
    }),
    prisma.medicao.findMany({ where: { obraId }, orderBy: { data: "asc" } }),
  ]);

  // início da série = o MENOR entre a data oficial da obra e a data real da tarefa mais cedo
  // do Planejamento. Se o Planejamento foi remanejado e passou a começar antes da data
  // oficial, usar só obra.dataInicio cortava esses dias da conta e a curva "previsto" nunca
  // chegava perto de 100%.
  let inicioObra = new Date(obra.dataInicio);
  let fimSerie = addDias(inicioObra, Math.max(obra.prazoPrevistoDias, 1));
  for (const t of tarefas) {
    if (!t.dataInicio) continue;
    const inicioTarefa = new Date(t.dataInicio);
    if (inicioTarefa < inicioObra) inicioObra = inicioTarefa;
  }

  const hhPorDia = new Map<string, number>();
  let hhTotal = 0;
  for (const t of tarefas) {
    if (!t.dataInicio) continue;
    const dias = Math.max(t.duracaoDias, 1);
    const hh = (t.pessoas ?? 0) * Number(t.horas ?? 0);
    if (hh <= 0) continue;
    const hhDia = hh / dias;
    const inicio = new Date(t.dataInicio);
    for (let i = 0; i < dias; i++) {
      const dia = isoDia(addDias(inicio, i));
      hhPorDia.set(dia, (hhPorDia.get(dia) ?? 0) + hhDia);
      hhTotal += hhDia;
      const fimTarefa = addDias(inicio, i);
      if (fimTarefa > fimSerie) fimSerie = fimTarefa;
    }
  }

  const totalDias = Math.max(1, Math.round((fimSerie.getTime() - inicioObra.getTime()) / 86400000) + 1);

  const previsto: { data: string; pct: number }[] = [];
  let acumuladoHH = 0;
  for (let i = 0; i < totalDias; i++) {
    const dia = addDias(inicioObra, i);
    const diaIso = isoDia(dia);
    let pct: number;
    if (hhTotal > 0) {
      acumuladoHH += hhPorDia.get(diaIso) ?? 0;
      pct = Math.min(100, (acumuladoHH / hhTotal) * 100);
    } else {
      pct = Math.min(100, (i / Math.max(obra.prazoPrevistoDias, 1)) * 100);
    }
    previsto.push({ data: diaIso, pct });
  }

  const valorContrato = Number(obra.valorContrato);
  let acumuladoValor = 0;
  const realizado = medicoes.map((m) => {
    acumuladoValor += Number(m.valor);
    return { data: isoDia(new Date(m.data)), pct: valorContrato > 0 ? Math.min(100, (acumuladoValor / valorContrato) * 100) : 0, valor: acumuladoValor };
  });

  const hojeIso = isoDia(new Date(new Date().toDateString()));
  const pctPrevistoHoje = previsto.find((p) => p.data >= hojeIso)?.pct ?? previsto[previsto.length - 1]?.pct ?? 0;
  const pctRealizadoAtual = realizado.length > 0 ? realizado[realizado.length - 1].pct : 0;

  return {
    previsto,
    realizado,
    pctPrevistoHoje,
    pctRealizadoAtual,
    desvio: pctRealizadoAtual - pctPrevistoHoje,
  };
}
