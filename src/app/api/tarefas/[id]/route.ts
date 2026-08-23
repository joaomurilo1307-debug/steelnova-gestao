import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["A_FAZER", "FAZENDO", "BLOQUEADO", "FEITO"]).optional(),
  prioridade: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
  eap: z.string().nullable().optional(),
  fase: z.string().nullable().optional(),
  titulo: z.string().min(1).optional(),
  descricao: z.string().optional(),
  dataInicio: z.string().optional(),
  duracaoDias: z.number().int().positive().optional(),
  percentConcluido: z.number().int().min(0).max(100).optional(),
  dataInicioReal: z.string().nullable().optional(),
  dataFimReal: z.string().nullable().optional(),
  pessoas: z.number().int().nonnegative().nullable().optional(),
  horas: z.number().nonnegative().nullable().optional(),
  turno: z.string().nullable().optional(),
  responsavelNome: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  responsavelId: z.string().nullable().optional(),
  predecessoraId: z.string().nullable().optional(),
  tarefaMaeId: z.string().nullable().optional(),
  horasEstimadas: z.number().nonnegative().nullable().optional(),
  valorHora: z.number().nonnegative().nullable().optional(),
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

  const data: any = { ...parsed.data };
  if (data.dataInicio) data.dataInicio = new Date(data.dataInicio);
  if (data.dataInicioReal) data.dataInicioReal = new Date(data.dataInicioReal);
  if (data.dataFimReal) data.dataFimReal = new Date(data.dataFimReal);

  const tarefa = await prisma.tarefa.update({ where: { id: params.id }, data });
  return NextResponse.json(tarefa);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.tarefa.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
