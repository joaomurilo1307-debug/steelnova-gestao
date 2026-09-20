import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  obraId: z.string().min(1),
  categoria: z.string().optional(),
  descricao: z.string().min(1),
  quantidade: z.number().nonnegative().optional(),
  unidade: z.string().optional(),
  solicitante: z.string().min(1),
  urgencia: z.enum(["BAIXA", "MEDIA", "ALTA"]).optional(),
  observacao: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId") ?? undefined;

  const demandas = await prisma.demanda.findMany({
    where: obraId ? { obraId } : undefined,
    include: { obra: { select: { id: true, nome: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(demandas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const demanda = await prisma.demanda.create({
    data: {
      obraId: parsed.data.obraId,
      categoria: parsed.data.categoria || "Material",
      descricao: parsed.data.descricao,
      quantidade: parsed.data.quantidade,
      unidade: parsed.data.unidade,
      solicitante: parsed.data.solicitante,
      urgencia: parsed.data.urgencia ?? "MEDIA",
      observacao: parsed.data.observacao,
    },
  });

  return NextResponse.json(demanda, { status: 201 });
}
