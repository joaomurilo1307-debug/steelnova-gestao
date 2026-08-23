import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  obraId: z.string().min(1),
  pessoa: z.string().min(1),
  item: z.string().min(1),
  categoria: z.string().min(1),
  valor: z.number().nonnegative(),
  data: z.string().optional(),
  funcionarioRefId: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const desembolsos = await prisma.desembolso.findMany({
    where: { obraId },
    include: { funcionarioRef: true },
    orderBy: { data: "desc" },
  });
  return NextResponse.json(desembolsos);
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

  const desembolso = await prisma.desembolso.create({
    data: {
      obraId: parsed.data.obraId,
      pessoa: parsed.data.pessoa,
      item: parsed.data.item,
      categoria: parsed.data.categoria,
      valor: parsed.data.valor,
      data: parsed.data.data ? new Date(parsed.data.data) : undefined,
      funcionarioRefId: parsed.data.funcionarioRefId ?? undefined,
    },
  });

  return NextResponse.json(desembolso, { status: 201 });
}
