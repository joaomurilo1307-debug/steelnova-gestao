import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createTarefaSchema = z.object({
  obraId: z.string().min(1),
  eap: z.string().optional(),
  fase: z.string().optional(),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  status: z.enum(["A_FAZER", "FAZENDO", "BLOQUEADO", "FEITO"]).optional(),
  dataInicio: z.string().optional(),
  duracaoDias: z.number().int().positive().optional(),
  responsavelId: z.string().optional(),
  predecessoraId: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const tarefas = await prisma.tarefa.findMany({
    where: { obraId },
    include: { responsavel: { select: { id: true, name: true } } },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(tarefas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTarefaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const count = await prisma.tarefa.count({ where: { obraId: parsed.data.obraId } });

  const tarefa = await prisma.tarefa.create({
    data: {
      obraId: parsed.data.obraId,
      eap: parsed.data.eap,
      fase: parsed.data.fase,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      status: parsed.data.status ?? "A_FAZER",
      dataInicio: parsed.data.dataInicio ? new Date(parsed.data.dataInicio) : undefined,
      duracaoDias: parsed.data.duracaoDias ?? 1,
      responsavelId: parsed.data.responsavelId,
      predecessoraId: parsed.data.predecessoraId,
      ordem: count,
    },
  });

  return NextResponse.json(tarefa, { status: 201 });
}
