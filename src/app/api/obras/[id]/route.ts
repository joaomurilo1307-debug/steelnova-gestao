import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    include: { membros: { include: { user: { select: { id: true, name: true } } } } },
  });

  if (!obra) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(obra);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  await prisma.obra.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
