import ArquivosObra from "@/components/ArquivosObra";

export default function ObraArquivosPage({ params }: { params: { id: string } }) {
  return <ArquivosObra obraId={params.id} />;
}
