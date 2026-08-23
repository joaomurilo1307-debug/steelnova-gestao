import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  cliente: z.string().min(1).optional(),
  endereco: z.string().optional(),
  valorContrato: z.number().nonnegative().optional(),
  status: z.enum(["PLANEJAMENTO", "EM_ANDAMENTO", "PAUSADA", "CONCLUIDA"]).optional(),
  dataInicio: z.string().optional(),
  prazoPrevistoDias: z.number().int().positive().optional(),
  progresso: z.number().int().min(0).max(100).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    include: { membros: { include: { user: { select: { id: true, name: true } } } } },
  });

  if (!obra) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(obra);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data: any = { ...parsed.data };
  if (data.dataInicio) data.dataInicio = new Date(data.dataInicio);

  const obra = await prisma.obra.update({ where: { id: params.id }, data });
  return NextResponse.json(obra);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.obra.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
