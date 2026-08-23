import OrcamentoObra from "@/components/OrcamentoObra";

export default function ObraOrcamentoPage({ params }: { params: { id: string } }) {
  return <OrcamentoObra obraId={params.id} />;
}
