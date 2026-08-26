import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function addDias(d: Date, dias: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + dias);
  return n;
}
function isoDia(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Curva S: previsto (linha contínua, ponderada por esforço — HH de cada atividade
// distribuído nos dias em que ela roda, conforme o Planejamento) x realizado
// (pontos = medições lançadas, acumuladas). Tudo em % do contrato/prazo.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    select: { dataInicio: true, prazoPrevistoDias: true, valorContrato: true },
  });
  if (!obra) return NextResponse.json({ error: "obra não encontrada" }, { status: 404 });

  const [tarefas, medicoes] = await Promise.all([
    prisma.tarefa.findMany({
      where: { obraId: params.id, dataInicio: { not: null } },
      select: { dataInicio: true, duracaoDias: true, pessoas: true, horas: true },
    }),
    prisma.medicao.findMany({ where: { obraId: params.id }, orderBy: { data: "asc" } }),
  ]);

  // início da série = o MENOR entre a data oficial da obra e a data real da tarefa
  // mais cedo do Planejamento. Se o Planejamento foi remanejado (obra atrasada,
  // replanejada, ou — caso da HNSD — datas de demonstração deslocadas) e passou a
  // começar antes da data oficial, usar só obra.dataInicio cortava esses dias da
  // conta e a curva "previsto" nunca chegava perto de 100% (bug real, achado
  // comparando com o Esforço total da aba — a soma batia, mas a curva parava na
  // metade porque metade dos dias de HH ficava antes do início considerado).
  let inicioObra = new Date(obra.dataInicio);
  let fimSerie = addDias(inicioObra, Math.max(obra.prazoPrevistoDias, 1));
  for (const t of tarefas) {
    if (!t.dataInicio) continue;
    const inicioTarefa = new Date(t.dataInicio);
    if (inicioTarefa < inicioObra) inicioObra = inicioTarefa;
  }

  // HH por dia, espalhando cada tarefa igualmente pelos dias que ela dura
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

  // série "previsto": se tem HH no planejamento, usa a distribuição real de esforço;
  // senão, cai pra reta linear (0% no início, 100% no fim do prazo) — sempre tem uma linha.
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

  return NextResponse.json({
    previsto,
    realizado,
    pctPrevistoHoje,
    pctRealizadoAtual,
    desvio: pctRealizadoAtual - pctPrevistoHoje,
  });
}
