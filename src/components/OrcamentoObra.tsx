"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Parametros = {
  maoDeObraPorKg: number;
  insumosPorKg: number;
  bdiPercent: number;
  instalacaoPorM2: number;
  valorAlvo: number | null;
  diariaPadrao: number;
  horasPorDiaria: number;
  encarregadoFixo: number;
  alimentacaoPorDia: number;
  impostoPercent: number;
};

type Servico = {
  id: string;
  nome: string;
  baseQtd: string;
  unidade: string;
  materiaPrima: string;
  insumosManual: string | null;
  maoDeObraManual: string | null;
  bdiManual: string | null;
};

function num(v: string | number | null | undefined) {
  return v === null || v === undefined ? 0 : Number(v);
}

function calcServico(s: Servico, p: Parametros) {
  const baseQtd = num(s.baseQtd);
  const materiaPrima = num(s.materiaPrima);
  const isKg = s.unidade.toLowerCase() === "kg";
  const insumos = s.insumosManual !== null ? num(s.insumosManual) : isKg ? baseQtd * p.insumosPorKg : 0;
  const maoDeObra =
    s.maoDeObraManual !== null
      ? num(s.maoDeObraManual)
      : isKg
      ? baseQtd * p.maoDeObraPorKg
      : baseQtd * p.instalacaoPorM2;
  const custo = materiaPrima + insumos + maoDeObra;
  const bdi = s.bdiManual !== null ? num(s.bdiManual) : custo * p.bdiPercent;
  const preco = custo + bdi;
  return { insumos, maoDeObra, custo, bdi, preco };
}

const DEFAULT_PARAMS: Parametros = {
  maoDeObraPorKg: 0,
  insumosPorKg: 0,
  bdiPercent: 0.3,
  instalacaoPorM2: 0,
  valorAlvo: null,
  diariaPadrao: 150,
  horasPorDiaria: 8,
  encarregadoFixo: 0,
  alimentacaoPorDia: 0,
  impostoPercent: 0.06,
};

