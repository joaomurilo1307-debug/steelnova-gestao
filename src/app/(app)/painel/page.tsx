import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";
import { formatBRLCompact, obraStatusLabel } from "@/lib/format";
import { getMedicaoData } from "@/lib/medicao";
import { calcularResultados } from "@/lib/resultado";

export const dynamic = "force-dynamic";

function diasDesde(data: Date): number {
  return Math.max(0, Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24)));
}

export default async function PainelPage() {
  const [obras, resultado] = await Promise.all([
    prisma.obra.findMany({ orderBy: { createdAt: "desc" } }),
    calcularResultados(),
  ]);
  // custo previsto = orçado (Orçamento/Medição, o que a SteelNova planejou gastar);
  // custo realizado = motor de custo real (mão de obra do Ponto, materiais, desembolsos,
  // indiretos rateados) — o mesmo que já alimenta o DRE. Não usa mais o CustoLancamento
  // avulso sozinho, que quase nunca é preenchido e deixava tudo em R$0,00 mesmo em obra com
  // custo real registrado.
  const medicoes = await Promise.all(obras.map(async (o) => [o.id, await getMedicaoData(o.id)] as const));
  const medicaoPorObra = new Map(medicoes);
  const resultadoPorObra = new Map(resultado.obras.map((r) => [r.obraId, r]));

  const obrasAtivas = obras.filter((o) => o.status !== "CONCLUIDA");
  const custoPrevisto = obras.reduce((acc, o) => acc + (medicaoPorObra.get(o.id)?.valorTotalServicos ?? 0), 0);
  const custoRealizado = obras.reduce((acc, o) => acc + (resultadoPorObra.get(o.id)?.custoTotal ?? 0), 0);
  const valorContratos = obrasAtivas.reduce((acc, o) => acc + Number(o.valorContrato), 0);
  const pctRealizado = custoPrevisto > 0 ? Math.round((custoRealizado / custoPrevisto) * 100) : 0;

  const kpis = [
    { label: "Obras ativas", value: String(obrasAtivas.length), hint: `${obras.length} no total` },
    { label: "Custo previsto", value: formatBRLCompact(custoPrevisto), hint: "soma das obras" },
    { label: "Custo realizado", value: formatBRLCompact(custoRealizado), hint: `${pctRealizado}% do previsto` },
    { label: "Valor em contratos", value: formatBRLCompact(valorContratos), hint: "receita contratada" },
  ];

  return (
    <div>
      <TopBar title="Painel" subtitle="Visão geral das obras" />

      <div className="p-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="card p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">{kpi.label}</p>
              <p className="mt-2 text-2xl font-semibold text-fg">{kpi.value}</p>
              <p className="mt-1 text-xs text-neutral-500">{kpi.hint}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Obras</h2>
          <Link
            href="/obras/nova"
            className="btn-primary px-3 py-1.5 text-sm"
          >
            + Nova obra
          </Link>
        </div>

        {obras.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">
            Nenhuma obra cadastrada ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {obras.map((obra) => {
              const custoReal = resultadoPorObra.get(obra.id)?.custoTotal ?? 0;
              const margem = Number(obra.valorContrato) - custoReal;
              const realizadoDias = diasDesde(obra.dataInicio);
              const progresso = obra.status === "CONCLUIDA" ? 100 : Math.round(medicaoPorObra.get(obra.id)?.pctObra ?? 0);

              return (
                <Link
                  key={obra.id}
                  href={`/obras/${obra.id}`}
                  className="card p-4 transition hover:border-brand/50"
                >
                  <p className="text-[11px] uppercase tracking-wide text-neutral-500">{obra.cliente}</p>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-fg">{obra.nome}</h3>
                    <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                      {obraStatusLabel(obra.status)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs text-neutral-500">
                      <span>Progresso</span>
                      <span>{progresso}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${progresso}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-[11px] text-neutral-500">Contrato</p>
                      <p className="font-medium text-fg">{formatBRLCompact(Number(obra.valorContrato))}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500">Custo real</p>
                      <p className="font-medium text-fg">{formatBRLCompact(custoReal)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-500">Margem</p>
                      <p className={`font-medium ${margem >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatBRLCompact(margem)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-neutral-500">
                    <span>Prazo previsto: {obra.prazoPrevistoDias} dias</span>
                    <span>Realizado até: {realizadoDias} dias</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
