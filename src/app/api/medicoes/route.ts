import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  obraId: z.string().min(1),
  numero: z.number().int().positive().optional(),
  data: z.string(),
  descricao: z.string().optional(),
  valor: z.number().nonnegative(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const medicoes = await prisma.medicao.findMany({ where: { obraId }, orderBy: { data: "asc" } });
  return NextResponse.json(medicoes);
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

  // numero automático (próximo) se não informado
  let numero = parsed.data.numero;
  if (!numero) {
    const ultima = await prisma.medicao.findFirst({
      where: { obraId: parsed.data.obraId },
      orderBy: { numero: "desc" },
    });
    numero = (ultima?.numero ?? 0) + 1;
  }

  const medicao = await prisma.medicao.create({
    data: {
      obraId: parsed.data.obraId,
      numero,
      data: new Date(parsed.data.data),
      descricao: parsed.data.descricao,
      valor: parsed.data.valor,
    },
  });
  return NextResponse.json(medicao, { status: 201 });
}
