import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  quantidadeRecebida: z.number().nonnegative().optional(),
  custoUnitario: z.number().nonnegative().optional(),
  fornecedor: z.string().optional(),
  fornecidoPeloCliente: z.boolean().optional(),
  statusCompra: z.enum(["A_COMPRAR", "EM_COTACAO", "COMPRADO"]).optional(),
  servicoOrcamentoId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const material = await prisma.material.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(material);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.material.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
