import TopBar from "@/components/TopBar";
import TarefasTodas from "@/components/TarefasTodas";

export default function TarefasPage() {
  return (
    <div>
      <TopBar title="Tarefas (todas)" subtitle="Kanban de todas as obras" />
      <TarefasTodas />
    </div>
  );
}
