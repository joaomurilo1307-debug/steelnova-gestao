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

// Insumos (chapas de solda, consumíveis etc.) ficam POR CONTA DO CLIENTE — a SteelNova não
// compra nem cobra por eles, só cobra matéria-prima + mão de obra + BDI. O valor de insumos
// continua calculado e mostrado (nada é apagado), só não entra mais no custo/preço da
// empresa — vira uma coluna informativa separada ("insumosCliente").
function calcServico(s: Servico, p: Parametros) {
  const baseQtd = num(s.baseQtd);
  const materiaPrima = num(s.materiaPrima);
  const isKg = s.unidade.toLowerCase() === "kg";
  const insumosCliente = s.insumosManual !== null ? num(s.insumosManual) : isKg ? baseQtd * p.insumosPorKg : 0;
  const maoDeObra =
    s.maoDeObraManual !== null
      ? num(s.maoDeObraManual)
      : isKg
      ? baseQtd * p.maoDeObraPorKg
      : baseQtd * p.instalacaoPorM2;
  const custo = materiaPrima + maoDeObra;
  const bdi = s.bdiManual !== null ? num(s.bdiManual) : custo * p.bdiPercent;
  const preco = custo + bdi;
  return { insumosCliente, maoDeObra, custo, bdi, preco };
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

  async function patchServico(id: string, body: any) {
    await fetch(`/api/servicos-orcamento/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  const totalPreco = servicos.reduce((s, sv) => s + calcServico(sv, params).preco, 0);
  const totalCusto = servicos.reduce((s, sv) => s + calcServico(sv, params).custo, 0);
  const totalBdi = servicos.reduce((s, sv) => s + calcServico(sv, params).bdi, 0);
  const totalInsumosCliente = servicos.reduce((s, sv) => s + calcServico(sv, params).insumosCliente, 0);
  const ajusteParaAlvo = params.valorAlvo !== null ? params.valorAlvo - totalPreco : null;

  return (
    <div className="p-8">
      <details className="mb-4 card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg">
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
                className="w-full pill-field px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={savingParams}
            className="col-span-2 self-end btn-primary px-4 py-2 text-sm disabled:opacity-50 sm:col-span-3"
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
            className="w-56 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Qtd. base</label>
          <input
            type="number"
            step="0.01"
            value={form.baseQtd}
            onChange={(e) => setForm({ ...form, baseQtd: e.target.value })}
            className="w-24 pill-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Unidade</label>
          <select
            value={form.unidade}
            onChange={(e) => setForm({ ...form, unidade: e.target.value })}
            className="pill-field px-3 py-2 text-sm"
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
            className="w-32 pill-field px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="btn-primary px-4 py-2 text-sm">
          Adicionar serviço
        </button>
      </form>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Serviço</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Base</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Un</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Matéria-prima</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label" title="Consumíveis (eletrodo, solda etc.) — pagos direto pelo cliente, não entram no preço da SteelNova">Insumos (cliente)</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">Mão de obra</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label" title="Custo da SteelNova = matéria-prima + mão de obra (sem insumos)">Custo (nosso)</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label">BDI</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label" title="O que a SteelNova cobra do cliente (sem insumos)">Preço (nosso)</th>
              <th className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900 th-label"></th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <ServicoRow key={s.id} servico={s} params={params} onPatch={(body) => patchServico(s.id, body)} onDelete={() => handleDeleteServico(s.id)} />
            ))}
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
              <tr className="border-t border-ink-700 bg-ink-900 font-medium text-fg">
                <td className="px-3 py-3" colSpan={3}>
                  TOTAL
                </td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3 text-amber-600">{formatBRL(totalInsumosCliente)}</td>
                <td className="px-3 py-3"></td>
                <td className="px-3 py-3">{formatBRL(totalCusto)}</td>
                <td className="px-3 py-3">{formatBRL(totalBdi)}</td>
                <td className="px-3 py-3">{formatBRL(totalPreco)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalInsumosCliente > 0 && (
        <p className="mt-2 text-xs text-amber-600">
          + {formatBRL(totalInsumosCliente)} em insumos (consumíveis) ficam por conta do cliente — não estão
          incluídos no preço acima cobrado pela SteelNova.
        </p>
      )}

      {params.valorAlvo !== null && (
        <p className="mt-3 text-sm text-neutral-600">
          Valor-alvo da proposta: <span className="text-fg">{formatBRL(params.valorAlvo)}</span> — soma atual dos
          serviços {formatBRL(totalPreco)}. {ajusteParaAlvo !== null && ajusteParaAlvo !== 0 && (
            <>
              Diferença (mobilização/margem para fechar no alvo):{" "}
              <span className={ajusteParaAlvo >= 0 ? "text-emerald-600" : "text-red-600"}>
                {formatBRL(ajusteParaAlvo)}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

const editCls = "w-full min-w-0 bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-ink-800 rounded";

// Célula editável genérica: mostra o valor, edita no clique, salva no blur — sem re-render
// a cada tecla (estado local só sobe pro pai quando o campo perde foco).
function EditCell({
  value,
  onSave,
  type = "text",
  align = "left",
}: {
  value: string | number;
  onSave: (v: string) => void;
  type?: "text" | "number";
  align?: "left" | "right";
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <input
      type={type}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== String(value) && onSave(v)}
      className={`${editCls} ${align === "right" ? "text-right" : ""}`}
    />
  );
}

function ServicoRow({
  servico: s,
  params,
  onPatch,
  onDelete,
}: {
  servico: Servico;
  params: Parametros;
  onPatch: (body: any) => void;
  onDelete: () => void;
}) {
  const c = calcServico(s, params);
  return (
    <tr className="border-t border-ink-800">
      <td className="px-1 py-1.5 text-fg">
        <EditCell value={s.nome} onSave={(v) => onPatch({ nome: v })} />
      </td>
      <td className="px-1 py-1.5 text-neutral-600">
        <EditCell value={num(s.baseQtd)} type="number" onSave={(v) => onPatch({ baseQtd: Number(v) })} />
      </td>
      <td className="px-1 py-1.5 text-neutral-600">
        <select value={s.unidade} onChange={(e) => onPatch({ unidade: e.target.value })} className={editCls}>
          <option value="kg">kg</option>
          <option value="m²">m²</option>
          <option value="m">m</option>
          <option value="vb">vb</option>
          <option value="un">un</option>
        </select>
      </td>
      <td className="px-1 py-1.5 text-neutral-600">
        <EditCell value={num(s.materiaPrima)} type="number" onSave={(v) => onPatch({ materiaPrima: Number(v) })} />
      </td>
      <td className="px-1 py-1.5 text-amber-600" title="Vazio = calculado automático pelo parâmetro Insumos (R$/kg). Preencher = valor manual fixo.">
        <EditCell
          value={s.insumosManual !== null ? num(s.insumosManual) : ""}
          type="number"
          onSave={(v) => onPatch({ insumosManual: v === "" ? null : Number(v) })}
        />
      </td>
      <td className="px-1 py-1.5 text-neutral-600" title="Vazio = calculado automático pelos parâmetros de mão de obra. Preencher = valor manual fixo.">
        <EditCell
          value={s.maoDeObraManual !== null ? num(s.maoDeObraManual) : ""}
          type="number"
          onSave={(v) => onPatch({ maoDeObraManual: v === "" ? null : Number(v) })}
        />
      </td>
      <td className="px-3 py-1.5 text-neutral-600">{formatBRL(c.custo)}</td>
      <td className="px-1 py-1.5 text-neutral-600" title="Vazio = calculado automático pelo % de BDI. Preencher = valor manual fixo.">
        <EditCell
          value={s.bdiManual !== null ? num(s.bdiManual) : ""}
          type="number"
          onSave={(v) => onPatch({ bdiManual: v === "" ? null : Number(v) })}
        />
      </td>
      <td className="px-3 py-1.5 font-medium text-fg">{formatBRL(c.preco)}</td>
      <td className="px-3 py-1.5">
        <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
          Remover
        </button>
      </td>
    </tr>
  );
}
