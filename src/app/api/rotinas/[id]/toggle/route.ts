import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  data: z.string().min(1), // yyyy-mm-dd, dia local do usuário
  concluida: z.boolean(),
});

// Marca (ou desmarca) a execução da rotina NO DIA informado. Não existe "resetar" — um dia
// novo simplesmente ainda não tem RotinaExecucao, então já nasce pendente sozinho.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;

  const rotina = await prisma.rotina.findUnique({ where: { id: params.id }, select: { userId: true } });
  if (rotina?.userId !== userId) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const execucao = await prisma.rotinaExecucao.upsert({
    where: { rotinaId_data: { rotinaId: params.id, data: parsed.data.data } },
    update: { concluida: parsed.data.concluida, concluidaEm: parsed.data.concluida ? new Date() : null },
    create: {
      rotinaId: params.id,
      data: parsed.data.data,
      concluida: parsed.data.concluida,
      concluidaEm: parsed.data.concluida ? new Date() : null,
    },
  });

  return NextResponse.json(execucao);
}
