import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

function horasEntre(entrada: string, saida: string): number {
  const [eh, em] = entrada.split(":").map(Number);
  const [sh, sm] = saida.split(":").map(Number);
  let mins = sh * 60 + sm - (eh * 60 + em);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export default async function ObraResultadoPage({ params }: { params: { id: string } }) {
  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    include: {
      custos: true,
      materiais: true,
      desembolsos: true,
      parametrosOrcamento: true,
      lancamentosPonto: { include: { funcionario: true } },
    },
  });
  if (!obra) notFound();

  const horasPorDiaria = Number(obra.parametrosOrcamento?.horasPorDiaria ?? 8);
  const diariaPadrao = Number(obra.parametrosOrcamento?.diariaPadrao ?? 150);
  const impostoPercent = Number(obra.parametrosOrcamento?.impostoPercent ?? 0.06);

  const porFuncionario = new Map<string, { horas: number; regime: string; valorFixo: number; diariaFunc: number | null }>();
  for (const l of obra.lancamentosPonto) {
    const key = l.funcionario.id;
    const cur = porFuncionario.get(key) ?? {
      horas: 0,
      regime: l.funcionario.regime,
      valorFixo: Number(l.funcionario.valorFixo ?? 0),
      diariaFunc: l.funcionario.diariaPadrao ? Number(l.funcionario.diariaPadrao) : null,
    };
    cur.horas += horasEntre(l.entrada, l.saida);
    porFuncionario.set(key, cur);
  }
  let custoMaoDeObra = 0;
  for (const f of porFuncionario.values()) {
    if (f.regime === "Fixo") {
      custoMaoDeObra += f.valorFixo;
    } else {
      const taxa = f.diariaFunc ?? diariaPadrao;
      custoMaoDeObra += f.horas * (taxa / horasPorDiaria);
    }
  }

  const custoDesembolsos = obra.desembolsos
    .filter((d) => d.categoria !== "Adiantamento")
    .reduce((s, d) => s + Number(d.valor), 0);

  const custoMateriais = obra.materiais.reduce(
    (s, m) => s + Number(m.custoUnitario ?? 0) * Number(m.quantidadeRecebida),
    0
  );

  const custoLancamentos = obra.custos.reduce((s, c) => s + Number(c.valorRealizado ?? c.valorPrevisto), 0);

  const receita = Number(obra.valorContrato);
  const custoTotal = custoMaoDeObra + custoDesembolsos + custoMateriais + custoLancamentos;
  const impostos = receita * impostoPercent;
  const lucro = receita - custoTotal - impostos;
  const margem = receita > 0 ? lucro / receita : 0;

  const linhas = [
    ["Mão de obra (diárias)", custoMaoDeObra],
    ["Desembolsos (material/alimentação/ferramenta)", custoDesembolsos],
    ["Materiais recebidos (custo unitário × qtd.)", custoMateriais],
    ["Lançamentos de custo (aba Custos)", custoLancamentos],
  ] as const;

  return (
    <div className="p-6">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Receita</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(receita)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Custo total</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(custoTotal)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Impostos ({(impostoPercent * 100).toFixed(1)}%)</p>
          <p className="mt-1 text-xl font-semibold text-fg">{formatBRL(impostos)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Lucro</p>
          <p className={`mt-1 text-xl font-semibold ${lucro >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatBRL(lucro)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-fg">Composição do custo</h2>
        <table className="w-full text-sm">
          <tbody>
            {linhas.map(([label, valor]) => (
              <tr key={label} className="border-t border-ink-800">
                <td className="py-2 text-neutral-600">{label}</td>
                <td className="py-2 text-right text-fg">{formatBRL(valor)}</td>
              </tr>
            ))}
            <tr className="border-t border-ink-700 font-medium">
              <td className="py-2 text-fg">CUSTO TOTAL</td>
              <td className="py-2 text-right text-fg">{formatBRL(custoTotal)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4 text-sm text-neutral-600">
          Margem sobre a receita: <span className="text-fg">{(margem * 100).toFixed(1)}%</span>
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Receita = valor do contrato da obra (edite em Visão geral, se necessário). Imposto = % sobre faturamento
          configurado na aba Orçamento → Parâmetros.
        </p>
      </div>
    </div>
  );
}
