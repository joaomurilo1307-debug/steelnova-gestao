import CustosObra from "@/components/CustosObra";

export default function ObraCustosPage({ params }: { params: { id: string } }) {
  return <CustosObra obraId={params.id} />;
}
