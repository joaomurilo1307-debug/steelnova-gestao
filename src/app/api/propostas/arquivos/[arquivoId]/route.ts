import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export async function GET(_req: Request, { params }: { params: { arquivoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const arquivo = await prisma.propostaArquivo.findUnique({ where: { id: params.arquivoId } });
  if (!arquivo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const bytes = await readFile(path.join(UPLOAD_DIR, arquivo.url));
  return new NextResponse(bytes, {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(arquivo.nome)}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { arquivoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const arquivo = await prisma.propostaArquivo.findUnique({ where: { id: params.arquivoId } });
  if (!arquivo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await prisma.propostaArquivo.delete({ where: { id: params.arquivoId } });
  try {
    await unlink(path.join(UPLOAD_DIR, arquivo.url));
  } catch {}

  return NextResponse.json({ ok: true });
}
