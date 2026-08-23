"use client";

import { useEffect, useState } from "react";

type Membro = { userId: string; nome: string };

type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  responsavelId: string | null;
};

const STATUS_OPTIONS = [
  { value: "A_FAZER", label: "A fazer" },
  { value: "FAZENDO", label: "Fazendo" },
  { value: "BLOQUEADO", label: "Bloqueado" },
  { value: "FEITO", label: "Feito" },
];

export default function TaskModal({
  obraId,
  membros,
  tarefa,
  onClose,
  onSaved,
}: {
  obraId: string;
  membros: Membro[];
  tarefa: Tarefa | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? "",
    descricao: tarefa?.descricao ?? "",
    status: tarefa?.status ?? "A_FAZER",
    responsavelId: tarefa?.responsavelId ?? "",
    dataInicio: tarefa?.dataInicio ? tarefa.dataInicio.slice(0, 10) : "",
    duracaoDias: String(tarefa?.duracaoDias ?? 1),
    percentConcluido: String(tarefa?.percentConcluido ?? 0),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);

    if (tarefa) {
      await fetch(`/api/tarefas/${tarefa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          status: form.status,
          responsavelId: form.responsavelId || null,
          dataInicio: form.dataInicio || undefined,
          duracaoDias: Number(form.duracaoDias) || 1,
          percentConcluido: Number(form.percentConcluido) || 0,
        }),
      });
    } else {
      await fetch("/api/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          obraId,
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          status: form.status,
          responsavelId: form.responsavelId || undefined,
          dataInicio: form.dataInicio || undefined,
          duracaoDias: Number(form.duracaoDias) || 1,
        }),
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!tarefa) return;
    if (!confirm("Excluir essa tarefa?")) return;
    await fetch(`/api/tarefas/${tarefa.id}`, { method: "DELETE" });
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-ink-700 bg-ink-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">{tarefa ? "Editar tarefa" : "Nova tarefa"}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-fg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Responsável (equipe da obra)</label>
              <select
                value={form.responsavelId}
                onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
              >
                <option value="">Sem responsável</option>
                {membros.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Início</label>
              <input
                type="date"
                value={form.dataInicio}
                onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Prazo (dias)</label>
              <input
                type="number"
                min={1}
                value={form.duracaoDias}
                onChange={(e) => setForm({ ...form, duracaoDias: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">% Concluído</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.percentConcluido}
                onChange={(e) => setForm({ ...form, percentConcluido: e.target.value })}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between">
            {tarefa ? (
              <button type="button" onClick={handleDelete} className="text-sm text-red-600 hover:underline">
                Excluir tarefa
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-fg hover:bg-ink-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
