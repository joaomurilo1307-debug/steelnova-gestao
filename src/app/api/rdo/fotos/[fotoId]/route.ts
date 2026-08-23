import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

export async function GET(_req: Request, { params }: { params: { fotoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const foto = await prisma.rdoFoto.findUnique({ where: { id: params.fotoId } });
  if (!foto) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  const bytes = await readFile(path.join(UPLOAD_DIR, foto.url));
  const ext = path.extname(foto.url).toLowerCase();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { fotoId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const foto = await prisma.rdoFoto.findUnique({ where: { id: params.fotoId } });
  if (!foto) return NextResponse.json({ error: "não encontrada" }, { status: 404 });

  await prisma.rdoFoto.delete({ where: { id: params.fotoId } });
  try {
    await unlink(path.join(UPLOAD_DIR, foto.url));
  } catch {}

  return NextResponse.json({ ok: true });
}
