import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";
import { formatBRLCompact, obraStatusLabel } from "@/lib/format";
import { getMedicaoData } from "@/lib/medicao";

export const dynamic = "force-dynamic";

function diasDesde(data: Date): number {
  return Math.max(0, Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24)));
}

export default async function PainelPage() {
  const obras = await prisma.obra.findMany({ orderBy: { createdAt: "desc" } });
  // custo previsto = orçado (Orçamento/Medição, o que a SteelNova planejou gastar);
  // custo realizado = motor de custo real (mão de obra do Ponto, materiais, desembolsos,
  // indiretos rateados) — o mesmo que já alimenta o DRE. Não usa mais o CustoLancamento
  // avulso sozinho, que quase nunca é preenchido e deixava tudo em R$0,00 mesmo em obra com
  // custo real registrado.
  const medicoes = await Promise.all(obras.map(async (o) => [o.id, await getMedicaoData(o.id)] as const));
  const medicaoPorObra = new Map(medicoes);

  const obrasAtivas = obras.filter((o) => o.status !== "CONCLUIDA");
  const emAndamento = obras.filter((o) => o.status === "EM_ANDAMENTO");
  const aOrcar = obras.filter((o) => o.status === "PLANEJAMENTO");
  const concluidas = obras.filter((o) => o.status === "CONCLUIDA");
  const valorContratos = emAndamento.reduce((acc, o) => acc + Number(o.valorContrato), 0);
  const lancamentos = await prisma.lancamentoFinanceiro.findMany();
  const caixa = lancamentos.reduce(
    (acc, l) => acc + (String(l.tipo).toUpperCase().startsWith("SA") ? -Number(l.valor) : Number(l.valor)),
    0,
  );

  // Custo previsto/realizado ficam OCULTOS por ora: empresa recomeçando, sem controle
  // confiável desses números ainda (decisão do João em 29/09/2026).
  const kpis = [
    { label: "Em andamento", value: String(emAndamento.length), hint: `${aOrcar.length} a orçar · ${concluidas.length} concluídas` },
    { label: "Valor em contratos", value: formatBRLCompact(valorContratos), hint: "obras em andamento" },
    { label: "Caixa", value: formatBRLCompact(caixa), hint: "saldo disponível" },
    { label: "Obras (total)", value: String(obras.length), hint: `${obrasAtivas.length} ativas` },
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

                  <div className="text-sm">
                    <p className="text-[11px] text-neutral-500">Contrato</p>
                    <p className="font-medium text-fg">{Number(obra.valorContrato) > 0 ? formatBRLCompact(Number(obra.valorContrato)) : "a orçar"}</p>
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
