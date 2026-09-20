import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const incl = {
  trabalhadores: { orderBy: { id: "asc" as const } },
};

// data = "YYYY-MM-DD" do dia local do celular
const schema = z.object({ obraId: z.string().min(1), data: z.string().min(8), clima: z.enum(["SOL", "NUBLADO", "CHUVA", "TEMPO_RUIM"]).optional() });

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const obraId = searchParams.get("obraId");
  const data = searchParams.get("data");
  if (!obraId || !data) return NextResponse.json({ error: "obraId e data obrigatórios" }, { status: 400 });
  const rdo = await prisma.rdo.findUnique({
    where: { obraId_data: { obraId, data: new Date(data) } },
    include: incl,
  });
  return NextResponse.json(rdo);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = new Date(parsed.data.data);

  let rdo = await prisma.rdo.findUnique({ where: { obraId_data: { obraId: parsed.data.obraId, data } }, include: incl });
  if (!rdo) {
    rdo = await prisma.rdo.create({
      data: { obraId: parsed.data.obraId, data, clima: parsed.data.clima ?? "SOL", autorId: (session.user as any).id },
      include: incl,
    });
  } else if (parsed.data.clima) {
    rdo = await prisma.rdo.update({ where: { id: rdo.id }, data: { clima: parsed.data.clima }, include: incl });
  }
  return NextResponse.json(rdo);
}
