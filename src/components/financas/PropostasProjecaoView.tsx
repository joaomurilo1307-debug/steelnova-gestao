"use client";

import { useEffect, useState } from "react";
import { formatBRL, periodoContratoLabel } from "@/lib/format";

type Proposta = {
  id: string;
  cliente: string;
  valor: string | null;
  custoEstimado: string | null;
  custoGasto: string | null;
  status: string;
  obraId: string | null;
  obra: { id: string; dataInicio: string; prazoPrevistoDias: number } | null;
  dataInicioPrevista: string | null;
  prazoDiasContrato: number | null;
};

type CurvaSResumo = { pctPrevistoHoje: number; pctRealizadoAtual: number; desvio: number };

const STATUS: Record<string, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-neutral-100 text-neutral-700 border-neutral-300" },
  ENVIADA: { label: "Enviada", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  EM_NEGOCIACAO: { label: "Em negociação", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  APROVADA: { label: "Aprovada", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  CONVERTIDA: { label: "Convertida", cls: "bg-teal-100 text-teal-800 border-teal-300" },
  RECUSADA: { label: "Recusada", cls: "bg-rose-100 text-rose-800 border-rose-300" },
};
const EM_ABERTO = ["RASCUNHO", "ENVIADA", "EM_NEGOCIACAO"];
const GANHAS = ["APROVADA", "CONVERTIDA"];

export default function PropostasProjecaoView() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [curvas, setCurvas] = useState<Record<string, CurvaSResumo>>({});

  async function load() {
    const res = await fetch("/api/propostas");
    if (!res.ok) return;
    const data: Proposta[] = await res.json();
    setPropostas(data);

    // período projetado real (baseado na curva S) só faz sentido pra proposta já convertida
    // em obra — busca em paralelo, uma por obra vinculada.
    const comObra = data.filter((p) => p.obraId);
    const pares = await Promise.all(
      comObra.map(async (p) => {
        const r = await fetch(`/api/obras/${p.obraId}/curva-s`);
        if (!r.ok) return null;
        const c = await r.json();
        return [p.obraId as string, { pctPrevistoHoje: c.pctPrevistoHoje, pctRealizadoAtual: c.pctRealizadoAtual, desvio: c.desvio }] as const;
      })
    );
    setCurvas(Object.fromEntries(pares.filter(Boolean) as [string, CurvaSResumo][]));
  }
  useEffect(() => {
    load();
  }, []);

  async function setCustoGasto(id: string, valor: string) {
    setPropostas((prev) => prev.map((p) => (p.id === id ? { ...p, custoGasto: valor } : p)));
    await fetch(`/api/propostas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custoGasto: valor ? Number(valor) : null }),
    });
  }

  const val = (p: Proposta) => Number(p.valor ?? 0);
  const projetada = propostas.filter((p) => EM_ABERTO.includes(p.status)).reduce((s, p) => s + val(p), 0);
  const ganha = propostas.filter((p) => GANHAS.includes(p.status)).reduce((s, p) => s + val(p), 0);
  const gastoTotal = propostas.reduce((s, p) => s + Number(p.custoGasto ?? 0), 0);
  const nGanhas = propostas.filter((p) => GANHAS.includes(p.status)).length;
  const nFechadas = propostas.filter((p) => GANHAS.includes(p.status) || p.status === "RECUSADA").length;
  const conversao = nFechadas > 0 ? (nGanhas / nFechadas) * 100 : 0;

  const funil = Object.keys(STATUS).map((st) => ({
    st,
    n: propostas.filter((p) => p.status === st).length,
    valor: propostas.filter((p) => p.status === st).reduce((s, p) => s + val(p), 0),
  }));

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/60">Receita projetada (em aberto)</p>
          <p className="mt-0.5 text-2xl font-bold text-sky-700">{formatBRL(projetada)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/60">Ganho (aprovadas)</p>
          <p className="mt-0.5 text-2xl font-bold text-emerald-700">{formatBRL(ganha)}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-red-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-900/60">Gasto nas propostas</p>
          <p className="mt-0.5 text-2xl font-bold text-rose-700">{formatBRL(gastoTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Conversão</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{conversao.toFixed(0)}%</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">{nGanhas} ganha(s) de {nFechadas} fechada(s)</p>
        </div>
      </div>

      {/* Funil */}
      <div className="mb-6 flex flex-wrap gap-2">
        {funil.map((f) => (
          <div key={f.st} className={`rounded-xl border px-3 py-2 ${STATUS[f.st].cls}`}>
            <div className="text-xs font-semibold">{STATUS[f.st].label} · {f.n}</div>
            <div className="text-sm font-bold">{formatBRL(f.valor)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="th-label">Cliente</th>
              <th className="th-label">Status</th>
              <th className="th-label">Valor proposto</th>
              <th className="th-label" title="Real (curva S do Planejamento) se já virou obra, senão a estimativa">Período do contrato</th>
              <th className="th-label">Custo estimado</th>
              <th className="th-label">Gasto na proposta</th>
            </tr>
          </thead>
          <tbody>
            {propostas.map((p) => (
              <tr key={p.id} className="border-t border-ink-800">
                <td className="px-4 py-2.5 font-medium text-fg">{p.cliente}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS[p.status]?.cls ?? ""}`}>
                    {STATUS[p.status]?.label ?? p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{p.valor ? formatBRL(Number(p.valor)) : "—"}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {periodoContratoLabel(p)}
                  {p.obraId && curvas[p.obraId] && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        curvas[p.obraId].desvio >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                      title="Previsto × realizado (curva S)"
                    >
                      {curvas[p.obraId].pctRealizadoAtual.toFixed(0)}% real. / {curvas[p.obraId].pctPrevistoHoje.toFixed(0)}% prev.
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{p.custoEstimado ? formatBRL(Number(p.custoEstimado)) : "—"}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={p.custoGasto ?? ""}
                    onBlur={(e) => e.target.value !== (p.custoGasto ?? "") && setCustoGasto(p.id, e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-28 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1 text-sm"
                  />
                </td>
              </tr>
            ))}
            {propostas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">Nenhuma proposta ainda. Cadastre em Comercial › Propostas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
