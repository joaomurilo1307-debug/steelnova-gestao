import MateriaisObra from "@/components/MateriaisObra";

export default function ObraMateriaisPage({ params }: { params: { id: string } }) {
  return <MateriaisObra obraId={params.id} />;
}
