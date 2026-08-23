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

type Tarefa = {
  id: string;
  titulo: string;
  status: "A_FAZER" | "FAZENDO" | "BLOQUEADO" | "FEITO";
  responsavel: { id: string; name: string } | null;
};

const COLUNAS: { key: Tarefa["status"]; label: string; accent: string }[] = [
  { key: "A_FAZER", label: "A fazer", accent: "bg-neutral-500" },
  { key: "FAZENDO", label: "Fazendo", accent: "bg-blue-500" },
  { key: "BLOQUEADO", label: "Bloqueado", accent: "bg-rose-500" },
  { key: "FEITO", label: "Feito", accent: "bg-emerald-500" },
];

function TaskCard({ tarefa }: { tarefa: Tarefa }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-lg border border-ink-700 bg-ink-800 p-3 text-sm text-white active:cursor-grabbing ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <p>{tarefa.titulo}</p>
      {tarefa.responsavel && <p className="mt-1 text-xs text-neutral-500">{tarefa.responsavel.name}</p>}
    </div>
  );
}

function Column({ col, tarefas }: { col: (typeof COLUNAS)[number]; tarefas: Tarefa[] }) {
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
        <p className="text-sm font-medium text-white">{col.label}</p>
        <span className="ml-auto text-xs text-neutral-500">{tarefas.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tarefas.map((t) => (
          <TaskCard key={t.id} tarefa={t} />
        ))}
      </div>
    </div>
  );
}

export default function KanbanBoard({ obraId }: { obraId: string }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [novoTitulo, setNovoTitulo] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    const res = await fetch(`/api/tarefas?obraId=${obraId}`);
    if (res.ok) setTarefas(await res.json());
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

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!novoTitulo.trim()) return;
    const res = await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, titulo: novoTitulo }),
    });
    if (res.ok) {
      setNovoTitulo("");
      load();
    }
  }

  return (
    <div className="p-6">
      <form onSubmit={handleAddTask} className="mb-4 flex max-w-md gap-2">
        <input
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          placeholder="Nova tarefa..."
          className="flex-1 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Adicionar
        </button>
      </form>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((col) => (
            <Column key={col.key} col={col} tarefas={tarefas.filter((t) => t.status === col.key)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
