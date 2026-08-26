import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Componentes padrão da estrutura metálica — mesma lista usada em Materiais,
// pra que todo grupo com material cadastrado sempre apareça na medição.
const COMPONENTES = [
  "Tesouras",
  "Terças",
  "Contraventamentos",
  "Tirantes",
  "Chapas / Ligações",
  "Cobertura / Telha",
  "Calhas e Rufos",
  "Pingadeira",
  "Insumos",
  "Outros",
];

// Medição física por componente, ponderada pelo peso (kg) de cada grupo — o peso
// vem da aba Materiais. % Fabricado e % Montado são lançados aqui; o percentual
// da obra inteira é a média de cada grupo ponderada pelo peso dele.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [materiais, componentes] = await Promise.all([
    prisma.material.findMany({ where: { obraId: params.id } }),
    prisma.medicaoComponente.findMany({ where: { obraId: params.id } }),
  ]);

  const pesoPorGrupo = new Map<string, number>();
  for (const m of materiais) {
    const grupo = m.grupo || "Outros";
    const peso = m.pesoUnitario ? Number(m.pesoUnitario) * Number(m.quantidadePrevista) : 0;
    pesoPorGrupo.set(grupo, (pesoPorGrupo.get(grupo) ?? 0) + peso);
  }
  const componentesPorGrupo = new Map(componentes.map((c) => [c.grupo, c]));

  // grupos = componentes padrão que já têm material cadastrado + qualquer grupo
  // extra que já tenha medição lançada (não perde dado de um grupo removido de Materiais)
  const gruposComMaterial = COMPONENTES.filter((c) => pesoPorGrupo.has(c));
  const gruposExtras = Array.from(pesoPorGrupo.keys()).filter((g) => !COMPONENTES.includes(g));
  const gruposSoMedicao = componentes.map((c) => c.grupo).filter((g) => !pesoPorGrupo.has(g));
  const grupos = Array.from(new Set([...gruposComMaterial, ...gruposExtras, ...gruposSoMedicao]));

  const linhas = grupos.map((grupo) => {
    const c = componentesPorGrupo.get(grupo);
    const peso = pesoPorGrupo.get(grupo) ?? 0;
    const pctFabricado = c ? Number(c.pctFabricado) : 0;
    const pctMontado = c ? Number(c.pctMontado) : 0;
    return { grupo, peso, pctFabricado, pctMontado, pctPonderado: (pctFabricado + pctMontado) / 2 };
  });

  const pesoTotal = linhas.reduce((s, l) => s + l.peso, 0);
  const pctObra = pesoTotal > 0 ? linhas.reduce((s, l) => s + l.peso * l.pctPonderado, 0) / pesoTotal : 0;

  const obra = await prisma.obra.findUnique({ where: { id: params.id }, select: { valorContrato: true } });
  const valorContrato = Number(obra?.valorContrato ?? 0);

  return NextResponse.json({
    linhas,
    pesoTotal,
    pctObra,
    valorMedidoSugerido: (pctObra / 100) * valorContrato,
    valorContrato,
  });
}

const putSchema = z.object({
  grupo: z.string().min(1),
  pctFabricado: z.number().min(0).max(100),
  pctMontado: z.number().min(0).max(100),
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
    where: { obraId_grupo: { obraId: params.id, grupo: parsed.data.grupo } },
    update: { pctFabricado: parsed.data.pctFabricado, pctMontado: parsed.data.pctMontado },
    create: { obraId: params.id, grupo: parsed.data.grupo, pctFabricado: parsed.data.pctFabricado, pctMontado: parsed.data.pctMontado },
  });
  return NextResponse.json(componente);
}
