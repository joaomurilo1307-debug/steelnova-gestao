import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createObraSchema = z.object({
  nome: z.string().min(1),
  cliente: z.string().min(1),
  endereco: z.string().optional(),
  valorContrato: z.number().nonnegative(),
  dataInicio: z.string(),
  prazoPrevistoDias: z.number().int().positive(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const obras = await prisma.obra.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(obras);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createObraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const obra = await prisma.obra.create({
    data: {
      nome: parsed.data.nome,
      cliente: parsed.data.cliente,
      endereco: parsed.data.endereco,
      valorContrato: parsed.data.valorContrato,
      dataInicio: new Date(parsed.data.dataInicio),
      prazoPrevistoDias: parsed.data.prazoPrevistoDias,
    },
  });

  return NextResponse.json(obra, { status: 201 });
}
