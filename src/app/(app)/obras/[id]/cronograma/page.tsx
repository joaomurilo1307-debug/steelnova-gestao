import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Cronograma from "@/components/Cronograma";

export const dynamic = "force-dynamic";

export default async function ObraCronogramaPage({ params }: { params: { id: string } }) {
  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    select: { dataInicio: true, prazoPrevistoDias: true },
  });
  if (!obra) notFound();

  return (
    <Cronograma
      obraId={params.id}
      obraInicio={obra.dataInicio.toISOString()}
      obraPrazoDias={obra.prazoPrevistoDias}
    />
  );
}
