import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  obraId: z.string().min(1),
  funcionarioId: z.string().min(1),
  dia: z.string(),
  entrada: z.string().regex(/^\d{2}:\d{2}$/),
  saida: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const lancamentos = await prisma.lancamentoPonto.findMany({
    where: { obraId },
    include: { funcionario: true },
    orderBy: { dia: "desc" },
  });
  return NextResponse.json(lancamentos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const lancamento = await prisma.lancamentoPonto.create({
    data: {
      obraId: parsed.data.obraId,
      funcionarioId: parsed.data.funcionarioId,
      dia: new Date(parsed.data.dia),
      entrada: parsed.data.entrada,
      saida: parsed.data.saida,
    },
  });

  return NextResponse.json(lancamento, { status: 201 });
}
