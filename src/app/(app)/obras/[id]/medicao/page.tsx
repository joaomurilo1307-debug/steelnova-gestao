import MedicaoObra from "@/components/MedicaoObra";

export default function ObraMedicaoPage({ params }: { params: { id: string } }) {
  return <MedicaoObra obraId={params.id} />;
}
