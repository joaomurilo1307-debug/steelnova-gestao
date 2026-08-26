import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createMaterialSchema = z.object({
  obraId: z.string().min(1),
  grupo: z.string().optional(),
  nome: z.string().min(1),
  unidade: z.string().min(1),
  quantidadePrevista: z.number().nonnegative(),
  quantidadeRecebida: z.number().nonnegative().optional(),
  fornecedor: z.string().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  pesoUnitario: z.number().nonnegative().optional(),
  fornecidoPeloCliente: z.boolean().optional(),
  statusCompra: z.enum(["A_COMPRAR", "EM_COTACAO", "COMPRADO"]).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const materiais = await prisma.material.findMany({ where: { obraId }, orderBy: { nome: "asc" } });
  return NextResponse.json(materiais);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createMaterialSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const material = await prisma.material.create({ data: parsed.data });
  return NextResponse.json(material, { status: 201 });
}
