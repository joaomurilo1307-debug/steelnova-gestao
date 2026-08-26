import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const trabalhadorSchema = z.object({
  nome: z.string().min(1),
  funcao: z.string().min(1),
  entrada: z.string().optional(),
  saida: z.string().optional(),
});

const atividadeSchema = z.object({
  descricao: z.string().min(1),
  situacao: z.enum(["FINALIZADA", "PARCIAL"]).default("PARCIAL"),
  tarefaId: z.string().optional(),
});

const pendenciaSchema = z.object({
  descricao: z.string().min(1),
  observacao: z.string().optional(),
});

const createRdoSchema = z.object({
  obraId: z.string().min(1),
  data: z.string(),
  clima: z.enum(["SOL", "NUBLADO", "CHUVA", "TEMPO_RUIM"]).default("SOL"),
  horarioInicio: z.string().optional(),
  horarioTermino: z.string().optional(),
  houveParalisacao: z.boolean().default(false),
  horarioParalisacao: z.string().optional(),
  motivoParalisacao: z.string().optional(),
  observacoes: z.string().optional(),
  trabalhadores: z.array(trabalhadorSchema).default([]),
  atividades: z.array(atividadeSchema).default([]),
  pendencias: z.array(pendenciaSchema).default([]),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const rdos = await prisma.rdo.findMany({
    where: { obraId },
    include: {
      autor: { select: { name: true } },
      trabalhadores: true,
      atividades: { include: { tarefa: { select: { id: true, titulo: true } } } },
      pendencias: true,
      fotos: true,
    },
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
      horarioInicio: parsed.data.horarioInicio,
      horarioTermino: parsed.data.horarioTermino,
      houveParalisacao: parsed.data.houveParalisacao,
      horarioParalisacao: parsed.data.horarioParalisacao,
      motivoParalisacao: parsed.data.motivoParalisacao,
      observacoes: parsed.data.observacoes,
      autorId: (session.user as any).id,
      trabalhadores: { create: parsed.data.trabalhadores },
      atividades: { create: parsed.data.atividades },
      pendencias: { create: parsed.data.pendencias },
    },
    include: { trabalhadores: true, atividades: true, pendencias: true },
  });

  return NextResponse.json(rdo, { status: 201 });
}
