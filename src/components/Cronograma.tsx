"use client";

import { useEffect, useState } from "react";
import GanttChart from "@/components/GanttChart";

type Tarefa = {
  id: string;
  eap: string | null;
  fase: string | null;
  titulo: string;
  status: string;
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  pessoas: number | null;
  horas: string | null;
  turno: string | null;
  responsavelNome: string | null;
  observacoes: string | null;
  responsavel: { id: string; name: string } | null;
  dataInicioReal: string | null;
  dataFimReal: string | null;
};

function addDias(iso: string, dias: number) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d;
}

function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const STATUS_LABEL: Record<string, string> = {
  A_FAZER: "A fazer",
  FAZENDO: "Fazendo",
  BLOQUEADO: "Bloqueado",
  FEITO: "Feito",
};

const STATUS_BADGE: Record<string, string> = {
  A_FAZER: "bg-neutral-200 text-neutral-700",
  FAZENDO: "bg-blue-100 text-blue-700",
  BLOQUEADO: "bg-rose-100 text-rose-700",
  FEITO: "bg-emerald-100 text-emerald-700",
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
  const [membros, setMembros] = useState<{ userId: string; nome: string }[]>([]);
  const [form, setForm] = useState({
    eap: "",
    fase: "",
    titulo: "",
    dataInicio: "",
    duracaoDias: "1",
    pessoas: "",
    horas: "",
    turno: "Dia",
    responsavelId: "",
    observacoes: "",
  });
  const [showForm, setShowForm] = useState(false);

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
        pessoas: form.pessoas ? Number(form.pessoas) : undefined,
        horas: form.horas ? Number(form.horas) : undefined,
        turno: form.turno || undefined,
        responsavelId: form.responsavelId || undefined,
        observacoes: form.observacoes || undefined,
      }),
    });
    if (res.ok) {
      setForm({ eap: "", fase: "", titulo: "", dataInicio: "", duracaoDias: "1", pessoas: "", horas: "", turno: "Dia", responsavelId: "", observacoes: "" });
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

  async function handleRealDate(id: string, field: "dataInicioReal" | "dataFimReal", value: string) {
    await fetch(`/api/tarefas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover essa atividade?")) return;
    const res = await fetch(`/api/tarefas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const totalHH = tarefas.reduce((s, t) => s + (t.pessoas ?? 0) * Number(t.horas ?? 0), 0);

  // pico real = maior soma de "pessoas" entre tarefas com período sobreposto (dia a dia)
  const inicioObraCalc = new Date(obraInicio);
  let totalPessoasPico = 0;
  for (let dia = 0; dia < obraPrazoDias + 5; dia++) {
    const pessoasNoDia = tarefas.reduce((s, t) => {
      if (!t.pessoas || !t.dataInicio) return s;
      const offset = Math.max(0, diffDias(inicioObraCalc, new Date(t.dataInicio)));
      const ativo = dia >= offset && dia < offset + t.duracaoDias;
      return ativo ? s + t.pessoas : s;
    }, 0);
    totalPessoasPico = Math.max(totalPessoasPico, pessoasNoDia);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
          <span className="text-neutral-500">Atividades: </span>
          <span className="font-medium text-fg">{tarefas.length}</span>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
          <span className="text-neutral-500">Esforço total: </span>
          <span className="font-medium text-fg">{totalHH.toFixed(0)} HH</span>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2">
          <span className="text-neutral-500">Pico de equipe: </span>
          <span className="font-medium text-fg">{totalPessoasPico} pessoas</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {showForm ? "Fechar formulário" : "+ Nova atividade"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-ink-800 bg-ink-900 p-4 sm:grid-cols-4 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">EAP</label>
            <input value={form.eap} onChange={(e) => setForm({ ...form, eap: e.target.value })} placeholder="1.0" className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Fase</label>
            <input value={form.fase} onChange={(e) => setForm({ ...form, fase: e.target.value })} placeholder="Fabricação" className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Atividade</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Início</label>
            <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Duração (dias)</label>
            <input type="number" min={1} value={form.duracaoDias} onChange={(e) => setForm({ ...form, duracaoDias: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Pessoas</label>
            <input type="number" min={0} value={form.pessoas} onChange={(e) => setForm({ ...form, pessoas: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Horas</label>
            <input type="number" step="0.5" min={0} value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Turno</label>
            <select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand">
              <option>Dia</option>
              <option>Noite</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Responsável (equipe da obra)</label>
            <select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand">
              <option value="">Sem responsável</option>
              {membros.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-neutral-500">Observações</label>
            <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="w-full rounded-lg border border-ink-700 bg-ink-800 px-2 py-1.5 text-sm text-fg outline-none focus:border-brand" />
          </div>
          <button type="submit" className="col-span-2 self-end rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark sm:col-span-1">
            Adicionar
          </button>
        </form>
      )}

      <div className="mb-6 overflow-x-auto rounded-xl border border-ink-800 bg-ink-900">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-3 font-medium">EAP</th>
              <th className="px-3 py-3 font-medium">Fase</th>
              <th className="px-3 py-3 font-medium">Atividade</th>
              <th className="px-3 py-3 font-medium">Turno</th>
              <th className="px-3 py-3 font-medium">Pessoas</th>
              <th className="px-3 py-3 font-medium">Horas</th>
              <th className="px-3 py-3 font-medium">HH</th>
              <th className="px-3 py-3 font-medium">Responsável</th>
              <th className="px-3 py-3 font-medium">Início prev.</th>
              <th className="px-3 py-3 font-medium">Término prev.</th>
              <th className="px-3 py-3 font-medium">Início real</th>
              <th className="px-3 py-3 font-medium">Término real</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">% Concl.</th>
              <th className="px-3 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => (
              <tr key={t.id} className="border-t border-ink-800">
                <td className="px-3 py-2.5 text-neutral-600">{t.eap ?? "—"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{t.fase ?? "—"}</td>
                <td className="px-3 py-2.5 text-fg">
                  {t.titulo}
                  {t.observacoes && <p className="text-xs text-neutral-500">{t.observacoes}</p>}
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{t.turno ?? "—"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{t.pessoas ?? "—"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{t.horas ?? "—"}</td>
                <td className="px-3 py-2.5 font-medium text-fg">
                  {t.pessoas && t.horas ? (t.pessoas * Number(t.horas)).toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{t.responsavelNome ?? t.responsavel?.name ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-neutral-600">
                  {t.dataInicio ? fmt(new Date(t.dataInicio)) : "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-neutral-600">
                  {t.dataInicio ? fmt(addDias(t.dataInicio, t.duracaoDias - 1)) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="date"
                    defaultValue={t.dataInicioReal ? t.dataInicioReal.slice(0, 10) : ""}
                    onBlur={(e) => handleRealDate(t.id, "dataInicioReal", e.target.value)}
                    className="w-32 rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-fg outline-none focus:border-brand"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="date"
                    defaultValue={t.dataFimReal ? t.dataFimReal.slice(0, 10) : ""}
                    onBlur={(e) => handleRealDate(t.id, "dataFimReal", e.target.value)}
                    className="w-32 rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-fg outline-none focus:border-brand"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status] ?? ""}`}>
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={t.percentConcluido}
                    onBlur={(e) => handlePercent(t.id, Number(e.target.value))}
                    className="w-16 rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-fg outline-none focus:border-brand"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => handleDelete(t.id)} className="text-xs text-red-600 hover:underline">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {tarefas.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma atividade cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <GanttChart tarefas={tarefas} obraInicio={obraInicio} obraPrazoDias={obraPrazoDias} />
    </div>
  );
}
