import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ObraVisaoGeralPage({ params }: { params: { id: string } }) {
  const obra = await prisma.obra.findUnique({
    where: { id: params.id },
    include: { custos: true, membros: { include: { user: true } } },
  });

  if (!obra) notFound();

  const custoReal = obra.custos.reduce((s, c) => s + Number(c.valorRealizado ?? 0), 0);
  const custoPrevisto = obra.custos.reduce((s, c) => s + Number(c.valorPrevisto), 0);

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Contrato</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatBRL(Number(obra.valorContrato))}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Custo previsto</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatBRL(custoPrevisto)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Custo realizado</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatBRL(custoReal)}</p>
        </div>
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <p className="text-xs uppercase text-neutral-500">Progresso</p>
          <p className="mt-2 text-xl font-semibold text-white">{obra.progresso}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 pb-6 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Dados gerais</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Endereço</dt>
              <dd className="text-white">{obra.endereco ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Início</dt>
              <dd className="text-white">{obra.dataInicio.toLocaleDateString("pt-BR")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Prazo previsto</dt>
              <dd className="text-white">{obra.prazoPrevistoDias} dias</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Equipe da obra</h2>
          {obra.membros.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhum membro vinculado ainda — veja a aba Equipe.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {obra.membros.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span className="text-white">{m.user.name}</span>
                  <span className="text-neutral-500">{m.funcao}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
