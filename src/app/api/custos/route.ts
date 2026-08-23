import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCustoSchema = z.object({
  obraId: z.string().min(1),
  categoria: z.string().min(1),
  descricao: z.string().min(1),
  valorPrevisto: z.number().nonnegative(),
  valorRealizado: z.number().nonnegative().optional(),
  data: z.string(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId") ?? undefined;

  const custos = await prisma.custoLancamento.findMany({
    where: obraId ? { obraId } : undefined,
    include: { obra: { select: { nome: true } } },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(custos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCustoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const custo = await prisma.custoLancamento.create({
    data: {
      obraId: parsed.data.obraId,
      categoria: parsed.data.categoria,
      descricao: parsed.data.descricao,
      valorPrevisto: parsed.data.valorPrevisto,
      valorRealizado: parsed.data.valorRealizado,
      data: new Date(parsed.data.data),
    },
  });

  return NextResponse.json(custo, { status: 201 });
}
