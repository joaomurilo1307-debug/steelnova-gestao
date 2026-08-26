import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  descricao: z.string().min(1),
  categoria: z.string().optional(),
  valor: z.number().nonnegative(),
  dataCompra: z.string(),
  vidaUtilMeses: z.number().int().positive().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const aquisicoes = await prisma.aquisicao.findMany({ orderBy: { dataCompra: "desc" } });
  return NextResponse.json(aquisicoes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const aquisicao = await prisma.aquisicao.create({
    data: {
      descricao: parsed.data.descricao,
      categoria: parsed.data.categoria ?? "Equipamento",
      valor: parsed.data.valor,
      dataCompra: new Date(parsed.data.dataCompra),
      vidaUtilMeses: parsed.data.vidaUtilMeses ?? 24,
    },
  });
  return NextResponse.json(aquisicao, { status: 201 });
}
