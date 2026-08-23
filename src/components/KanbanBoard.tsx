"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import TaskModal from "@/components/TaskModal";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "A_FAZER" | "FAZENDO" | "BLOQUEADO" | "FEITO";
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  responsavelId: string | null;
  responsavel: { id: string; name: string } | null;
};

const COLUNAS: { key: Tarefa["status"]; label: string; accent: string }[] = [
  { key: "A_FAZER", label: "A fazer", accent: "bg-neutral-500" },
  { key: "FAZENDO", label: "Fazendo", accent: "bg-blue-500" },
  { key: "BLOQUEADO", label: "Bloqueado", accent: "bg-rose-500" },
  { key: "FEITO", label: "Feito", accent: "bg-emerald-500" },
];

function prazoLabel(t: Tarefa) {
  if (!t.dataInicio) return null;
  const fim = new Date(t.dataInicio);
  fim.setUTCDate(fim.getUTCDate() + t.duracaoDias);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const atrasada = fim < hoje && t.status !== "FEITO";
  return { texto: fim.toLocaleDateString("pt-BR", { timeZone: "UTC" }), atrasada };
}

function TaskCard({ tarefa, onClick }: { tarefa: Tarefa; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;
  const prazo = prazoLabel(tarefa);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab rounded-lg border border-ink-700 bg-ink-800 p-3 text-sm text-fg active:cursor-grabbing ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <p>{tarefa.titulo}</p>
      <div className="mt-1.5 flex items-center justify-between">
        {tarefa.responsavel ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-white">
            {tarefa.responsavel.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
        ) : (
          <span />
        )}
        {prazo && (
          <span className={`text-xs ${prazo.atrasada ? "font-medium text-red-600" : "text-neutral-500"}`}>
            {prazo.texto}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ col, tarefas, onCardClick }: { col: (typeof COLUNAS)[number]; tarefas: Tarefa[]; onCardClick: (t: Tarefa) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border border-ink-800 bg-ink-900 p-3 ${
        isOver ? "ring-1 ring-brand" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${col.accent}`} />
        <p className="text-sm font-medium text-fg">{col.label}</p>
        <span className="ml-auto text-xs text-neutral-500">{tarefas.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tarefas.map((t) => (
          <TaskCard key={t.id} tarefa={t} onClick={() => onCardClick(t)} />
        ))}
      </div>
    </div>
  );
}

export default function KanbanBoard({ obraId }: { obraId: string }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [membros, setMembros] = useState<{ userId: string; nome: string }[]>([]);
  const [modalTarefa, setModalTarefa] = useState<Tarefa | null | undefined>(undefined);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    const [tRes, oRes] = await Promise.all([
      fetch(`/api/tarefas?obraId=${obraId}`),
      fetch(`/api/obras/${obraId}`),
    ]);
    if (tRes.ok) setTarefas(await tRes.json());
    if (oRes.ok) {
      const obra = await oRes.json();
      setMembros(obra.membros.map((m: any) => ({ userId: m.user.id, nome: m.user.name })));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const novoStatus = over.id as Tarefa["status"];
    const tarefa = tarefas.find((t) => t.id === active.id);
    if (!tarefa || tarefa.status === novoStatus) return;

    setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? { ...t, status: novoStatus } : t)));
    await fetch(`/api/tarefas/${tarefa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    });
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        {membros.length === 0 && (
          <p className="text-xs text-neutral-500">
            Nenhum membro na equipe da obra ainda — cadastre na aba Equipe pra poder atribuir responsáveis.
          </p>
        )}
        <button
          onClick={() => setModalTarefa(null)}
          className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Nova tarefa
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((col) => (
            <Column
              key={col.key}
              col={col}
              tarefas={tarefas.filter((t) => t.status === col.key)}
              onCardClick={(t) => setModalTarefa(t)}
            />
          ))}
        </div>
      </DndContext>

      {modalTarefa !== undefined && (
        <TaskModal
          obraId={obraId}
          membros={membros}
          tarefa={modalTarefa}
          onClose={() => setModalTarefa(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}
