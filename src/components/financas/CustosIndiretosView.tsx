"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Custo = {
  id: string;
  descricao: string;
  categoria: string;
  valor: string;
  competencia: string;
  recorrente: boolean;
  escopo: string;
  obra: { id: string; nome: string } | null;
};
type Obra = { id: string; nome: string; status: string };

const CATEGORIAS = ["Salário", "Pró-labore", "Aluguel", "Contador", "Software", "Marketing", "Financeiro", "Outro"];

export default function CustosIndiretosView() {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [form, setForm] = useState({
    descricao: "",
    categoria: CATEGORIAS[0],
    valor: "",
    competencia: new Date().toISOString().slice(0, 7),
    recorrente: true,
    escopo: "TODAS",
    obraId: "",
  });

  async function load() {
    const [cRes, oRes] = await Promise.all([fetch("/api/custos-indiretos"), fetch("/api/obras")]);
    if (cRes.ok) setCustos(await cRes.json());
    if (oRes.ok) setObras(await oRes.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return;
    if (form.escopo === "UMA" && !form.obraId) {
      alert("Escolha a obra para rateio em uma só.");
      return;
    }
    const res = await fetch("/api/custos-indiretos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        descricao: form.descricao,
        categoria: form.categoria,
        valor: Number(form.valor),
        competencia: form.competencia + "-01",
        recorrente: form.recorrente,
        escopo: form.escopo,
        obraId: form.escopo === "UMA" ? form.obraId : null,
      }),
    });
    if (res.ok) {
      setForm({ ...form, descricao: "", valor: "" });
      load();
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este custo indireto?")) return;
    if ((await fetch(`/api/custos-indiretos/${id}`, { method: "DELETE" })).ok) load();
  }

  const totalMes = custos.filter((c) => c.recorrente).reduce((s, c) => s + Number(c.valor), 0);
  const totalRateiaTodas = custos.filter((c) => c.escopo === "TODAS").reduce((s, c) => s + Number(c.valor), 0);
  const obrasAtivas = obras.filter((o) => o.status !== "CONCLUIDA");

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/60">Recorrente / mês</p>
          <p className="mt-0.5 text-2xl font-bold text-amber-700">{formatBRL(totalMes)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Rateia em todas ativas</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(totalRateiaTodas)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Obras ativas (recebem rateio)</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{obrasAtivas.length}</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
          <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Salário administrativo..." className="w-48 pill-field px-3 py-2 text-sm" />
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
          <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-28 pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Competência</label>
          <input type="month" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} className="pill-field px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Rateio</label>
          <select value={form.escopo} onChange={(e) => setForm({ ...form, escopo: e.target.value })} className="pill-field px-3 py-2 text-sm">
            <option value="TODAS">Todas as obras ativas</option>
            <option value="UMA">Uma obra só</option>
          </select>
        </div>
        {form.escopo === "UMA" && (
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Obra</label>
            <select value={form.obraId} onChange={(e) => setForm({ ...form, obraId: e.target.value })} className="pill-field px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        )}
        <label className="flex items-center gap-1.5 pb-2 text-xs text-neutral-600">
          <input type="checkbox" checked={form.recorrente} onChange={(e) => setForm({ ...form, recorrente: e.target.checked })} />
          Repete todo mês
        </label>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Lançar</button>
      </form>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="th-label">Competência</th>
              <th className="th-label">Descrição</th>
              <th className="th-label">Categoria</th>
              <th className="th-label">Valor</th>
              <th className="th-label">Rateio</th>
              <th className="th-label">Recorrente</th>
              <th className="th-label"></th>
            </tr>
          </thead>
          <tbody>
            {custos.map((c) => (
              <tr key={c.id} className="border-t border-ink-800">
                <td className="px-4 py-2.5 text-neutral-600">
                  {new Date(c.competencia).toLocaleDateString("pt-BR", { timeZone: "UTC", month: "2-digit", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-fg">{c.descricao}</td>
                <td className="px-4 py-2.5 text-neutral-600">{c.categoria}</td>
                <td className="px-4 py-2.5 font-medium text-fg">{formatBRL(Number(c.valor))}</td>
                <td className="px-4 py-2.5">
                  {c.escopo === "UMA" ? (
                    <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">{c.obra?.nome ?? "obra"}</span>
                  ) : (
                    <span className="rounded-full border border-teal-300 bg-teal-100 px-2 py-0.5 text-xs text-teal-800">Todas ativas</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{c.recorrente ? "Sim" : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => excluir(c.id)} className="text-xs text-neutral-400 hover:text-red-500">Excluir</button>
                </td>
              </tr>
            ))}
            {custos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">Nenhum custo indireto lançado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
