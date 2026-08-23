import TarefaListView from "@/components/TarefaListView";

export default function ObraListaPage({ params }: { params: { id: string } }) {
  return <TarefaListView obraId={params.id} />;
}
