"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import Avatar from "@/components/Avatar";
import { personColor } from "@/lib/personColor";

type Tarefa = {
  id: string;
  titulo: string;
  status: "A_FAZER" | "FAZENDO" | "BLOQUEADO" | "FEITO";
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  dataInicio: string | null;
  duracaoDias: number;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  obra: { id: string; nome: string };
};

const COLUNAS: { key: Tarefa["status"]; label: string; accent: string }[] = [
  { key: "A_FAZER", label: "A fazer", accent: "bg-neutral-500" },
  { key: "FAZENDO", label: "Fazendo", accent: "bg-blue-500" },
  { key: "BLOQUEADO", label: "Bloqueado", accent: "bg-rose-500" },
  { key: "FEITO", label: "Feito", accent: "bg-emerald-500" },
];

const PRIORIDADE_LABEL: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" };
const PRIORIDADE_COLOR: Record<string, string> = {
  BAIXA: "bg-neutral-200 text-neutral-700",
  MEDIA: "bg-blue-100 text-blue-700",
  ALTA: "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
};

function prazoInfo(t: Tarefa) {
  if (!t.dataInicio) return null;
  const fim = new Date(t.dataInicio.slice(0, 10) + "T00:00:00");
  fim.setDate(fim.getDate() + t.duracaoDias - 1);
  const atrasada = fim < new Date(new Date().toDateString()) && t.status !== "FEITO";
  return { texto: fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), atrasada };
}

function TaskCard({ tarefa, onPrioridade }: { tarefa: Tarefa; onPrioridade: (id: string, p: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 }
    : undefined;
  const prazo = prazoInfo(tarefa);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-xl bg-ink-800 p-3 text-sm text-fg shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{tarefa.titulo}</p>
        {tarefa.responsavel && (
          <Avatar
            name={tarefa.responsavel.name}
            photoUrl={tarefa.responsavel.avatarUrl}
            color={personColor(tarefa.responsavel.id)}
            size={22}
          />
        )}
      </div>
      <Link
        href={`/obras/${tarefa.obra.id}/kanban`}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 block text-xs text-brand hover:underline"
      >
        {tarefa.obra.nome}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={tarefa.prioridade}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onPrioridade(tarefa.id, e.target.value)}
          className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-semibold outline-none ${PRIORIDADE_COLOR[tarefa.prioridade]}`}
        >
          {Object.entries(PRIORIDADE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {prazo && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              prazo.atrasada ? "bg-rose-100 text-rose-700" : "bg-ink-700 text-neutral-400"
            }`}
          >
            📅 {prazo.texto}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ col, tarefas, onPrioridade }: { col: (typeof COLUNAS)[number]; tarefas: Tarefa[]; onPrioridade: (id: string, p: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col card p-3 ${
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
          <TaskCard key={t.id} tarefa={t} onPrioridade={onPrioridade} />
        ))}
      </div>
    </div>
  );
}

export default function TarefasTodas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    const res = await fetch("/api/tarefas");
    if (res.ok) setTarefas(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

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

  async function handlePrioridade(id: string, prioridade: string) {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, prioridade: prioridade as Tarefa["prioridade"] } : t)));
    await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prioridade }),
    });
  }

  return (
    <div className="p-8">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((col) => (
            <Column key={col.key} col={col} tarefas={tarefas.filter((t) => t.status === col.key)} onPrioridade={handlePrioridade} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
