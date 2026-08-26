import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularResultados } from "@/lib/resultado";

export const dynamic = "force-dynamic";

// DRE consolidado da empresa — tudo CALCULADO a partir dos dados já lançados
// (medições, ponto, materiais, desembolsos, custos, aquisições, indiretos, propostas).
// Nada é redigitado: é o topo da cadeia RDO→ponto→diária→custo→resultado→DRE.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ obras, poolIndiretosTodas, poolDepreciacao }, propostas, aquisicoes] = await Promise.all([
    calcularResultados(),
    prisma.proposta.findMany({ select: { custoGasto: true } }),
    prisma.aquisicao.findMany({ select: { valor: true } }),
  ]);

  const soma = (f: (o: (typeof obras)[number]) => number) => obras.reduce((s, o) => s + f(o), 0);

  const receita = soma((o) => o.receita);
  const impostos = soma((o) => o.impostos);
  const maoDeObra = soma((o) => o.maoDeObra);
  const materiais = soma((o) => o.materiais);
  const desembolsos = soma((o) => o.desembolsos);
  const lancamentosDiretos = soma((o) => o.lancamentos);
  const custosDiretos = maoDeObra + materiais + desembolsos + lancamentosDiretos;

  const indiretosUma = soma((o) => o.indiretosUma);
  const custosIndiretos = poolIndiretosTodas + indiretosUma; // salários, aluguel etc.
  const depreciacao = poolDepreciacao;

  const despesasComerciais = propostas.reduce((s, p) => s + Number(p.custoGasto ?? 0), 0);
  const aquisicoesValorCheio = aquisicoes.reduce((s, a) => s + Number(a.valor), 0);

  const receitaLiquida = receita - impostos;
  const lucroBruto = receitaLiquida - custosDiretos;
  // Competência (com depreciação):
  const resultadoOperacional = lucroBruto - custosIndiretos - depreciacao - despesasComerciais;
  // Caixa (aquisição pelo valor cheio, sem depreciação):
  const resultadoCaixa = lucroBruto - custosIndiretos - aquisicoesValorCheio - despesasComerciais;

  return NextResponse.json({
    receita,
    impostos,
    receitaLiquida,
    maoDeObra,
    materiais,
    desembolsos,
    lancamentosDiretos,
    custosDiretos,
    lucroBruto,
    custosIndiretos,
    depreciacao,
    despesasComerciais,
    aquisicoesValorCheio,
    resultadoOperacional,
    resultadoCaixa,
    margemOperacional: receita > 0 ? resultadoOperacional / receita : 0,
    margemCaixa: receita > 0 ? resultadoCaixa / receita : 0,
  });
}
