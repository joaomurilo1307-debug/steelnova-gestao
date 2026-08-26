"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Dre = {
  receita: number;
  impostos: number;
  receitaLiquida: number;
  maoDeObra: number;
  materiais: number;
  desembolsos: number;
  lancamentosDiretos: number;
  custosDiretos: number;
  lucroBruto: number;
  custosIndiretos: number;
  depreciacao: number;
  despesasComerciais: number;
  aquisicoesValorCheio: number;
  resultadoOperacional: number;
  resultadoCaixa: number;
  margemOperacional: number;
  margemCaixa: number;
};

export default function DreView() {
  const [dre, setDre] = useState<Dre | null>(null);
  const [visao, setVisao] = useState<"competencia" | "caixa">("competencia");

  useEffect(() => {
    fetch("/api/dre").then(async (r) => {
      if (r.ok) setDre(await r.json());
    });
  }, []);

  if (!dre) return <p className="text-sm text-neutral-500">Montando o DRE…</p>;

  const caixa = visao === "caixa";
  const resultado = caixa ? dre.resultadoCaixa : dre.resultadoOperacional;
  const margem = caixa ? dre.margemCaixa : dre.margemOperacional;

  const Linha = ({ label, valor, negativo, forte, sub, destaque }: { label: string; valor: number; negativo?: boolean; forte?: boolean; sub?: boolean; destaque?: "verde" | "azul" }) => (
    <div
      className={`flex items-center justify-between px-4 ${forte ? "py-2.5" : "py-2"} ${sub ? "pl-8" : ""} ${
        forte ? "border-t-2 border-ink-700" : "border-t border-ink-800"
      } ${destaque === "verde" ? "bg-emerald-50" : destaque === "azul" ? "bg-sky-50" : ""}`}
    >
      <span className={`${forte ? "font-semibold text-fg" : sub ? "text-sm text-neutral-500" : "text-neutral-600"}`}>{label}</span>
      <span className={`${forte ? "font-bold" : ""} ${negativo ? "text-red-600" : "text-fg"}`}>
        {negativo ? "(" : ""}{formatBRL(valor)}{negativo ? ")" : ""}
      </span>
    </div>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-ink-800 p-1">
          <button
            onClick={() => setVisao("competencia")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${!caixa ? "bg-brand text-white" : "text-neutral-600"}`}
          >
            Competência
          </button>
          <button
            onClick={() => setVisao("caixa")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${caixa ? "bg-brand text-white" : "text-neutral-600"}`}
          >
            Caixa
          </button>
        </div>
        <div className={`rounded-2xl border px-5 py-3 shadow-sm ${resultado >= 0 ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100" : "border-red-200 bg-gradient-to-br from-red-50 to-rose-100"}`}>
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Resultado {caixa ? "de caixa" : "operacional"}</span>
          <span className={`ml-3 text-2xl font-bold ${resultado >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatBRL(resultado)}</span>
          <span className="ml-2 text-xs text-neutral-500">margem {(margem * 100).toFixed(1)}%</span>
        </div>
      </div>

      <p className="mb-3 text-xs text-neutral-500">
        {caixa
          ? "Visão CAIXA: a aquisição entra pelo valor cheio na data da compra (o dinheiro saiu inteiro)."
          : "Visão COMPETÊNCIA: a aquisição entra depreciada (parcela mensal). É a visão gerencial do resultado."}{" "}
        Tudo abaixo é calculado dos lançamentos — nada é digitado de novo.
      </p>

      <div className="overflow-hidden card">
        <Linha label="RECEITA BRUTA (medições / contratos)" valor={dre.receita} forte />
        <Linha label="Impostos sobre faturamento" valor={dre.impostos} negativo sub />
        <Linha label="= RECEITA LÍQUIDA" valor={dre.receitaLiquida} forte />

        <Linha label="Mão de obra (diárias / ponto)" valor={dre.maoDeObra} negativo sub />
        <Linha label="Materiais" valor={dre.materiais} negativo sub />
        <Linha label="Desembolsos" valor={dre.desembolsos} negativo sub />
        <Linha label="Outros custos diretos" valor={dre.lancamentosDiretos} negativo sub />
        <Linha label="= LUCRO BRUTO" valor={dre.lucroBruto} forte />

        <Linha label="Custos indiretos (salários, aluguel…)" valor={dre.custosIndiretos} negativo sub />
        {caixa ? (
          <Linha label="Aquisições (valor cheio — caixa)" valor={dre.aquisicoesValorCheio} negativo sub />
        ) : (
          <Linha label="Depreciação de aquisições" valor={dre.depreciacao} negativo sub />
        )}
        <Linha label="Despesas comerciais (gasto em propostas)" valor={dre.despesasComerciais} negativo sub />

        <Linha
          label={`= RESULTADO ${caixa ? "DE CAIXA" : "OPERACIONAL"}`}
          valor={resultado}
          forte
          destaque={resultado >= 0 ? "verde" : undefined}
        />
      </div>
    </div>
  );
}
