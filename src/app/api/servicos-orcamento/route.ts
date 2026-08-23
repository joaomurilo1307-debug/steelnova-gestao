import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  obraId: z.string().min(1),
  nome: z.string().min(1),
  baseQtd: z.number().nonnegative(),
  unidade: z.string().min(1),
  materiaPrima: z.number().nonnegative().optional(),
  insumosManual: z.number().nonnegative().optional().nullable(),
  maoDeObraManual: z.number().nonnegative().optional().nullable(),
  bdiManual: z.number().nonnegative().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const servicos = await prisma.servicoOrcamento.findMany({ where: { obraId }, orderBy: { ordem: "asc" } });
  return NextResponse.json(servicos);
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

  const count = await prisma.servicoOrcamento.count({ where: { obraId: parsed.data.obraId } });
  const servico = await prisma.servicoOrcamento.create({ data: { ...parsed.data, ordem: count } });
  return NextResponse.json(servico, { status: 201 });
}
