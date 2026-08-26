import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  descricao: z.string().min(1),
  categoria: z.string().optional(),
  valor: z.number().nonnegative(),
  competencia: z.string(),
  recorrente: z.boolean().optional(),
  escopo: z.enum(["TODAS", "UMA"]).optional(),
  obraId: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const custos = await prisma.custoIndireto.findMany({
    orderBy: { competencia: "desc" },
    include: { obra: { select: { id: true, nome: true } } },
  });
  return NextResponse.json(custos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const escopo = parsed.data.escopo ?? "TODAS";
  const custo = await prisma.custoIndireto.create({
    data: {
      descricao: parsed.data.descricao,
      categoria: parsed.data.categoria ?? "Salário",
      valor: parsed.data.valor,
      competencia: new Date(parsed.data.competencia),
      recorrente: parsed.data.recorrente ?? false,
      escopo,
      obraId: escopo === "UMA" ? parsed.data.obraId ?? null : null,
    },
  });
  return NextResponse.json(custo, { status: 201 });
}
