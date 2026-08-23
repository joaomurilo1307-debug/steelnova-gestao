import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  cliente: z.string().min(1).optional(),
  contato: z.string().nullable().optional(),
  segmento: z.string().nullable().optional(),
  escopo: z.string().min(1).optional(),
  valor: z.number().nonnegative().nullable().optional(),
  custoEstimado: z.number().nonnegative().nullable().optional(),
  status: z.enum(["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO", "APROVADA", "RECUSADA", "CONVERTIDA"]).optional(),
  dataEnvio: z.string().nullable().optional(),
  validade: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  motivoPerda: z.string().nullable().optional(),
  responsavelId: z.string().nullable().optional(),
  obraId: z.string().nullable().optional(),
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
  if (data.dataEnvio) data.dataEnvio = new Date(data.dataEnvio);
  if (data.validade) data.validade = new Date(data.validade);

  const proposta = await prisma.proposta.update({ where: { id: params.id }, data });
  return NextResponse.json(proposta);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.proposta.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
