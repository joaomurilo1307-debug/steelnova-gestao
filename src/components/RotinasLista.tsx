"use client";

import { useEffect, useState } from "react";

type Rotina = {
  id: string;
  titulo: string;
  descricao: string | null;
  duracaoMin: number | null;
  recorrencia: "DIARIA" | "DIAS_UTEIS" | "SEMANAL" | "PONTUAL";
  diasSemana: number[];
  devidoHoje: boolean;
  concluidaHoje: boolean;
};

const RECORRENCIA_LABEL: Record<Rotina["recorrencia"], string> = {
  DIARIA: "Todo dia",
  DIAS_UTEIS: "Dias úteis",
  SEMANAL: "Semanal",
  PONTUAL: "Pontual",
};
const DIAS_LABEL = ["D", "S", "T", "Q", "Q", "S", "S"];

function hojeLocal() {
  // yyyy-mm-dd no fuso do navegador (não UTC) — sv-SE formata como ISO por padrão
  return new Date().toLocaleDateString("sv-SE");
}

export default function RotinasLista() {
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    duracaoMin: "",
    recorrencia: "DIARIA" as Rotina["recorrencia"],
    diasSemana: [] as number[],
  });
  const hoje = hojeLocal();

  async function load() {
    const res = await fetch(`/api/rotinas?data=${hoje}`);
    if (res.ok) setRotinas(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(r: Rotina) {
    setRotinas((prev) => prev.map((x) => (x.id === r.id ? { ...x, concluidaHoje: !x.concluidaHoje } : x)));
    await fetch(`/api/rotinas/${r.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: hoje, concluida: !r.concluidaHoje }),
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const res = await fetch("/api/rotinas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: form.titulo,
        duracaoMin: form.duracaoMin ? Number(form.duracaoMin) : undefined,
        recorrencia: form.recorrencia,
        diasSemana: form.recorrencia === "SEMANAL" ? form.diasSemana : undefined,
      }),
    });
    if (res.ok) {
      setForm({ titulo: "", duracaoMin: "", recorrencia: "DIARIA", diasSemana: [] });
      setShowForm(false);
      load();
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover esta rotina/tarefa?")) return;
    const res = await fetch(`/api/rotinas/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function toggleDiaSemana(d: number) {
    setForm((f) => ({ ...f, diasSemana: f.diasSemana.includes(d) ? f.diasSemana.filter((x) => x !== d) : [...f.diasSemana, d] }));
  }

  const doHoje = rotinas.filter((r) => r.devidoHoje);
  const outras = rotinas.filter((r) => !r.devidoHoje);
  const feitas = doHoje.filter((r) => r.concluidaHoje).length;

  return (
    <div className="p-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">Rotina / vida pessoal</h2>
          {doHoje.length > 0 && (
            <p className="text-xs text-neutral-500">
              {feitas} de {doHoje.length} concluída(s) hoje
            </p>
          )}
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary px-4 py-2 text-sm">
          {showForm ? "Cancelar" : "+ Nova tarefa"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 flex flex-wrap items-end gap-3 card p-4">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Título</label>
            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Academia, ler 20min, pagar contas..."
              className="w-64 pill-field px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Duração (min)</label>
            <input
              type="number"
              value={form.duracaoMin}
              onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })}
              className="w-24 pill-field px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Repetição</label>
            <select
              value={form.recorrencia}
              onChange={(e) => setForm({ ...form, recorrencia: e.target.value as Rotina["recorrencia"] })}
              className="pill-field px-3 py-2 text-sm"
            >
              {Object.entries(RECORRENCIA_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {form.recorrencia === "SEMANAL" && (
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Dias</label>
              <div className="flex gap-1">
                {DIAS_LABEL.map((l, d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDiaSemana(d)}
                    className={`h-8 w-8 rounded-full text-xs font-semibold ${
                      form.diasSemana.includes(d) ? "bg-brand text-white" : "bg-ink-800 text-neutral-400"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            Adicionar
          </button>
        </form>
      )}

      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Hoje</div>
      <div className="mb-6 card divide-y divide-ink-800">
        {doHoje.length === 0 && <p className="px-4 py-6 text-center text-sm text-neutral-500">Nada previsto pra hoje.</p>}
        {doHoje.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <input type="checkbox" checked={r.concluidaHoje} onChange={() => toggle(r)} className="h-4 w-4" />
            <div className="flex-1">
              <p className={`text-sm ${r.concluidaHoje ? "text-neutral-500 line-through" : "text-fg"}`}>{r.titulo}</p>
              <div className="mt-0.5 flex gap-2 text-[11px] text-neutral-500">
                <span>{RECORRENCIA_LABEL[r.recorrencia]}</span>
                {r.duracaoMin && <span>· {r.duracaoMin}min</span>}
              </div>
            </div>
            <button onClick={() => remover(r.id)} className="text-xs text-neutral-400 hover:text-red-500">
              Remover
            </button>
          </div>
        ))}
      </div>

      {outras.length > 0 && (
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Outros dias</div>
          <div className="card divide-y divide-ink-800">
            {outras.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 opacity-60">
                <div className="flex-1">
                  <p className="text-sm text-fg">{r.titulo}</p>
                  <div className="mt-0.5 flex gap-2 text-[11px] text-neutral-500">
                    <span>{RECORRENCIA_LABEL[r.recorrencia]}</span>
                    {r.recorrencia === "SEMANAL" && <span>({r.diasSemana.map((d) => DIAS_LABEL[d]).join(" ")})</span>}
                    {r.duracaoMin && <span>· {r.duracaoMin}min</span>}
                  </div>
                </div>
                <button onClick={() => remover(r.id)} className="text-xs text-neutral-400 hover:text-red-500">
                  Remover
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
