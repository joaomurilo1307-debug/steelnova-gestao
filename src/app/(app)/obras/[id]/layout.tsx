import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";
import ObraTabs from "@/components/ObraTabs";
import { obraStatusLabel } from "@/lib/format";

export default async function ObraLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    select: { id: true, nome: true, cliente: true, status: true },
  });

  if (!obra) notFound();

  return (
    <div>
      <TopBar title={obra.nome} subtitle={`${obra.cliente} · ${obraStatusLabel(obra.status)}`} />
      <ObraTabs obraId={obra.id} />
      {children}
    </div>
  );
}
