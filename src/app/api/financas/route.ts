import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  tipo: z.string().min(1),
  descricao: z.string().min(1),
  pessoa: z.string().optional(),
  valor: z.number().nonnegative(),
  data: z.string(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({ orderBy: { data: "desc" } });
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

  const lancamento = await prisma.lancamentoFinanceiro.create({
    data: { ...parsed.data, data: new Date(parsed.data.data) },
  });

  return NextResponse.json(lancamento, { status: 201 });
}
