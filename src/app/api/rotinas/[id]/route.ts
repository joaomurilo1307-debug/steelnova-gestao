import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  titulo: z.string().min(1).optional(),
  descricao: z.string().nullable().optional(),
  duracaoMin: z.number().int().nonnegative().nullable().optional(),
  recorrencia: z.enum(["DIARIA", "DIAS_UTEIS", "SEMANAL", "PONTUAL"]).optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
});

async function assertDono(id: string, userId: string) {
  const r = await prisma.rotina.findUnique({ where: { id }, select: { userId: true } });
  return r?.userId === userId;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  if (!(await assertDono(params.id, userId))) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rotina = await prisma.rotina.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(rotina);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  if (!(await assertDono(params.id, userId))) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  await prisma.rotina.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
