"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import { formatBRL } from "@/lib/format";
import AquisicoesView from "@/components/financas/AquisicoesView";
import CustosIndiretosView from "@/components/financas/CustosIndiretosView";
import ResultadoView from "@/components/financas/ResultadoView";
import PropostasProjecaoView from "@/components/financas/PropostasProjecaoView";
import DreView from "@/components/financas/DreView";

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  pessoa: string | null;
  valor: string;
  data: string;
};

const TIPOS = ["Salário", "Retirada de caixa", "Contabilidade", "Nota fiscal", "Outro"];

const ABAS = [
  { key: "dre", label: "DRE" },
  { key: "resultado", label: "Resultado por obra" },
  { key: "caixa", label: "Caixa" },
  { key: "aquisicoes", label: "Aquisições" },
  { key: "indiretos", label: "Custos indiretos" },
  { key: "propostas", label: "Propostas" },
];

export default function FinancasPage() {
  const [aba, setAba] = useState("dre");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [form, setForm] = useState({
    tipo: TIPOS[0],
    descricao: "",
    pessoa: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const res = await fetch("/api/financas");
    if (res.ok) setLancamentos(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return;
    const res = await fetch("/api/financas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: form.tipo,
        descricao: form.descricao,
        pessoa: form.pessoa || undefined,
        valor: Number(form.valor),
        data: form.data,
      }),
    });
    if (res.ok) {
      setForm({ ...form, descricao: "", pessoa: "", valor: "" });
      load();
    }
  }

  const totalPorTipo = TIPOS.map((tipo) => ({
    tipo,
    total: lancamentos.filter((l) => l.tipo === tipo).reduce((s, l) => s + Number(l.valor), 0),
  }));

  return (
    <div>
      <TopBar title="Finanças" subtitle="Caixa, aquisições e custos indiretos da empresa" />

      <div className="flex gap-1 overflow-x-auto border-b border-ink-800 px-8">
        {ABAS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition ${
              aba === a.key ? "border-brand font-medium text-brand" : "border-transparent text-neutral-600 hover:text-fg"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="p-8">
        {aba === "dre" && <DreView />}
        {aba === "aquisicoes" && <AquisicoesView />}
        {aba === "indiretos" && <CustosIndiretosView />}
        {aba === "resultado" && <ResultadoView />}
        {aba === "propostas" && <PropostasProjecaoView />}
        {aba === "caixa" && (
        <>
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {totalPorTipo.map((t) => (
            <div key={t.tipo} className="card p-4">
              <p className="text-xs uppercase text-neutral-500">{t.tipo}</p>
              <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(t.total)}</p>
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="pill-field px-3 py-2 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Descrição</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="w-56 pill-field px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Pessoa (se aplicável)</label>
            <input
              value={form.pessoa}
              onChange={(e) => setForm({ ...form, pessoa: e.target.value })}
              className="w-40 pill-field px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              className="w-32 pill-field px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="pill-field px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="btn-primary px-4 py-2 text-sm">
            Lançar
          </button>
        </form>

        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Pessoa</th>
                <th className="px-4 py-3 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.map((l) => (
                <tr key={l.id} className="border-t border-ink-800">
                  <td className="px-4 py-3 text-neutral-600">{new Date(l.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                  <td className="px-4 py-3 text-neutral-600">{l.tipo}</td>
                  <td className="px-4 py-3 text-fg">{l.descricao}</td>
                  <td className="px-4 py-3 text-neutral-600">{l.pessoa ?? "—"}</td>
                  <td className="px-4 py-3 text-fg">{formatBRL(Number(l.valor))}</td>
                </tr>
              ))}
              {lancamentos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    Nenhum lançamento ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
