import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ descricao: z.string().min(1), observacao: z.string().optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const p = await prisma.rdoPendencia.create({
    data: { rdoId: params.id, descricao: parsed.data.descricao, observacao: parsed.data.observacao || null },
  });
  return NextResponse.json(p, { status: 201 });
}
