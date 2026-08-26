"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { formatBRL } from "@/lib/format";

type Medicao = { id: string; numero: number; data: string; descricao: string | null; valor: string };
type LinhaComponente = { servicoId: string; nome: string; baseQtd: number; unidade: string; valor: number; pctConcluido: number };
type ComponentesResp = { linhas: LinhaComponente[]; valorTotalServicos: number; pctObra: number; valorMedidoSugerido: number; valorContrato: number };
type CurvaS = {
  previsto: { data: string; pct: number }[];
  realizado: { data: string; pct: number; valor: number }[];
  pctPrevistoHoje: number;
  pctRealizadoAtual: number;
  desvio: number;
};

const CHART_W = 760;
const CHART_H = 220;
const PAD = { top: 12, right: 16, bottom: 26, left: 40 };

function pathDe(pontos: { x: number; y: number }[]) {
  return pontos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export default function MedicaoObra({ obraId }: { obraId: string }) {
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [valorContrato, setValorContrato] = useState(0);
  const [nomeObra, setNomeObra] = useState("");
  const [componentes, setComponentes] = useState<ComponentesResp | null>(null);
  const [curva, setCurva] = useState<CurvaS | null>(null);
  const [salvandoGrupo, setSalvandoGrupo] = useState<string | null>(null);
  const [lancando, setLancando] = useState(false);
  const [form, setForm] = useState({ data: new Date().toISOString().slice(0, 10), descricao: "", valor: "" });

  async function load() {
    const [mRes, oRes, cRes, sRes] = await Promise.all([
      fetch(`/api/medicoes?obraId=${obraId}`),
      fetch(`/api/obras/${obraId}`),
      fetch(`/api/obras/${obraId}/medicao-componentes`),
      fetch(`/api/obras/${obraId}/curva-s`),
    ]);
    if (mRes.ok) setMedicoes(await mRes.json());
    if (oRes.ok) {
      const o = await oRes.json();
      setValorContrato(Number(o.valorContrato ?? 0));
      setNomeObra(o.nome ?? "");
    }
    if (cRes.ok) setComponentes(await cRes.json());
    if (sRes.ok) setCurva(await sRes.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function salvarComponente(servicoId: string, pctConcluido: number) {
    setSalvandoGrupo(servicoId);
    await fetch(`/api/obras/${obraId}/medicao-componentes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ servicoId, pctConcluido }),
    });
    const cRes = await fetch(`/api/obras/${obraId}/medicao-componentes`);
    if (cRes.ok) setComponentes(await cRes.json());
    setSalvandoGrupo(null);
  }

  async function handleLancarFisica() {
    if (!componentes || componentes.pctObra <= 0) return;
    setLancando(true);
    const res = await fetch("/api/medicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obraId,
        data: new Date().toISOString().slice(0, 10),
        descricao: `Medição física — ${componentes.pctObra.toFixed(1)}% (ponderado pelo valor de cada serviço)`,
        valor: Math.round(componentes.valorMedidoSugerido * 100) / 100,
      }),
    });
    if (res.ok) await load();
    setLancando(false);
  }

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

  function gerarRelatorio() {
    if (!componentes) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        componentes.linhas.map((l) => ({
          Serviço: l.nome,
          Qtd: l.baseQtd,
          Un: l.unidade,
          "Valor do serviço (R$)": Number(l.valor.toFixed(2)),
          "% do valor total": componentes.valorTotalServicos > 0 ? Number(((l.valor / componentes.valorTotalServicos) * 100).toFixed(1)) : 0,
          "% Concluído": l.pctConcluido,
          "Valor medido (R$)": Number(((l.valor * l.pctConcluido) / 100).toFixed(2)),
        }))
      ),
      "Por serviço"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Indicador: "Valor total dos serviços orçados", Valor: Number(componentes.valorTotalServicos.toFixed(2)) },
        { Indicador: "% físico-financeiro da obra (ponderado pelo valor)", Valor: `${componentes.pctObra.toFixed(1)}%` },
        { Indicador: "Valor do contrato", Valor: componentes.valorContrato },
        { Indicador: "Valor medido sugerido (% físico × contrato)", Valor: Number(componentes.valorMedidoSugerido.toFixed(2)) },
        { Indicador: "% previsto (curva S, hoje)", Valor: curva ? `${curva.pctPrevistoHoje.toFixed(1)}%` : "—" },
        { Indicador: "% realizado (última medição lançada)", Valor: curva ? `${curva.pctRealizadoAtual.toFixed(1)}%` : "—" },
        { Indicador: "Desvio (realizado − previsto)", Valor: curva ? `${curva.desvio >= 0 ? "+" : ""}${curva.desvio.toFixed(1)} p.p.` : "—" },
      ]),
      "Resumo"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        medicoes.map((m) => ({ Nº: m.numero, Data: new Date(m.data).toLocaleDateString("pt-BR", { timeZone: "UTC" }), Descrição: m.descricao ?? "", Valor: Number(m.valor) }))
      ),
      "Medições lançadas"
    );
    XLSX.writeFile(wb, `relatorio-medicao-${(nomeObra || "obra").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`);
  }

  const totalMedido = medicoes.reduce((s, m) => s + Number(m.valor), 0);
  const pctMedido = valorContrato > 0 ? (totalMedido / valorContrato) * 100 : 0;
  const saldo = valorContrato - totalMedido;

  let acc = 0;
  const linhas = medicoes.map((m) => {
    acc += Number(m.valor);
    return { ...m, acumulado: acc, pct: valorContrato > 0 ? (acc / valorContrato) * 100 : 0 };
  });

  // ---- geometria do gráfico de curva S ----
  const chart = useMemo(() => {
    if (!curva || curva.previsto.length === 0) return null;
    const dias = curva.previsto;
    const n = dias.length;
    const x = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * (CHART_W - PAD.left - PAD.right);
    const y = (pct: number) => PAD.top + (1 - Math.min(pct, 100) / 100) * (CHART_H - PAD.top - PAD.bottom);
    const idxDe = (dataIso: string) => {
      const idx = dias.findIndex((d) => d.data >= dataIso);
      return idx < 0 ? n - 1 : idx;
    };
    const previstoPontos = dias.map((d, i) => ({ x: x(i), y: y(d.pct) }));
    const realizadoPontos = curva.realizado.map((r) => ({ x: x(idxDe(r.data)), y: y(r.pct) }));
    const hojeIso = new Date(new Date().toDateString()).toISOString().slice(0, 10);
    const hojeX = x(idxDe(hojeIso));
    // marcas do eixo X: início, 1/4, 1/2, 3/4, fim
    const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const i = Math.round(f * (n - 1));
      return { x: x(i), label: dias[i].data.slice(5).split("-").reverse().join("/") };
    });
    return { previstoPontos, realizadoPontos, hojeX, marcas, x, y };
  }, [curva]);

  return (
    <div className="p-8">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Valor do contrato</p>
          <p className="mt-1 text-lg font-semibold text-fg">{formatBRL(valorContrato)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/60">Total medido (R$)</p>
          <p className="mt-0.5 text-2xl font-bold text-emerald-700">{formatBRL(totalMedido)}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/60">% medido (R$)</p>
          <p className="mt-0.5 text-2xl font-bold text-sky-700">{pctMedido.toFixed(1)}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Saldo a medir</p>
          <p className={`mt-1 text-lg font-semibold ${saldo >= 0 ? "text-fg" : "text-red-600"}`}>{formatBRL(saldo)}</p>
        </div>
      </div>

      {valorContrato > 0 && (
        <div className="mb-8">
          <div className="h-3 w-full overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pctMedido)}%` }} />
          </div>
        </div>
      )}

      {/* ---------------- Medição física-financeira por serviço (valor) ---------------- */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">
          Medição por serviço — ponderada pelo valor {nomeObra && <span className="text-neutral-400">· {nomeObra}</span>}
        </h2>
        {componentes && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              % físico-financeiro (ponderado por {formatBRL(componentes.valorTotalServicos)} em serviços):
            </span>
            <span className="text-lg font-bold text-brand">{componentes.pctObra.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="mb-3 overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="th-label">Serviço (Orçamento)</th>
              <th className="th-label">Qtd.</th>
              <th className="th-label">Valor do serviço</th>
              <th className="th-label">% do valor</th>
              <th className="th-label">% Concluído</th>
              <th className="th-label">Valor medido</th>
            </tr>
          </thead>
          <tbody>
            {componentes?.linhas.map((l) => (
              <LinhaComponenteRow
                key={l.servicoId}
                linha={l}
                valorTotal={componentes.valorTotalServicos}
                salvando={salvandoGrupo === l.servicoId}
                onSalvar={(pct) => salvarComponente(l.servicoId, pct)}
              />
            ))}
            {(!componentes || componentes.linhas.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  Cadastre os serviços na aba Orçamento (Fabricação, Montagem, Instalação...) pra medir por valor real.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          onClick={handleLancarFisica}
          disabled={lancando || !componentes || componentes.pctObra <= 0}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {lancando ? "Lançando..." : `📐 Lançar medição física (${componentes ? formatBRL(componentes.valorMedidoSugerido) : "—"})`}
        </button>
        <button onClick={gerarRelatorio} disabled={!componentes} className="btn-secondary px-4 py-2 text-sm disabled:opacity-50">
          📄 Gerar relatório (Excel)
        </button>
        <span className="text-xs text-neutral-500">
          Cada serviço pesa pelo valor real dele no Orçamento (fabricação e montagem, que carregam mão de obra, pesam
          mais por kg do que instalação de telha, por exemplo) — não pelo peso físico puro.
        </span>
      </div>

      {/* ---------------- Curva S ---------------- */}
      {chart && curva && (
        <div className="mb-8 card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">Curva S — previsto × realizado</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="inline-block h-0.5 w-4 bg-neutral-400" /> Previsto {curva.pctPrevistoHoje.toFixed(1)}% (hoje)
              </span>
              <span className="flex items-center gap-1.5 text-neutral-500">
                <span className="inline-block h-2 w-2 rounded-full bg-brand" /> Realizado {curva.pctRealizadoAtual.toFixed(1)}%
              </span>
              <span className={`rounded-full px-2.5 py-1 font-semibold ${curva.desvio >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {curva.desvio >= 0 ? "+" : ""}
                {curva.desvio.toFixed(1)} p.p.
              </span>
            </div>
          </div>
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: 220 }}>
            {[0, 25, 50, 75, 100].map((p) => (
              <g key={p}>
                <line x1={PAD.left} x2={CHART_W - PAD.right} y1={chart.y(p)} y2={chart.y(p)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={PAD.left - 6} y={chart.y(p) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">
                  {p}%
                </text>
              </g>
            ))}
            {chart.marcas.map((m, i) => (
              <text key={i} x={m.x} y={CHART_H - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {m.label}
              </text>
            ))}
            <line x1={chart.hojeX} x2={chart.hojeX} y1={PAD.top} y2={CHART_H - PAD.bottom} stroke="#E8802B" strokeWidth={1} strokeDasharray="3,3" />
            <path d={pathDe(chart.previstoPontos)} fill="none" stroke="#9ca3af" strokeWidth={2} />
            {chart.realizadoPontos.length > 0 && (
              <path d={pathDe(chart.realizadoPontos)} fill="none" stroke="#E8802B" strokeWidth={2.5} />
            )}
            {chart.realizadoPontos.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#E8802B" />
            ))}
          </svg>
        </div>
      )}

      {/* ---------------- Medições lançadas (financeiro) ---------------- */}
      <h2 className="mb-2 text-sm font-semibold text-fg">Lançar medição manual (opcional)</h2>
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
        <button type="submit" className="btn-secondary px-4 py-2 text-sm">Lançar</button>
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

function LinhaComponenteRow({
  linha,
  valorTotal,
  salvando,
  onSalvar,
}: {
  linha: LinhaComponente;
  valorTotal: number;
  salvando: boolean;
  onSalvar: (pctConcluido: number) => void;
}) {
  const [pct, setPct] = useState(linha.pctConcluido);

  useEffect(() => {
    setPct(linha.pctConcluido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linha.pctConcluido]);

  return (
    <tr className="border-t border-ink-800">
      <td className="px-4 py-2.5 text-fg">{linha.nome}</td>
      <td className="px-4 py-2.5 text-neutral-600">
        {linha.baseQtd.toLocaleString("pt-BR")} {linha.unidade}
      </td>
      <td className="px-4 py-2.5 text-neutral-600">{formatBRL(linha.valor)}</td>
      <td className="px-4 py-2.5 text-neutral-600">{valorTotal > 0 ? `${((linha.valor / valorTotal) * 100).toFixed(1)}%` : "—"}</td>
      <td className="px-4 py-2.5">
        <input
          type="number"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          onBlur={() => onSalvar(pct)}
          className="w-20 pill-field px-2 py-1 text-sm"
        />
        {salvando && <span className="ml-1.5 text-xs text-neutral-400">salvando...</span>}
      </td>
      <td className="px-4 py-2.5 font-medium text-fg">{formatBRL((linha.valor * pct) / 100)}</td>
    </tr>
  );
}
