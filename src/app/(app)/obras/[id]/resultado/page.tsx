import { notFound } from "next/navigation";
import { formatBRL } from "@/lib/format";
import { calcularResultados } from "@/lib/resultado";

export const dynamic = "force-dynamic";

export default async function ObraResultadoPage({ params }: { params: { id: string } }) {
  const { obras } = await calcularResultados();
  const r = obras.find((o) => o.obraId === params.id);
  if (!r) notFound();

  const linhasDiretas = [
    ["Mão de obra (diárias / ponto)", r.maoDeObra],
    ["Desembolsos (material/alimentação/ferramenta)", r.desembolsos],
    ["Materiais recebidos (custo × qtd.)", r.materiais],
    ["Lançamentos de custo (aba Custos)", r.lancamentos],
  ] as const;

  const linhasIndiretas = [
    ["Custos indiretos rateados (por horas)", r.indiretosRateados],
    ["Depreciação de aquisições (rateada)", r.depreciacaoRateada],
    ["Custos indiretos só desta obra", r.indiretosUma],
  ] as const;

  return (
    <div className="p-8">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/60">Receita</p>
          <p className="mt-0.5 text-xl font-bold text-emerald-700">{formatBRL(r.receita)}</p>
          <p className="mt-0.5 text-[11px] text-emerald-800/70">{r.receitaMedida > 0 ? "por medições" : "valor do contrato"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Custo total</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(r.custoTotal)}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">diretos + indiretos rateados</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-neutral-500">Impostos</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(r.impostos)}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${r.lucro >= 0 ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100" : "border-red-200 bg-gradient-to-br from-red-50 to-rose-100"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Resultado operacional</p>
          <p className={`mt-0.5 text-xl font-bold ${r.lucro >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatBRL(r.lucro)}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">margem {(r.margem * 100).toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold text-fg">Custos diretos da obra</h2>
          <table className="w-full text-sm">
            <tbody>
              {linhasDiretas.map(([label, valor]) => (
                <tr key={label} className="border-t border-ink-800">
                  <td className="py-2 text-neutral-600">{label}</td>
                  <td className="py-2 text-right text-fg">{formatBRL(valor)}</td>
                </tr>
              ))}
              <tr className="border-t border-ink-700 font-medium">
                <td className="py-2 text-fg">Total diretos</td>
                <td className="py-2 text-right text-fg">{formatBRL(r.diretos)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <h2 className="mb-1 text-sm font-semibold text-fg">Custos indiretos rateados</h2>
          <p className="mb-2 text-xs text-neutral-500">
            Esta obra tem {r.horas.toFixed(0)}h de {r.ativa ? `${(r.share * 100).toFixed(1)}% das horas das obras ativas` : "obra concluída — não recebe rateio"}.
          </p>
          <table className="w-full text-sm">
            <tbody>
              {linhasIndiretas.map(([label, valor]) => (
                <tr key={label} className="border-t border-ink-800">
                  <td className="py-2 text-neutral-600">{label}</td>
                  <td className="py-2 text-right text-fg">{formatBRL(valor)}</td>
                </tr>
              ))}
              <tr className="border-t border-ink-700 font-medium">
                <td className="py-2 text-fg">Total indiretos</td>
                <td className="py-2 text-right text-fg">{formatBRL(r.indiretosRateados + r.depreciacaoRateada + r.indiretosUma)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Receita = medições (ou valor do contrato, se ainda não houver medição). Indiretos e depreciação são rateados
        entre as obras ativas na proporção das horas trabalhadas. Cadastre aquisições e custos indiretos em Finanças.
      </p>
    </div>
  );
}
