import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  predecessoraId: z.string().min(1),
  tipo: z.enum(["FS", "SS", "FF", "SF"]).optional(),
  lagDias: z.number().int().optional(),
});

// sucessora = params.id (a tarefa que passa a DEPENDER da predecessora informada no corpo)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.predecessoraId === params.id) {
    return NextResponse.json({ error: "uma tarefa não pode depender dela mesma" }, { status: 400 });
  }

  const [predecessora, sucessora] = await Promise.all([
    prisma.tarefa.findUnique({ where: { id: parsed.data.predecessoraId }, select: { id: true, obraId: true } }),
    prisma.tarefa.findUnique({ where: { id: params.id }, select: { id: true, obraId: true } }),
  ]);
  if (!predecessora || !sucessora || predecessora.obraId !== sucessora.obraId) {
    return NextResponse.json({ error: "tarefas precisam ser da mesma obra" }, { status: 400 });
  }

  const dependencia = await prisma.tarefaDependencia.upsert({
    where: { predecessoraId_sucessoraId: { predecessoraId: parsed.data.predecessoraId, sucessoraId: params.id } },
    update: { tipo: parsed.data.tipo ?? "FS", lagDias: parsed.data.lagDias ?? 0 },
    create: {
      predecessoraId: parsed.data.predecessoraId,
      sucessoraId: params.id,
      tipo: parsed.data.tipo ?? "FS",
      lagDias: parsed.data.lagDias ?? 0,
    },
  });

  return NextResponse.json(dependencia, { status: 201 });
}
