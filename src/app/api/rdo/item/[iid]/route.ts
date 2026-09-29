import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { iid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  if (body?.descricao != null) data.descricao = String(body.descricao).trim();
  if (body?.quantidade !== undefined) data.quantidade = body.quantidade != null && body.quantidade !== "" ? Number(body.quantidade) : null;
  if (body?.fotoData !== undefined) data.fotoData = body.fotoData ? String(body.fotoData) : null;

  const item = await prisma.rdoItemFabricado.update({ where: { id: params.iid }, data });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { iid: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  await prisma.rdoItemFabricado.delete({ where: { id: params.iid } });
  return NextResponse.json({ ok: true });
}
