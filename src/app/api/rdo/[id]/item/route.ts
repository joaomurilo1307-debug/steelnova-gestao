import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await req.json();
  const descricao = String(body?.descricao ?? "").trim();
  if (!descricao) return NextResponse.json({ error: "descricao obrigatória" }, { status: 400 });

  const item = await prisma.rdoItemFabricado.create({
    data: {
      rdoId: params.id,
      descricao,
      quantidade: body?.quantidade != null && body.quantidade !== "" ? Number(body.quantidade) : null,
      fotoData: body?.fotoData ? String(body.fotoData) : null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
