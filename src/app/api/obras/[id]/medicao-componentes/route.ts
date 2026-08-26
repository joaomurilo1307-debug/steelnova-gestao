import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function num(v: any): number {
  return v === null || v === undefined ? 0 : Number(v);
}

// mesmo cálculo de src/components/OrcamentoObra.tsx (calcServico) — replicado aqui
// pra medir pelo VALOR real de cada serviço (o que o cliente paga), não só peso.
function precoServico(s: { baseQtd: any; unidade: string; materiaPrima: any; insumosManual: any; maoDeObraManual: any; bdiManual: any }, p: {
  maoDeObraPorKg: number; insumosPorKg: number; bdiPercent: number; instalacaoPorM2: number;
}) {
  const baseQtd = num(s.baseQtd);
  const materiaPrima = num(s.materiaPrima);
  const isKg = s.unidade.toLowerCase() === "kg";
  const insumos = s.insumosManual !== null ? num(s.insumosManual) : isKg ? baseQtd * p.insumosPorKg : 0;
  const maoDeObra =
    s.maoDeObraManual !== null ? num(s.maoDeObraManual) : isKg ? baseQtd * p.maoDeObraPorKg : baseQtd * p.instalacaoPorM2;
  const custo = materiaPrima + insumos + maoDeObra;
  const bdi = s.bdiManual !== null ? num(s.bdiManual) : custo * p.bdiPercent;
  return custo + bdi;
}

// Medição física por SERVIÇO do orçamento (Fabricação, Montagem, Instalação de
// telha/calha/rufo...), ponderada pelo VALOR (R$) real de cada um — não pelo peso
// físico. Um serviço que é 40% do peso pode valer só 15% do contrato (telha é
// barata por kg comparada com fabricação/montagem, que carregam mão de obra) —
// medir por peso puro distorcia o % financeiro real da obra.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [servicos, parametros, componentes, obra] = await Promise.all([
    prisma.servicoOrcamento.findMany({ where: { obraId: params.id }, orderBy: { ordem: "asc" } }),
    prisma.parametrosOrcamento.findUnique({ where: { obraId: params.id } }),
    prisma.medicaoComponente.findMany({ where: { obraId: params.id } }),
    prisma.obra.findUnique({ where: { id: params.id }, select: { valorContrato: true } }),
  ]);

  const p = {
    maoDeObraPorKg: num(parametros?.maoDeObraPorKg),
    insumosPorKg: num(parametros?.insumosPorKg),
    bdiPercent: parametros ? num(parametros.bdiPercent) : 0.3,
    instalacaoPorM2: num(parametros?.instalacaoPorM2),
  };
  const componentesPorGrupo = new Map(componentes.map((c) => [c.grupo, c]));

  const linhas = servicos.map((s) => {
    const valor = precoServico(s, p);
    const c = componentesPorGrupo.get(s.id);
    // % concluído fica salvo em pctFabricado (schema reaproveitado — cada serviço
    // do orçamento já é uma fase única, não precisa mais do split fabricado/montado)
    const pctConcluido = c ? Number(c.pctFabricado) : 0;
    return { servicoId: s.id, nome: s.nome, baseQtd: num(s.baseQtd), unidade: s.unidade, valor, pctConcluido };
  });

  const valorTotalServicos = linhas.reduce((s, l) => s + l.valor, 0);
  const pctObra = valorTotalServicos > 0 ? linhas.reduce((s, l) => s + l.valor * l.pctConcluido, 0) / valorTotalServicos / 100 : 0;

  const valorContrato = Number(obra?.valorContrato ?? 0);

  return NextResponse.json({
    linhas,
    valorTotalServicos,
    pctObra: pctObra * 100,
    valorMedidoSugerido: pctObra * valorTotalServicos,
    valorContrato,
  });
}

const putSchema = z.object({
  servicoId: z.string().min(1),
  pctConcluido: z.number().min(0).max(100),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const componente = await prisma.medicaoComponente.upsert({
    where: { obraId_grupo: { obraId: params.id, grupo: parsed.data.servicoId } },
    update: { pctFabricado: parsed.data.pctConcluido, pctMontado: parsed.data.pctConcluido },
    create: {
      obraId: params.id,
      grupo: parsed.data.servicoId,
      pctFabricado: parsed.data.pctConcluido,
      pctMontado: parsed.data.pctConcluido,
    },
  });
  return NextResponse.json(componente);
}
