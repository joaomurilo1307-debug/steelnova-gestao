import DiariasObra from "@/components/DiariasObra";

export default function ObraDiariasPage({ params }: { params: { id: string } }) {
  return <DiariasObra obraId={params.id} />;
}
