import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  baseQtd: z.number().nonnegative().optional(),
  unidade: z.string().min(1).optional(),
  materiaPrima: z.number().nonnegative().optional(),
  insumosManual: z.number().nonnegative().nullable().optional(),
  maoDeObraManual: z.number().nonnegative().nullable().optional(),
  bdiManual: z.number().nonnegative().nullable().optional(),
  ordem: z.number().int().optional(),
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

  const servico = await prisma.servicoOrcamento.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(servico);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.servicoOrcamento.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