export default function OrcamentoObra({ obraId }: { obraId: string }) {
  const [params, setParams] = useState<Parametros>(DEFAULT_PARAMS);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [form, setForm] = useState({ nome: "", baseQtd: "", unidade: "kg", materiaPrima: "0" });
  const [savingParams, setSavingParams] = useState(false);

  async function load() {
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/obras/${obraId}/parametros-orcamento`),
      fetch(`/api/servicos-orcamento?obraId=${obraId}`),
    ]);
    if (pRes.ok) {
      const p = await pRes.json();
      setParams({
        maoDeObraPorKg: num(p.maoDeObraPorKg),
        insumosPorKg: num(p.insumosPorKg),
        bdiPercent: num(p.bdiPercent),
        instalacaoPorM2: num(p.instalacaoPorM2),
        valorAlvo: p.valorAlvo === null ? null : num(p.valorAlvo),
        diariaPadrao: num(p.diariaPadrao),
        horasPorDiaria: num(p.horasPorDiaria),
        encarregadoFixo: num(p.encarregadoFixo),
        alimentacaoPorDia: num(p.alimentacaoPorDia),
        impostoPercent: num(p.impostoPercent),
      });
    }
    if (sRes.ok) setServicos(await sRes.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function handleSaveParams(e: React.FormEvent) {
    e.preventDefault();
    setSavingParams(true);
    await fetch(`/api/obras/${obraId}/parametros-orcamento`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    setSavingParams(false);
    load();
  }

  async function handleAddServico(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.baseQtd) return;
    const res = await fetch("/api/servicos-orcamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        nome: form.nome,
        baseQtd: Number(form.baseQtd),
        unidade: form.unidade,
        materiaPrima: Number(form.materiaPrima || 0),
      }),
    });
    if (res.ok) {
      setForm({ nome: "", baseQtd: "", unidade: "kg", materiaPrima: "0" });
      load();
    }
  }

  async function handleDeleteServico(id: string) {
    if (!confirm("Remover esse serviço do orçamento?")) return;
    const res = await fetch(`/api/servicos-orcamento/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  const totalPreco = servicos.reduce((s, sv) => s + calcServico(sv, params).preco, 0);
  const totalCusto = servicos.reduce((s, sv) => s + calcServico(sv, params).custo, 0);
  const totalBdi = servicos.reduce((s, sv) => s + calcServico(sv, params).bdi, 0);
  const ajusteParaAlvo = params.valorAlvo !== null ? params.valorAlvo - totalPreco : null;

  return (
    <div className="p-6">
      <details className="mb-4 rounded-xl border border-ink-800 bg-ink-900 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          Parâmetros de precificação (taxas de mercado)
        </summary>
        <form onSubmit={handleSaveParams} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Mão de obra (R$/kg)", "maoDeObraPorKg"],
            ["Insumos (R$/kg)", "insumosPorKg"],
            ["Instalação (R$/m²)", "instalacaoPorM2"],
            ["BDI (fração, ex: 0.3 = 30%)", "bdiPercent"],
            ["Imposto s/ faturamento (fração, ex: 0.06 = 6%)", "impostoPercent"],
            ["Valor-alvo da proposta (R$)", "valorAlvo"],
            ["Diária padrão (R$)", "diariaPadrao"],
            ["Horas por diária", "horasPorDiaria"],
            ["Encarregado fixo (R$)", "encarregadoFixo"],
            ["Alimentação/dia (R$)", "alimentacaoPorDia"],
          ].map(([label, key]) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-neutral-500">{label}</label>
              <input
                type="number"
                step="0.01"
                value={(params as any)[key] ?? ""}
                onChange={(e) =>
                  setParams({
                    ...params,
                    [key]: e.target.value === "" ? (key === "valorAlvo" ? null : 0) : Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={savingParams}
            className="col-span-2 self-end rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 sm:col-span-3"
          >
            {savingParams ? "Salvando..." : "Salvar parâmetros"}
          </button>
        </form>
      </details>

      <form onSubmit={handleAddServico} className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Serviço</label>
          <input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="w-56 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Qtd. base</label>
          <input
            type="number"
            step="0.01"
            value={form.baseQtd}
            onChange={(e) => setForm({ ...form, baseQtd: e.target.value })}
            className="w-24 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Unidade</label>
          <select
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value })}
            className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            <option value="kg">kg</option>
            <option value="m²">m²</option>
            <option value="m">m</option>
            <option value="vb">vb</option>
            <option value="un">un</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Matéria-prima (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.materiaPrima}
            onChange={(e) => setForm({ ...form, materiaPrima: e.target.value })}
            className="w-32 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          Adicionar serviço
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full text-sm">
          <thead className="bg-ink-900 text-left text-neutral-400">
            <tr>
              <th className="px-3 py-3 font-medium">Serviço</th>
              <th className="px-3 py-3 font-medium">Base</th>
              <th className="px-3 py-3 font-medium">Un</th>
              <th className="px-3 py-3 font-medium">Matéria-prima</th>
              <th className="px-3 py-3 font-medium">Insumos</th>
              <th className="px-3 py-3 font-medium">Mão de obra</th>
              <th className="px-3 py-3 font-medium">Custo</th>
              <th className="px-3 py-3 font-medium">BDI</th>
              <th className="px-3 py-3 font-medium">Preço</th>
              <th className="px-3 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => {
              const c = calcServico(s, params);
              return (
                <tr key={s.id} className="border-t border-ink-800">
                  <td className="px-3 py-3 text-white">{s.nome}</td>
                  <td className="px-3 py-3 text-neutral-400">{num(s.baseQtd)}</td>
                  <td className="px-3 py-3 text-neutral-400">{s.unidade}</td>
                  <td className="px-3 py-3 text-neutral-400">{formatBRL(num(s.materiaPrima))}</td>
                  <td className="px-3 py-3 text-neutral-400">{formatBRL(c.insumos)}</td>
                  <td className="px-3 py-3 text-neutral-400">{formatBRL(c.maoDeObra)}</td>
                  <td className="px-3 py-3 text-neutral-400">{formatBRL(c.custo)}</td>
                  <td className="px-3 py-3 text-neutral-400">{formatBRL(c.bdi)}</td>
                  <td className="px-3 py-3 font-medium text-white">{formatBRL(c.preco)}</td>
                  <td className="px-3 py-3">
                    <button onClick={() => handleDeleteServico(s.id)} className="text-xs text-red-400 hover:underline">
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
            {servicos.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                  Nenhum serviço orçado ainda.
                </td>
              </tr>
            )}
          </tbody>
          {servicos.length > 0 && (
            <tfoot>
              <tr className="border-t border-ink-700 bg-ink-900 font-medium text-white">
                <td className="px-3 py-3" colSpan={6}>
                  TOTAL
                </td>
                <td className="px-3 py-3">{formatBRL(totalCusto)}</td>
                <td className="px-3 py-3">{formatBRL(totalBdi)}</td>
                <td className="px-3 py-3">{formatBRL(totalPreco)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {params.valorAlvo !== null && (
        <p className="mt-3 text-sm text-neutral-400">
          Valor-alvo da proposta: <span className="text-white">{formatBRL(params.valorAlvo)}</span> — soma atual dos
          serviços {formatBRL(totalPreco)}. {ajusteParaAlvo !== null && ajusteParaAlvo !== 0 && (
            <>
              Diferença (mobilização/margem para fechar no alvo):{" "}
              <span className={ajusteParaAlvo >= 0 ? "text-emerald-400" : "text-red-400"}>
                {formatBRL(ajusteParaAlvo)}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
