import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function devidoEm(recorrencia: string, diasSemana: number[], data: string): boolean {
  const dow = new Date(data + "T00:00:00").getDay(); // 0=domingo...6=sábado
  if (recorrencia === "DIARIA" || recorrencia === "PONTUAL") return true;
  if (recorrencia === "DIAS_UTEIS") return dow >= 1 && dow <= 5;
  if (recorrencia === "SEMANAL") return diasSemana.includes(dow);
  return true;
}

// Tarefas de rotina/vida pessoal — de cada User, sem obra. "Criada todo dia" é só uma
// ilusão de UI: a Rotina existe uma vez só; o que muda por dia é RotinaExecucao (se foi
// concluída NAQUELE dia). Um dia novo automaticamente não tem execução = pendente de novo.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data") ?? new Date().toISOString().slice(0, 10);
  const userId = (session.user as any).id;

  const rotinas = await prisma.rotina.findMany({
    where: { userId, ativo: true },
    include: { execucoes: { where: { data } } },
    orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    rotinas.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      descricao: r.descricao,
      duracaoMin: r.duracaoMin,
      recorrencia: r.recorrencia,
      diasSemana: r.diasSemana,
      devidoHoje: devidoEm(r.recorrencia, r.diasSemana, data),
      concluidaHoje: r.execucoes[0]?.concluida ?? false,
    }))
  );
}

const createSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  duracaoMin: z.number().int().nonnegative().optional(),
  recorrencia: z.enum(["DIARIA", "DIAS_UTEIS", "SEMANAL", "PONTUAL"]).optional(),
  diasSemana: z.array(z.number().int().min(0).max(6)).optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const count = await prisma.rotina.count({ where: { userId: (session.user as any).id } });

  const rotina = await prisma.rotina.create({
    data: {
      userId: (session.user as any).id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      duracaoMin: parsed.data.duracaoMin,
      recorrencia: parsed.data.recorrencia ?? "DIARIA",
      diasSemana: parsed.data.diasSemana ?? [],
      ordem: count,
    },
  });

  return NextResponse.json(rotina, { status: 201 });
}
