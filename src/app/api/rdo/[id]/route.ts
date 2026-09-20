import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  clima: z.enum(["SOL", "NUBLADO", "CHUVA", "TEMPO_RUIM"]).optional(),
  horarioInicio: z.string().nullable().optional(),
  horarioTermino: z.string().nullable().optional(),
  houveParalisacao: z.boolean().optional(),
  horarioParalisacao: z.string().nullable().optional(),
  motivoParalisacao: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rdo = await prisma.rdo.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(rdo);
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rdo = await prisma.rdo.findUnique({
    where: { id: params.id },
    include: { autor: { select: { name: true } }, trabalhadores: true, atividades: true, pendencias: true, fotos: true },
  });
  if (!rdo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(rdo);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.rdo.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
