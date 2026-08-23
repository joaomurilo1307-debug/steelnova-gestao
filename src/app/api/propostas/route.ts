import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  cliente: z.string().min(1),
  contato: z.string().optional(),
  segmento: z.string().optional(),
  escopo: z.string().min(1),
  valor: z.number().nonnegative().optional(),
  status: z.enum(["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO", "APROVADA", "RECUSADA", "CONVERTIDA"]).optional(),
  dataEnvio: z.string().optional(),
  validade: z.string().optional(),
  observacoes: z.string().optional(),
  responsavelId: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const propostas = await prisma.proposta.findMany({
    include: { responsavel: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(propostas);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const proposta = await prisma.proposta.create({
    data: {
      cliente: parsed.data.cliente,
      contato: parsed.data.contato,
      segmento: parsed.data.segmento,
      escopo: parsed.data.escopo,
      valor: parsed.data.valor,
      status: parsed.data.status ?? "RASCUNHO",
      dataEnvio: parsed.data.dataEnvio ? new Date(parsed.data.dataEnvio) : undefined,
      validade: parsed.data.validade ? new Date(parsed.data.validade) : undefined,
      observacoes: parsed.data.observacoes,
      responsavelId: parsed.data.responsavelId,
    },
  });

  return NextResponse.json(proposta, { status: 201 });
}
