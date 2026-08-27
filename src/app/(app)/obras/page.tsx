import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";
import { formatBRLCompact, obraStatusLabel } from "@/lib/format";
import { getMedicaoData } from "@/lib/medicao";

export const dynamic = "force-dynamic";

export default async function ObrasPage() {
  const obras = await prisma.obra.findMany({ orderBy: { createdAt: "desc" } });
  // progresso real (físico-financeiro da Medição), não o campo Obra.progresso manual —
  // nada nunca escreve nesse campo, então ficava sempre 0.
  const progressos = await Promise.all(
    obras.map(async (o) => [o.id, o.status === "CONCLUIDA" ? 100 : Math.round((await getMedicaoData(o.id)).pctObra)] as const)
  );
  const progressoPorObra = new Map(progressos);

  return (
    <div>
      <TopBar title="Obras" subtitle="Cadastro de obras" />

      <div className="p-8">
        <div className="mb-4 flex justify-end">
          <Link href="/obras/nova" className="btn-primary px-3 py-1.5 text-sm">
            + Nova obra
          </Link>
        </div>

        <div className="overflow-x-auto card">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Obra</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Contrato</th>
                <th className="px-4 py-3 font-medium">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {obras.map((obra) => (
                <tr key={obra.id} className="border-t border-ink-800 hover:bg-ink-900">
                  <td className="px-4 py-3">
                    <Link href={`/obras/${obra.id}`} className="font-medium text-fg hover:text-brand">
                      {obra.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{obra.cliente}</td>
                  <td className="px-4 py-3 text-neutral-600">{obraStatusLabel(obra.status)}</td>
                  <td className="px-4 py-3 text-neutral-600">{formatBRLCompact(Number(obra.valorContrato))}</td>
                  <td className="px-4 py-3 text-neutral-600">{progressoPorObra.get(obra.id)}%</td>
                </tr>
              ))}
              {obras.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    Nenhuma obra cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
