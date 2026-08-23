import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const arquivo = await prisma.arquivo.findUnique({ where: { id: params.id } });
  if (!arquivo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const bytes = await readFile(path.join(UPLOAD_DIR, arquivo.url));
  return new NextResponse(bytes, {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeURIComponent(arquivo.nome)}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
