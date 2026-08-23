import EquipeObra from "@/components/EquipeObra";

export default function ObraEquipePage({ params }: { params: { id: string } }) {
  return <EquipeObra obraId={params.id} />;
}
