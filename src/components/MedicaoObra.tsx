"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Medicao = { id: string; numero: number; data: string; descricao: string | null; valor: string };

export default function MedicaoObra({ obraId }: { obraId: string }) {
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [valorContrato, setValorContrato] = useState(0);
  const [nomeObra, setNomeObra] = useState("");
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0, 10), descricao: "", valor: "" });

  async function load() {
    const [mRes, oRes] = await Promise.all([
      fetch(`/api/medicoes?obraId=${obraId}`),
      fetch(`/api/obras/${obraId}`),
    ]);
    if (mRes.ok) setMedicoes(await mRes.json());
    if (oRes.ok) {
      const o = await oRes.json();
      setValorContrato(Number(o.valorContrato ?? 0));
      setNomeObra(o.nome ?? "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.valor) return;
    const res = await fetch("/api/medicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obraId, data: form.data, descricao: form.descricao || undefined, valor: Number(form.valor) }),
    });
    if (res.ok) {
      setForm({ ...form, descricao: "", valor: "" });
      load();
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta medição?")) return;
    const res = await fetch(`/api/medicoes/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const totalMedido = medicoes.reduce((s, m) => s + Number(m.valor), 0);
  const pctMedido = valorContrato > 0 ? (totalMedido / valorContrato) * 100 : 0;
  const saldo = valorContrato - totalMedido;

  // acumulado por linha
  let acc = 0;
  const linhas = medicoes.map((m) => {
    acc += Number(m.valor);
    return { ...m, acumulado: acc, pct: valorContrato > 0 ? (acc / valorContrato) * 100 : 0 };
  });

  return (
    <div className="p-8">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Valor do contrato</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(valorContrato)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/60">Total medido</p>
          <p className="mt-0.5 text-2xl font-bold text-emerald-700">{formatBRL(totalMedido)}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/60">% medido</p>
          <p className="mt-0.5 text-2xl font-bold text-sky-700">{pctMedido.toFixed(1)}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Saldo a medir</p>
          <p className={`mt-1 text-lg font-semibold ${saldo >= 0 ? "text-fg" : "text-red-600"}`}>{formatBRL(saldo)}</p>
        </div>
      </div>

      {valorContrato > 0 && (
        <div className="mb-6">
          <div className="h-3 w-full overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pctMedido)}%` }} />
          </div>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-fg">Nova medição {nomeObra && <span className="text-neutral-400">· {nomeObra}</span>}</h2>
      <form onSubmit={handleAdd} className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Data</label>
          <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Descrição (opcional)</label>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="1ª medição, etapa X..." className="w-56 pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Valor medido (R$)</label>
          <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-36 pill-field px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Lançar medição</button>
      </form>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="th-label">Nº</th>
              <th className="th-label">Data</th>
              <th className="th-label">Descrição</th>
              <th className="th-label">Valor medido</th>
              <th className="th-label">Acumulado</th>
              <th className="th-label">% acum.</th>
              <th className="th-label"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((m) => (
              <tr key={m.id} className="border-t border-ink-800">
                <td className="px-4 py-2.5 text-neutral-600">{m.numero}</td>
                <td className="px-4 py-2.5 text-neutral-600">{new Date(m.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td className="px-4 py-2.5 text-fg">{m.descricao ?? "—"}</td>
                <td className="px-4 py-2.5 font-medium text-fg">{formatBRL(Number(m.valor))}</td>
                <td className="px-4 py-2.5 text-neutral-600">{formatBRL(m.acumulado)}</td>
                <td className="px-4 py-2.5 text-neutral-600">{m.pct.toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => excluir(m.id)} className="text-xs text-neutral-400 hover:text-red-500">Excluir</button>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma medição lançada. A medição é o executado que vira receita no resultado da obra.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
