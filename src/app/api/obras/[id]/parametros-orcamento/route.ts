import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  maoDeObraPorKg: z.number().nonnegative(),
  insumosPorKg: z.number().nonnegative(),
  bdiPercent: z.number().min(0).max(2),
  instalacaoPorM2: z.number().nonnegative(),
  valorAlvo: z.number().nonnegative().optional().nullable(),
  diariaPadrao: z.number().nonnegative(),
  horasPorDiaria: z.number().positive(),
  encarregadoFixo: z.number().nonnegative(),
  alimentacaoPorDia: z.number().nonnegative(),
  impostoPercent: z.number().min(0).max(1),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parametros = await prisma.parametrosOrcamento.findUnique({ where: { obraId: params.id } });
  return NextResponse.json(
    parametros ?? {
      obraId: params.id,
      maoDeObraPorKg: 0,
      insumosPorKg: 0,
      bdiPercent: 0.3,
      instalacaoPorM2: 0,
      valorAlvo: null,
      diariaPadrao: 150,
      horasPorDiaria: 8,
      encarregadoFixo: 0,
      alimentacaoPorDia: 0,
      impostoPercent: 0.06,
    }
  );
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const parametros = await prisma.parametrosOrcamento.upsert({
    where: { obraId: params.id },
    update: parsed.data,
    create: { ...parsed.data, obraId: params.id },
  });

  return NextResponse.json(parametros);
}
