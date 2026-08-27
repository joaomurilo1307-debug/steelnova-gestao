import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurvaSData } from "@/lib/curvaS";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data = await getCurvaSData(params.id);
  if (!data) return NextResponse.json({ error: "obra não encontrada" }, { status: 404 });
  return NextResponse.json(data);
}
