import { prisma } from "@/lib/prisma";

function horasEntre(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  let mins = sh * 60 + sm - (eh * 60 + em);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

// meses decorridos da competência até hoje (inclusive), mínimo 1
function mesesDecorridos(d: Date): number {
  const now = new Date();
  const m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()) + 1;
  return Math.max(1, m);
}

export type ResultadoObra = {
  obraId: string;
  nome: string;
  status: string;
  ativa: boolean;
  horas: number;
  share: number; // fração das horas das obras ativas
  receita: number; // medições, ou contrato se não houver medição
  receitaMedida: number;
  valorContrato: number;
  maoDeObra: number;
  materiais: number;
  desembolsos: number;
  lancamentos: number;
  diretos: number;
  indiretosRateados: number; // fatia dos custos indiretos TODAS
  depreciacaoRateada: number; // fatia da depreciação das aquisições
  indiretosUma: number; // custos indiretos jogados só nesta obra
  custoTotal: number;
  impostos: number;
  lucro: number;
  margem: number;
};

export type ResultadoConsolidado = {
  obras: ResultadoObra[];
  poolIndiretosTodas: number;
  poolDepreciacao: number;
  horasAtivasTotal: number;
};

export async function calcularResultados(): Promise<ResultadoConsolidado> {
  const [obras, aquisicoes, indiretos] = await Promise.all([
    prisma.obra.findMany({
      include: {
        custos: true,
        materiais: true,
        desembolsos: true,
        parametrosOrcamento: true,
        lancamentosPonto: { include: { funcionario: true } },
        medicoes: true,
      },
    }),
    prisma.aquisicao.findMany(),
    prisma.custoIndireto.findMany(),
  ]);

  // Pool de indiretos rateáveis em TODAS as obras ativas (por horas)
  const poolIndiretosTodas = indiretos
    .filter((c) => c.escopo === "TODAS")
    .reduce((s, c) => s + Number(c.valor) * (c.recorrente ? mesesDecorridos(c.competencia) : 1), 0);

  // Depreciação acumulada até hoje (parcela mensal × meses decorridos, limitado à vida útil)
  const poolDepreciacao = aquisicoes.reduce((s, a) => {
    const parcela = Number(a.valor) / (a.vidaUtilMeses || 1);
    const meses = Math.min(mesesDecorridos(a.dataCompra), a.vidaUtilMeses || 1);
    return s + parcela * meses;
  }, 0);

  // Indiretos "UMA obra" — mapa obraId → total
  const umaPorObra = new Map<string, number>();
  for (const c of indiretos) {
    if (c.escopo === "UMA" && c.obraId) {
      const v = Number(c.valor) * (c.recorrente ? mesesDecorridos(c.competencia) : 1);
      umaPorObra.set(c.obraId, (umaPorObra.get(c.obraId) ?? 0) + v);
    }
  }

  // Passo 1 — custos diretos + horas por obra
  const base = obras.map((obra) => {
    const horasPorDiaria = Number(obra.parametrosOrcamento?.horasPorDiaria ?? 8);
    const diariaPadrao = Number(obra.parametrosOrcamento?.diariaPadrao ?? 150);
    const impostoPercent = Number(obra.parametrosOrcamento?.impostoPercent ?? 0.06);

    const porFunc = new Map<string, { horas: number; regime: string; valorFixo: number; diariaFunc: number | null }>();
    for (const l of obra.lancamentosPonto) {
      const cur = porFunc.get(l.funcionario.id) ?? {
        horas: 0,
        regime: l.funcionario.regime,
        valorFixo: Number(l.funcionario.valorFixo ?? 0),
        diariaFunc: l.funcionario.diariaPadrao ? Number(l.funcionario.diariaPadrao) : null,
      };
      cur.horas += horasEntre(l.entrada, l.saida);
      porFunc.set(l.funcionario.id, cur);
    }
    let maoDeObra = 0;
    let horas = 0;
    for (const f of porFunc.values()) {
      horas += f.horas;
      if (f.regime === "Fixo") maoDeObra += f.valorFixo;
      else maoDeObra += f.horas * ((f.diariaFunc ?? diariaPadrao) / horasPorDiaria);
    }

    const desembolsos = obra.desembolsos.filter((d) => d.categoria !== "Adiantamento").reduce((s, d) => s + Number(d.valor), 0);
    const materiais = obra.materiais
      .filter((m) => !m.fornecidoPeloCliente)
      .reduce((s, m) => s + Number(m.custoUnitario ?? 0) * Number(m.quantidadeRecebida), 0);
    const lancamentos = obra.custos.reduce((s, c) => s + Number(c.valorRealizado ?? c.valorPrevisto), 0);
    const receitaMedida = obra.medicoes.reduce((s, m) => s + Number(m.valor), 0);
    const valorContrato = Number(obra.valorContrato);
    const receita = receitaMedida > 0 ? receitaMedida : valorContrato;

    return {
      obra,
      impostoPercent,
      horas,
      maoDeObra,
      desembolsos,
      materiais,
      lancamentos,
      receitaMedida,
      valorContrato,
      receita,
      ativa: obra.status !== "CONCLUIDA",
    };
  });

  const horasAtivasTotal = base.filter((b) => b.ativa).reduce((s, b) => s + b.horas, 0);
  const nAtivas = base.filter((b) => b.ativa).length;

  const resultados: ResultadoObra[] = base.map((b) => {
    // share por horas entre as ativas (se ninguém tem hora ainda, divide igual entre as ativas)
    let share = 0;
    if (b.ativa) {
      if (horasAtivasTotal > 0) share = b.horas / horasAtivasTotal;
      else if (nAtivas > 0) share = 1 / nAtivas;
    }
    const indiretosRateados = poolIndiretosTodas * share;
    const depreciacaoRateada = poolDepreciacao * share;
    const indiretosUma = umaPorObra.get(b.obra.id) ?? 0;

    const diretos = b.maoDeObra + b.desembolsos + b.materiais + b.lancamentos;
    const custoTotal = diretos + indiretosRateados + depreciacaoRateada + indiretosUma;
    const impostos = b.receita * b.impostoPercent;
    const lucro = b.receita - custoTotal - impostos;

    return {
      obraId: b.obra.id,
      nome: b.obra.nome,
      status: b.obra.status,
      ativa: b.ativa,
      horas: b.horas,
      share,
      receita: b.receita,
      receitaMedida: b.receitaMedida,
      valorContrato: b.valorContrato,
      maoDeObra: b.maoDeObra,
      materiais: b.materiais,
      desembolsos: b.desembolsos,
      lancamentos: b.lancamentos,
      diretos,
      indiretosRateados,
      depreciacaoRateada,
      indiretosUma,
      custoTotal,
      impostos,
      lucro,
      margem: b.receita > 0 ? lucro / b.receita : 0,
    };
  });

  return { obras: resultados, poolIndiretosTodas, poolDepreciacao, horasAtivasTotal };
}
