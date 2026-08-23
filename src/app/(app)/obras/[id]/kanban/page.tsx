import KanbanBoard from "@/components/KanbanBoard";

export default function ObraKanbanPage({ params }: { params: { id: string } }) {
  return <KanbanBoard obraId={params.id} />;
}
