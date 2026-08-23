import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const addMembroSchema = z.object({
  userId: z.string().min(1),
  funcao: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = addMembroSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const membro = await prisma.obraMembro.upsert({
    where: { obraId_userId: { obraId: params.id, userId: parsed.data.userId } },
    update: { funcao: parsed.data.funcao },
    create: { obraId: params.id, userId: parsed.data.userId, funcao: parsed.data.funcao },
  });

  return NextResponse.json(membro, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });

  await prisma.obraMembro.delete({ where: { obraId_userId: { obraId: params.id, userId } } });
  return NextResponse.json({ ok: true });
}
