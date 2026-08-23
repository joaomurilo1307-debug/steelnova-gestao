import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createRdoSchema = z.object({
  obraId: z.string().min(1),
  data: z.string(),
  clima: z.string().min(1),
  efetivo: z.number().int().nonnegative(),
  atividades: z.string().min(1),
  ocorrencias: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const rdos = await prisma.rdo.findMany({
    where: { obraId },
    include: { autor: { select: { name: true } } },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(rdos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createRdoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.rdo.findUnique({
    where: { obraId_data: { obraId: parsed.data.obraId, data: new Date(parsed.data.data) } },
  });
  if (existing) {
    return NextResponse.json({ error: "Já existe um RDO para essa obra nessa data." }, { status: 409 });
  }

  const rdo = await prisma.rdo.create({
    data: {
      obraId: parsed.data.obraId,
      data: new Date(parsed.data.data),
      clima: parsed.data.clima,
      efetivo: parsed.data.efetivo,
      atividades: parsed.data.atividades,
      ocorrencias: parsed.data.ocorrencias,
      autorId: (session.user as any).id,
    },
  });

  return NextResponse.json(rdo, { status: 201 });
}
