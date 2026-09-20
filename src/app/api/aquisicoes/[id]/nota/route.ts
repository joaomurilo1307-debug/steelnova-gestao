import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const TYPES: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

// Anexa a nota fiscal a uma aquisição
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "arquivo é obrigatório" }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = (path.extname(file.name) || ".pdf").toLowerCase();
  const storedName = `nf-${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));

  const aq = await prisma.aquisicao.update({ where: { id: params.id }, data: { notaFiscalUrl: storedName } });
  return NextResponse.json(aq, { status: 201 });
}

// Serve a nota fiscal anexada
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const aq = await prisma.aquisicao.findUnique({ where: { id: params.id }, select: { notaFiscalUrl: true } });
  if (!aq?.notaFiscalUrl) return NextResponse.json({ error: "sem nota" }, { status: 404 });
  try {
    const bytes = await readFile(path.join(UPLOAD_DIR, aq.notaFiscalUrl));
    const ext = path.extname(aq.notaFiscalUrl).toLowerCase();
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Content-Disposition": `inline; filename="${aq.notaFiscalUrl}"` } });
  } catch {
    return NextResponse.json({ error: "arquivo não encontrado" }, { status: 404 });
  }
}
