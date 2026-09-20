import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  funcionarioId: z.string().optional(),
  nome: z.string().min(1),
  funcao: z.string().optional(),
  entrada: z.string().min(1), // HH:MM (hora local do celular)
});

// Registra a ENTRADA de uma pessoa no RDO do dia (abre a contagem dela)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as any).role === "VISUALIZADOR") return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const t = await prisma.rdoTrabalhador.create({
    data: {
      rdoId: params.id,
      nome: parsed.data.nome,
      funcao: parsed.data.funcao || "—",
      entrada: parsed.data.entrada,
      saida: null,
      funcionarioId: parsed.data.funcionarioId || null,
    },
  });
  return NextResponse.json(t, { status: 201 });
}
