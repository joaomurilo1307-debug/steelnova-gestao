import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  nome: z.string().min(1),
  regime: z.enum(["Diaria", "Fixo"]).default("Diaria"),
  diariaPadrao: z.number().nonnegative().optional(),
  valorFixo: z.number().nonnegative().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const funcionarios = await prisma.funcionario.findMany({ where: { active: true }, orderBy: { nome: "asc" } });
  return NextResponse.json(funcionarios);
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

  const funcionario = await prisma.funcionario.create({ data: parsed.data });
  return NextResponse.json(funcionario, { status: 201 });
}
