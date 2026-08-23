"use client";

import { useEffect, useState } from "react";

type Tarefa = {
  id: string;
  eap: string | null;
  fase: string | null;
  titulo: string;
  status: string;
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  responsavel: { id: string; name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  A_FAZER: "A fazer",
  FAZENDO: "Fazendo",
  BLOQUEADO: "Bloqueado",
  FEITO: "Feito",
};

function diffDias(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Cronograma({
  obraId,
  obraInicio,
  obraPrazoDias,
}: {
  obraId: string;
  obraInicio: string;
  obraPrazoDias: number;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [form, setForm] = useState({ eap: "", fase: "", titulo: "", dataInicio: "", duracaoDias: "5" });

  async function load() {
    const res = await fetch(`/api/tarefas?obraId=${obraId}`);
    if (res.ok) setTarefas(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const res = await fetch("/api/tarefas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        eap: form.eap || undefined,
        fase: form.fase || undefined,
        titulo: form.titulo,
        dataInicio: form.dataInicio || undefined,
        duracaoDias: Number(form.duracaoDias),
      }),
    });
    if (res.ok) {
      setForm({ eap: "", fase: "", titulo: "", dataInicio: "", duracaoDias: "5" });
      load();
    }
  }

  async function handlePercent(id: string, percent: number) {
    await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        percentConcluido: percent,
        status: percent >= 100 ? "FEITO" : percent > 0 ? "FAZENDO" : "A_FAZER",
      }),
    });
    load();
  }

  const inicioObra = new Date(obraInicio);

  return (
    <div className="p-6">
      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">EAP</label>
          <input
            value={form.eap}
            onChange={(e) => setForm({ ...form, eap: e.target.value })}
            placeholder="1.0"
            className="w-16 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Fase</label>
          <input
            value={form.fase}
            onChange={(e) => setForm({ ...form, fase: e.target.value })}
            placeholder="Fabricação"
            className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Atividade</label>
          <input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-56 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Início</label>
          <input
            type="date"
            value={form.dataInicio}
            onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Duração (dias)</label>
          <input
            type="number"
            min={1}
            value={form.duracaoDias}
            onChange={(e) => setForm({ ...form, duracaoDias: e.target.value })}
            className="w-24 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Adicionar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">EAP</th>
              <th className="px-4 py-3 font-medium">Fase</th>
              <th className="px-4 py-3 font-medium">Atividade</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Início</th>
              <th className="px-4 py-3 font-medium">Duração</th>
              <th className="px-4 py-3 font-medium">% Concl.</th>
              <th className="px-4 py-3 font-medium">Linha do tempo</th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => {
              const inicio = t.dataInicio ? new Date(t.dataInicio) : inicioObra;
              const offset = Math.max(0, diffDias(inicioObra, inicio));
              const totalDias = Math.max(obraPrazoDias, offset + t.duracaoDias, 1);
              const leftPct = (offset / totalDias) * 100;
              const widthPct = Math.max((t.duracaoDias / totalDias) * 100, 2);

              return (
                <tr key={t.id} className="border-t border-ink-800">
                  <td className="px-4 py-3 text-neutral-400">{t.eap ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-400">{t.fase ?? "—"}</td>
                  <td className="px-4 py-3 text-white">{t.titulo}</td>
                  <td className="px-4 py-3 text-neutral-400">{STATUS_LABEL[t.status] ?? t.status}</td>
                  <td className="px-4 py-3 text-neutral-400">
                    {t.dataInicio ? new Date(t.dataInicio).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{t.duracaoDias}d</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={t.percentConcluido}
                      onBlur={(e) => handlePercent(t.id, Number(e.target.value))}
                      className="w-16 rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-white outline-none focus:border-brand"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative h-2.5 w-48 rounded-full bg-ink-800">
                      <div
                        className="absolute h-2.5 rounded-full bg-brand"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {tarefas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma atividade cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
