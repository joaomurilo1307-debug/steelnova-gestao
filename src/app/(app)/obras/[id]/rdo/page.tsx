import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ObraRdoPage({ params }: { params: { id: string } }) {
  const rdos = await prisma.rdo.findMany({
    where: { obraId: params.id },
    include: { autor: { select: { name: true } } },
    orderBy: { data: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-end">
        <Link
          href={`/obras/${params.id}/rdo/novo`}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Novo RDO
        </Link>
      </div>

      {rdos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">
          Nenhum RDO registrado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rdos.map((rdo) => (
            <div key={rdo.id} className="rounded-xl border border-ink-800 bg-ink-900 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-fg">{rdo.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
                <span className="text-xs text-neutral-500">
                  {rdo.clima} · {rdo.efetivo} pessoas · registrado por {rdo.autor.name}
                </span>
              </div>
              <p className="text-sm text-fg-muted">{rdo.atividades}</p>
              {rdo.ocorrencias && (
                <p className="mt-2 text-sm text-amber-600">Ocorrência: {rdo.ocorrencias}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
