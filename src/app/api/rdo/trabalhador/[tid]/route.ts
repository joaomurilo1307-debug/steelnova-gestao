import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  entrada: z.string().optional(),
  saida: z.string().nullable().optional(), // HH:MM p/ finalizar; "" ou null p/ reabrir
});

// Finaliza (saída), corrige horário ou reabre a contagem de UMA pessoa.
// Ao finalizar (saída + funcionário + entrada) gera/atualiza o LancamentoPonto -> Diárias.
export async function PATCH(req: Request, { params }: { params: { tid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const t = await prisma.rdoTrabalhador.findUnique({ where: { id: params.tid }, include: { rdo: { select: { obraId: true, data: true } } } });
  if (!t) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const entrada = parsed.data.entrada ?? t.entrada ?? undefined;
  const saida = parsed.data.saida === undefined ? t.saida : parsed.data.saida; // pode virar null (reabrir)

  let pontoId = t.pontoId;

  if (saida && entrada && t.funcionarioId) {
    // finalizou: cria ou atualiza a diária (ponto)
    if (pontoId) {
      await prisma.lancamentoPonto.update({ where: { id: pontoId }, data: { entrada, saida, dia: t.rdo.data } }).catch(async () => {
        const novo = await prisma.lancamentoPonto.create({ data: { obraId: t.rdo.obraId, funcionarioId: t.funcionarioId!, dia: t.rdo.data, entrada, saida } });
        pontoId = novo.id;
      });
    } else {
      const novo = await prisma.lancamentoPonto.create({ data: { obraId: t.rdo.obraId, funcionarioId: t.funcionarioId!, dia: t.rdo.data, entrada, saida } });
      pontoId = novo.id;
    }
  } else if (!saida && pontoId) {
    // reabriu: remove a diária gerada
    await prisma.lancamentoPonto.delete({ where: { id: pontoId } }).catch(() => {});
    pontoId = null;
  }

  const updated = await prisma.rdoTrabalhador.update({
    where: { id: params.tid },
    data: { entrada, saida: saida ?? null, pontoId },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { tid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const t = await prisma.rdoTrabalhador.findUnique({ where: { id: params.tid } });
  if (t?.pontoId) await prisma.lancamentoPonto.delete({ where: { id: t.pontoId } }).catch(() => {});
  await prisma.rdoTrabalhador.delete({ where: { id: params.tid } });
  return NextResponse.json({ ok: true });
}
