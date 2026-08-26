"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";

type ResultadoObra = {
  obraId: string;
  nome: string;
  status: string;
  ativa: boolean;
  horas: number;
  share: number;
  receita: number;
  diretos: number;
  indiretosRateados: number;
  depreciacaoRateada: number;
  indiretosUma: number;
  custoTotal: number;
  impostos: number;
  lucro: number;
  margem: number;
};
type Consolidado = {
  obras: ResultadoObra[];
  poolIndiretosTodas: number;
  poolDepreciacao: number;
  horasAtivasTotal: number;
};

export default function ResultadoView() {
  const [data, setData] = useState<Consolidado | null>(null);

  useEffect(() => {
    fetch("/api/resultado").then(async (r) => {
      if (r.ok) setData(await r.json());
    });
  }, []);

  if (!data) return <p className="text-sm text-neutral-500">Calculando resultado…</p>;

  const tot = data.obras.reduce(
    (a, o) => ({
      receita: a.receita + o.receita,
      diretos: a.diretos + o.diretos,
      indiretos: a.indiretos + o.indiretosRateados + o.depreciacaoRateada + o.indiretosUma,
      custoTotal: a.custoTotal + o.custoTotal,
      impostos: a.impostos + o.impostos,
      lucro: a.lucro + o.lucro,
    }),
    { receita: 0, diretos: 0, indiretos: 0, custoTotal: 0, impostos: 0, lucro: 0 }
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/60">Receita total</p>
          <p className="mt-0.5 text-2xl font-bold text-emerald-700">{formatBRL(tot.receita)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Custos diretos</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(tot.diretos)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Indiretos rateados</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(tot.indiretos)}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${tot.lucro >= 0 ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100" : "border-red-200 bg-gradient-to-br from-red-50 to-rose-100"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Resultado operacional</p>
          <p className={`mt-0.5 text-2xl font-bold ${tot.lucro >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatBRL(tot.lucro)}</p>
        </div>
      </div>

      <p className="mb-3 text-xs text-neutral-500">
        Pool de indiretos rateado por horas entre as obras ativas: {formatBRL(data.poolIndiretosTodas)} de custos indiretos +{" "}
        {formatBRL(data.poolDepreciacao)} de depreciação acumulada. Obra concluída não recebe rateio.
      </p>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-600">
            <tr>
              <th className="th-label">Obra</th>
              <th className="th-label">Horas</th>
              <th className="th-label">Receita</th>
              <th className="th-label">Diretos</th>
              <th className="th-label">Indiretos</th>
              <th className="th-label">Impostos</th>
              <th className="th-label">Resultado</th>
              <th className="th-label">Margem</th>
            </tr>
          </thead>
          <tbody>
            {data.obras.map((o) => (
              <tr key={o.obraId} className="border-t border-ink-800">
                <td className="px-4 py-2.5">
                  <Link href={`/obras/${o.obraId}/resultado`} className="text-brand hover:underline">{o.nome}</Link>
                  {!o.ativa && <span className="ml-2 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-600">concluída</span>}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{o.horas.toFixed(0)}h</td>
                <td className="px-4 py-2.5 text-neutral-600">{formatBRL(o.receita)}</td>
                <td className="px-4 py-2.5 text-neutral-600">{formatBRL(o.diretos)}</td>
                <td className="px-4 py-2.5 text-neutral-600">{formatBRL(o.indiretosRateados + o.depreciacaoRateada + o.indiretosUma)}</td>
                <td className="px-4 py-2.5 text-neutral-600">{formatBRL(o.impostos)}</td>
                <td className={`px-4 py-2.5 font-semibold ${o.lucro >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(o.lucro)}</td>
                <td className="px-4 py-2.5 text-neutral-600">{(o.margem * 100).toFixed(1)}%</td>
              </tr>
            ))}
            {data.obras.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-500">Nenhuma obra ainda.</td></tr>
            )}
          </tbody>
          {data.obras.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-ink-700 font-semibold">
                <td className="px-4 py-2.5 text-fg">TOTAL</td>
                <td className="px-4 py-2.5 text-neutral-600">{data.horasAtivasTotal.toFixed(0)}h</td>
                <td className="px-4 py-2.5 text-fg">{formatBRL(tot.receita)}</td>
                <td className="px-4 py-2.5 text-fg">{formatBRL(tot.diretos)}</td>
                <td className="px-4 py-2.5 text-fg">{formatBRL(tot.indiretos)}</td>
                <td className="px-4 py-2.5 text-fg">{formatBRL(tot.impostos)}</td>
                <td className={`px-4 py-2.5 ${tot.lucro >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(tot.lucro)}</td>
                <td className="px-4 py-2.5 text-neutral-600">{tot.receita > 0 ? ((tot.lucro / tot.receita) * 100).toFixed(1) : "0"}%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
