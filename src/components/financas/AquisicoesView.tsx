"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Aquisicao = {
  id: string;
  descricao: string;
  categoria: string;
  valor: string;
  dataCompra: string;
  vidaUtilMeses: number;
};

const CATEGORIAS = ["Equipamento", "Máquina", "Veículo", "Ferramenta", "Móvel/TI", "Outro"];

export default function AquisicoesView() {
  const [itens, setItens] = useState<Aquisicao[]>([]);
  const [form, setForm] = useState({
    descricao: "",
    categoria: CATEGORIAS[0],
    valor: "",
    dataCompra: new Date().toISOString().slice(0, 10),
    vidaUtilMeses: "24",
  });

  async function load() {
    const res = await fetch("/api/aquisicoes");
    if (res.ok) setItens(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return;
    const res = await fetch("/api/aquisicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: form.descricao,
        categoria: form.categoria,
        valor: Number(form.valor),
        dataCompra: form.dataCompra,
        vidaUtilMeses: Number(form.vidaUtilMeses) || 24,
      }),
    });
    if (res.ok) {
      setForm({ ...form, descricao: "", valor: "" });
      load();
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta aquisição?")) return;
    if ((await fetch(`/api/aquisicoes/${id}`, { method: "DELETE" })).ok) load();
  }

  const parcela = (a: Aquisicao) => Number(a.valor) / (a.vidaUtilMeses || 1);
  const totalInvestido = itens.reduce((s, a) => s + Number(a.valor), 0);
  const depreciacaoMensal = itens.reduce((s, a) => s + parcela(a), 0);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-900/60">Total investido (caixa)</p>
          <p className="mt-0.5 text-2xl font-bold text-violet-700">{formatBRL(totalInvestido)}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/60">Depreciação / mês</p>
          <p className="mt-0.5 text-2xl font-bold text-sky-700">{formatBRL(depreciacaoMensal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Itens</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{itens.length}</p>
        </div>
      </div>

      <p className="mb-3 text-xs text-neutral-500">
        A <b>parcela mensal</b> (valor ÷ vida útil) entra no rateio das obras ativas (resultado operacional). O <b>valor cheio</b> conta como caixa na data da compra.
      </p>

      <form onSubmit={handleAdd} className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Máquina de solda MIG..." className="w-52 pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="pill-field px-3 py-2 text-sm">
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
          <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-32 pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Data da compra</label>
          <input type="date" value={form.dataCompra} onChange={(e) => setForm({ ...form, dataCompra: e.target.value })} className="pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Vida útil (meses)</label>
          <input type="number" value={form.vidaUtilMeses} onChange={(e) => setForm({ ...form, vidaUtilMeses: e.target.value })} className="w-24 pill-field px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Cadastrar</button>
      </form>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="th-label">Descrição</th>
              <th className="th-label">Categoria</th>
              <th className="th-label">Valor</th>
              <th className="th-label">Compra</th>
              <th className="th-label">Vida útil</th>
              <th className="th-label">Parcela/mês</th>
              <th className="th-label"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((a) => (
              <tr key={a.id} className="border-t border-ink-800">
                <td className="px-4 py-2.5 text-fg">{a.descricao}</td>
                <td className="px-4 py-2.5 text-neutral-600">{a.categoria}</td>
                <td className="px-4 py-2.5 font-medium text-fg">{formatBRL(Number(a.valor))}</td>
                <td className="px-4 py-2.5 text-neutral-600">{new Date(a.dataCompra).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                <td className="px-4 py-2.5 text-neutral-600">{a.vidaUtilMeses} meses</td>
                <td className="px-4 py-2.5 text-sky-700">{formatBRL(parcela(a))}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => excluir(a.id)} className="text-xs text-neutral-400 hover:text-red-500">Excluir</button>
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Nenhuma aquisição cadastrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
