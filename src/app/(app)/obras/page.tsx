import Link from "next/link";
import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";
import { formatBRLCompact, obraStatusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ObrasPage() {
  const obras = await prisma.obra.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <TopBar title="Obras" subtitle="Cadastro de obras" />

      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <Link href="/obras/nova" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">
            + Nova obra
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-ink-800">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-left text-neutral-400">
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
                    <Link href={`/obras/${obra.id}`} className="font-medium text-white hover:text-brand">
                      {obra.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{obra.cliente}</td>
                  <td className="px-4 py-3 text-neutral-400">{obraStatusLabel(obra.status)}</td>
                  <td className="px-4 py-3 text-neutral-400">{formatBRLCompact(Number(obra.valorContrato))}</td>
                  <td className="px-4 py-3 text-neutral-400">{obra.progresso}%</td>
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
