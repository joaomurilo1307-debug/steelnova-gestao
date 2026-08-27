import { prisma } from "@/lib/prisma";

function num(v: any): number {
  return v === null || v === undefined ? 0 : Number(v);
}

// mesmo cálculo de src/components/OrcamentoObra.tsx (calcServico) — replicado aqui pra medir
// pelo VALOR real de cada serviço (o que o cliente paga), não só peso.
//
// Insumos (consumíveis) ficam por conta do cliente — não entram no preço que a SteelNova
// cobra nem no peso usado pra ponderar a Medição. Continuam calculados e retornados à parte
// (insumosCliente), só não somam no "preco" que pondera o % físico-financeiro da obra.
function precoServico(
  s: { baseQtd: any; unidade: string; materiaPrima: any; insumosManual: any; maoDeObraManual: any; bdiManual: any },
  p: { maoDeObraPorKg: number; insumosPorKg: number; bdiPercent: number; instalacaoPorM2: number }
) {
  const baseQtd = num(s.baseQtd);
  const materiaPrima = num(s.materiaPrima);
  const isKg = s.unidade.toLowerCase() === "kg";
  const insumosCliente = s.insumosManual !== null ? num(s.insumosManual) : isKg ? baseQtd * p.insumosPorKg : 0;
  const maoDeObra =
    s.maoDeObraManual !== null ? num(s.maoDeObraManual) : isKg ? baseQtd * p.maoDeObraPorKg : baseQtd * p.instalacaoPorM2;
  const custo = materiaPrima + maoDeObra;
  const bdi = s.bdiManual !== null ? num(s.bdiManual) : custo * p.bdiPercent;
  return { preco: custo + bdi, insumosCliente };
}

export type MaterialVinculado = {
  id: string;
  nome: string;
  unidade: string;
  quantidadePrevista: number;
  quantidadeRecebida: number;
  pesoTotal: number;
  fornecidoPeloCliente: boolean;
  statusCompra: string;
};

export type TarefaVinculada = {
  id: string;
  titulo: string;
  percentConcluido: number;
  dataInicio: string | null;
};

export type LinhaMedicao = {
  servicoId: string;
  nome: string;
  baseQtd: number;
  unidade: string;
  valor: number;
  insumosCliente: number;
  pctConcluido: number;
  pctSugerido: number | null;
  // composição real por trás do serviço — pra Medição deixar de ser um número solto e
  // mostrar de onde ele vem: quais materiais (peso, compra) e quais tarefas (progresso)
  materiais: MaterialVinculado[];
  tarefas: TarefaVinculada[];
};

export type MedicaoData = {
  linhas: LinhaMedicao[];
  valorTotalServicos: number;
  valorInsumosCliente: number;
  pctObra: number;
  valorMedidoSugerido: number;
  valorContrato: number;
};

