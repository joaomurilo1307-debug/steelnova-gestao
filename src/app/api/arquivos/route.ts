import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const CATEGORIAS = ["NOTA_FISCAL", "PLANILHA_HORARIOS", "PROJETO", "FOTO", "OUTRO"] as const;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  if (!obraId) return NextResponse.json({ error: "obraId obrigatório" }, { status: 400 });

  const arquivos = await prisma.arquivo.findMany({
    where: { obraId },
    include: { uploadadoPor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(arquivos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const obraId = form.get("obraId");
  const categoriaRaw = form.get("categoria");

  if (!(file instanceof File) || typeof obraId !== "string" || !obraId) {
    return NextResponse.json({ error: "arquivo e obraId são obrigatórios" }, { status: 400 });
  }
  const categoria = CATEGORIAS.includes(categoriaRaw as any) ? (categoriaRaw as string) : "OUTRO";

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name);
  const storedName = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);

  const arquivo = await prisma.arquivo.create({
    data: {
      obraId,
      nome: file.name,
      categoria: categoria as any,
      url: storedName,
      tamanho: bytes.byteLength,
      uploadadoPorId: (session.user as any).id,
    },
  });

  return NextResponse.json(arquivo, { status: 201 });
}
