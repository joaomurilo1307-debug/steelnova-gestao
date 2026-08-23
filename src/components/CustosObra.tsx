"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Custo = {
  id: string;
  categoria: string;
  descricao: string;
  valorPrevisto: string;
  valorRealizado: string | null;
  data: string;
};

const CATEGORIAS = ["Material", "Insumos", "Mão de obra", "Equipamento", "Terceiros", "Administrativo", "Outros"];

export default function CustosObra({ obraId }: { obraId: string }) {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [form, setForm] = useState({
    categoria: CATEGORIAS[0],
    descricao: "",
    valorPrevisto: "",
    valorRealizado: "",
    data: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const res = await fetch(`/api/custos?obraId=${obraId}`);
    if (res.ok) setCustos(await res.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valorPrevisto) return;
    const res = await fetch("/api/custos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        categoria: form.categoria,
        descricao: form.descricao,
        valorPrevisto: Number(form.valorPrevisto),
        valorRealizado: form.valorRealizado ? Number(form.valorRealizado) : undefined,
        data: form.data,
      }),
    });
    if (res.ok) {
      setForm({ ...form, descricao: "", valorPrevisto: "", valorRealizado: "" });
      load();
    }
  }

  const totalPrevisto = custos.reduce((s, c) => s + Number(c.valorPrevisto), 0);
  const totalRealizado = custos.reduce((s, c) => s + Number(c.valorRealizado ?? 0), 0);

  return (
    <div className="p-6">
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Previsto</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(totalPrevisto)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Realizado</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(totalRealizado)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Saldo</p>
          <p className={`mt-1 text-lg font-semibold ${totalPrevisto - totalRealizado >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatBRL(totalPrevisto - totalRealizado)}
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          >
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
          <input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="w-48 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Previsto (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.valorPrevisto}
            onChange={(e) => setForm({ ...form, valorPrevisto: e.target.value })}
            className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Realizado (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.valorRealizado}
            onChange={(e) => setForm({ ...form, valorRealizado: e.target.value })}
            className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Data</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-fg outline-none focus:border-brand"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Lançar
        </button>
      </form>

      <div className="max-h-[72vh] overflow-auto rounded-xl border border-ink-800 bg-ink-900">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Data</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Categoria</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Descrição</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Previsto</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 px-4 py-3 font-medium">Realizado</th>
            </tr>
          </thead>
          <tbody>
            {custos.map((c) => (
              <tr key={c.id} className="border-t border-ink-800">
                <td className="px-4 py-3 text-neutral-600">{new Date(c.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td className="px-4 py-3 text-neutral-600">{c.categoria}</td>
                <td className="px-4 py-3 text-fg">{c.descricao}</td>
                <td className="px-4 py-3 text-neutral-600">{formatBRL(Number(c.valorPrevisto))}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {c.valorRealizado ? formatBRL(Number(c.valorRealizado)) : "—"}
                </td>
              </tr>
            ))}
            {custos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Nenhum lançamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
