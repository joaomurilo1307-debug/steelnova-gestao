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
import Avatar from "@/components/Avatar";

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: "A_FAZER" | "FAZENDO" | "BLOQUEADO" | "FEITO";
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  responsavelId: string | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
};

const COLUNAS: { key: Tarefa["status"]; label: string; dot: string; accent: string }[] = [
  { key: "A_FAZER", label: "A fazer", dot: "bg-neutral-400", accent: "border-l-neutral-400" },
  { key: "FAZENDO", label: "Fazendo", dot: "bg-blue-500", accent: "border-l-blue-500" },
  { key: "BLOQUEADO", label: "Bloqueado", dot: "bg-rose-500", accent: "border-l-rose-500" },
  { key: "FEITO", label: "Feito", dot: "bg-emerald-500", accent: "border-l-emerald-500" },
];

const MS_DIA = 86400000;

function dueInfo(t: Tarefa) {
  if (!t.dataInicio) return null;
  const fim = new Date(t.dataInicio);
  fim.setUTCDate(fim.getUTCDate() + t.duracaoDias);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((fim.getTime() - hoje.getTime()) / MS_DIA);
  const atrasada = fim < hoje && t.status !== "FEITO";
  return { texto: fim.toLocaleDateString("pt-BR", { timeZone: "UTC" }), atrasada, diasAtraso: -diff };
}

function TaskCard({ tarefa, accent, onClick }: { tarefa: Tarefa; accent: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10 } : undefined;
  const due = dueInfo(tarefa);
  const feito = tarefa.status === "FEITO";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab rounded-xl border border-l-4 ${accent} ${
        due?.atrasada ? "border-red-300 bg-red-50/60" : "border-ink-700 bg-ink-900"
      } p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${isDragging ? "opacity-60" : ""}`}
    >
      {due?.atrasada && (
        <span className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
          ⚠ Atrasada {due.diasAtraso}d
        </span>
      )}
      <p className={`text-sm font-medium leading-snug ${feito ? "text-neutral-400 line-through" : "text-fg"}`}>{tarefa.titulo}</p>

      {tarefa.percentConcluido > 0 && !feito && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-brand" style={{ width: `${tarefa.percentConcluido}%` }} />
          </div>
          <span className="text-[10px] font-semibold text-neutral-500">{tarefa.percentConcluido}%</span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        {tarefa.responsavel ? (
          <Avatar name={tarefa.responsavel.name} photoUrl={tarefa.responsavel.avatarUrl} size={24} className="text-[9px]" />
        ) : (
          <span className="text-[10px] text-neutral-400">sem responsável</span>
        )}
        {due && (
          <span className={`inline-flex items-center gap-1 text-xs ${due.atrasada ? "font-semibold text-red-600" : "text-neutral-500"}`}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {due.texto}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ col, tarefas, onCardClick }: { col: (typeof COLUNAS)[number]; tarefas: Tarefa[]; onCardClick: (t: Tarefa) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  const atrasadas = tarefas.filter((t) => dueInfo(t)?.atrasada).length;

  return (
    <div ref={setNodeRef} className={`flex w-72 shrink-0 flex-col rounded-2xl border border-ink-800 bg-ink-950 p-3 ${isOver ? "ring-2 ring-brand" : ""}`}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
        <p className="text-sm font-semibold text-fg">{col.label}</p>
        {atrasadas > 0 && (
          <span className="rounded-md bg-red-100 px-1.5 text-[10px] font-bold text-red-700">{atrasadas} atras.</span>
        )}
        <span className="ml-auto rounded-full bg-ink-800 px-2 text-xs text-neutral-500">{tarefas.length}</span>
      </div>
      <div className="flex min-h-[40px] flex-col gap-2.5">
        {tarefas.map((t) => (
          <TaskCard key={t.id} tarefa={t} accent={col.accent} onClick={() => onCardClick(t)} />
        ))}
        {tarefas.length === 0 && <p className="px-1 py-3 text-center text-xs text-neutral-400">vazio</p>}
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
    const [tRes, oRes] = await Promise.all([fetch(`/api/tarefas?obraId=${obraId}`), fetch(`/api/obras/${obraId}`)]);
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

  const atrasadas = tarefas.filter((t) => dueInfo(t)?.atrasada);

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-[1px]">
          {atrasadas.length > 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              <span className="text-base">⚠</span>
              <span><b>{atrasadas.length} tarefa{atrasadas.length > 1 ? "s" : ""} em atraso</b> — priorize as marcadas em vermelho.</span>
            </div>
          ) : (
            membros.length === 0 && (
              <p className="text-xs text-neutral-500">Cadastre membros na aba Equipe pra atribuir responsáveis.</p>
            )
          )}
        </div>
        <button onClick={() => setModalTarefa(null)} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + Nova tarefa
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS.map((col) => (
            <Column key={col.key} col={col} tarefas={tarefas.filter((t) => t.status === col.key)} onCardClick={(t) => setModalTarefa(t)} />
          ))}
        </div>
      </DndContext>

      {modalTarefa !== undefined && (
        <TaskModal obraId={obraId} membros={membros} tarefa={modalTarefa} onClose={() => setModalTarefa(undefined)} onSaved={load} />
      )}
    </div>
  );
}