// Medição física por SERVIÇO do orçamento (Fabricação, Montagem, Instalação de
// telha/calha/rufo...), ponderada pelo VALOR (R$) real de cada um — não pelo peso físico. Um
// serviço que é 40% do peso pode valer só 15% do contrato (telha é barata por kg comparada
// com fabricação/montagem, que carregam mão de obra) — medir por peso puro distorcia o %
// financeiro real da obra.
export async function getMedicaoData(obraId: string): Promise<MedicaoData> {
  const [servicos, parametros, componentes, obra, tarefas, materiais] = await Promise.all([
    prisma.servicoOrcamento.findMany({ where: { obraId }, orderBy: { ordem: "asc" } }),
    prisma.parametrosOrcamento.findUnique({ where: { obraId } }),
    prisma.medicaoComponente.findMany({ where: { obraId } }),
    prisma.obra.findUnique({ where: { id: obraId }, select: { valorContrato: true } }),
    prisma.tarefa.findMany({
      where: { obraId, servicoOrcamentoId: { not: null } },
      select: { id: true, titulo: true, dataInicio: true, servicoOrcamentoId: true, percentConcluido: true, duracaoDias: true, pessoas: true, horas: true },
    }),
    prisma.material.findMany({
      where: { obraId, servicoOrcamentoId: { not: null } },
      select: {
        id: true,
        nome: true,
        unidade: true,
        quantidadePrevista: true,
        quantidadeRecebida: true,
        pesoUnitario: true,
        fornecidoPeloCliente: true,
        statusCompra: true,
        servicoOrcamentoId: true,
      },
    }),
  ]);

  const p = {
    maoDeObraPorKg: num(parametros?.maoDeObraPorKg),
    insumosPorKg: num(parametros?.insumosPorKg),
    bdiPercent: parametros ? num(parametros.bdiPercent) : 0.3,
    instalacaoPorM2: num(parametros?.instalacaoPorM2),
  };
  const componentesPorGrupo = new Map(componentes.map((c) => [c.grupo, c]));

  // sugestão de % concluído por serviço, a partir do progresso real das tarefas do
  // Planejamento vinculadas a ele (Cronograma → "Serviço do orçamento"), ponderada pelo
  // esforço (HH) de cada tarefa — não some, só sugere; quem decide o % lançado é o usuário.
  const sugeridoPorServico = new Map<string, { somaHHxPct: number; somaHH: number }>();
  const tarefasPorServico = new Map<string, TarefaVinculada[]>();
  for (const t of tarefas) {
    if (!t.servicoOrcamentoId) continue;
    const hh = Math.max((t.pessoas ?? 0) * Number(t.horas ?? 0), 1) * Math.max(t.duracaoDias, 1);
    const acc = sugeridoPorServico.get(t.servicoOrcamentoId) ?? { somaHHxPct: 0, somaHH: 0 };
    acc.somaHHxPct += hh * t.percentConcluido;
    acc.somaHH += hh;
    sugeridoPorServico.set(t.servicoOrcamentoId, acc);

    const lista = tarefasPorServico.get(t.servicoOrcamentoId) ?? [];
    lista.push({ id: t.id, titulo: t.titulo, percentConcluido: t.percentConcluido, dataInicio: t.dataInicio ? t.dataInicio.toISOString().slice(0, 10) : null });
    tarefasPorServico.set(t.servicoOrcamentoId, lista);
  }

  const materiaisPorServico = new Map<string, MaterialVinculado[]>();
  for (const m of materiais) {
    if (!m.servicoOrcamentoId) continue;
    const lista = materiaisPorServico.get(m.servicoOrcamentoId) ?? [];
    lista.push({
      id: m.id,
      nome: m.nome,
      unidade: m.unidade,
      quantidadePrevista: num(m.quantidadePrevista),
      quantidadeRecebida: num(m.quantidadeRecebida),
      pesoTotal: m.pesoUnitario ? num(m.pesoUnitario) * num(m.quantidadePrevista) : 0,
      fornecidoPeloCliente: m.fornecidoPeloCliente,
      statusCompra: m.statusCompra,
    });
    materiaisPorServico.set(m.servicoOrcamentoId, lista);
  }

  const linhas: LinhaMedicao[] = servicos.map((s) => {
    const { preco: valor, insumosCliente } = precoServico(s, p);
    const c = componentesPorGrupo.get(s.id);
    // % concluído fica salvo em pctFabricado (schema reaproveitado — cada serviço do
    // orçamento já é uma fase única, não precisa mais do split fabricado/montado)
    const pctConcluido = c ? Number(c.pctFabricado) : 0;
    const sug = sugeridoPorServico.get(s.id);
    const pctSugerido = sug && sug.somaHH > 0 ? sug.somaHHxPct / sug.somaHH : null;
    return {
      servicoId: s.id,
      nome: s.nome,
      baseQtd: num(s.baseQtd),
      unidade: s.unidade,
      valor,
      insumosCliente,
      pctConcluido,
      pctSugerido,
      materiais: materiaisPorServico.get(s.id) ?? [],
      tarefas: tarefasPorServico.get(s.id) ?? [],
    };
  });

  const valorTotalServicos = linhas.reduce((s, l) => s + l.valor, 0);
  const valorInsumosCliente = linhas.reduce((s, l) => s + l.insumosCliente, 0);
  const pctObra = valorTotalServicos > 0 ? linhas.reduce((s, l) => s + l.valor * l.pctConcluido, 0) / valorTotalServicos / 100 : 0;

  const valorContrato = Number(obra?.valorContrato ?? 0);

  return {
    linhas,
    valorTotalServicos,
    valorInsumosCliente,
    pctObra: pctObra * 100,
    valorMedidoSugerido: pctObra * valorTotalServicos,
    valorContrato,
  };
}
