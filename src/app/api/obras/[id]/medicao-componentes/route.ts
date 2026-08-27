import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMedicaoData } from "@/lib/medicao";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getMedicaoData(params.id);
  return NextResponse.json(data);
}

const putSchema = z.object({
  servicoId: z.string().min(1),
  pctConcluido: z.number().min(0).max(100),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const componente = await prisma.medicaoComponente.upsert({
    where: { obraId_grupo: { obraId: params.id, grupo: parsed.data.servicoId } },
    update: { pctFabricado: parsed.data.pctConcluido, pctMontado: parsed.data.pctConcluido },
    create: {
      obraId: params.id,
      grupo: parsed.data.servicoId,
      pctFabricado: parsed.data.pctConcluido,
      pctMontado: parsed.data.pctConcluido,
    },
  });
  return NextResponse.json(componente);
}
