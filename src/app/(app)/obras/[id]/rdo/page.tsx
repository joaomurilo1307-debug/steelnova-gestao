import Link from "next/link";
import { prisma } from "@/lib/prisma";
import RdoDeleteButton from "@/components/RdoDeleteButton";
import RdoImport from "@/components/RdoImport";

export const dynamic = "force-dynamic";

const CLIMA_LABEL: Record<string, string> = {
  SOL: "☀️ Sol",
  NUBLADO: "☁️ Nublado",
  CHUVA: "🌧️ Chuva",
  TEMPO_RUIM: "⛈️ Tempo ruim",
};

export default async function ObraRdoPage({ params }: { params: { id: string } }) {
  const rdos = await prisma.rdo.findMany({
    where: { obraId: params.id },
    include: {
      autor: { select: { name: true } },
      trabalhadores: true,
      atividades: { include: { tarefa: { select: { id: true, titulo: true } } } },
      pendencias: true,
      fotos: true,
    },
    orderBy: { data: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <RdoImport obraId={params.id} />
        <Link
          href={`/obras/${params.id}/rdo/novo`}
          className="btn-primary px-3 py-1.5 text-sm"
        >
          + Novo RDO
        </Link>
      </div>

      {rdos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-800 p-8 text-center text-sm text-neutral-500">
          Nenhum RDO registrado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rdos.map((rdo) => (
            <div key={rdo.id} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-fg">{rdo.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
                  <p className="text-xs text-neutral-500">
                    {CLIMA_LABEL[rdo.clima] ?? rdo.clima}
                    {rdo.horarioInicio && rdo.horarioTermino && ` · ${rdo.horarioInicio}–${rdo.horarioTermino}`}
                    {" · "}
                    {rdo.trabalhadores.length} {rdo.trabalhadores.length === 1 ? "pessoa" : "pessoas"} · registrado por {rdo.autor.name}
                  </p>
                </div>
                <RdoDeleteButton rdoId={rdo.id} />
              </div>

              {rdo.houveParalisacao && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  ⚠ Paralisação {rdo.horarioParalisacao ? `(${rdo.horarioParalisacao})` : ""}
                  {rdo.motivoParalisacao ? ` — ${rdo.motivoParalisacao}` : ""}
                </p>
              )}

              {rdo.trabalhadores.length > 0 && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-neutral-500">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Nome</th>
                        <th className="py-1 pr-3 font-medium">Função</th>
                        <th className="py-1 pr-3 font-medium">Entrada</th>
                        <th className="py-1 font-medium">Saída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rdo.trabalhadores.map((t) => (
                        <tr key={t.id} className="border-t border-ink-800/60">
                          <td className="py-1 pr-3 text-fg">{t.nome}</td>
                          <td className="py-1 pr-3 text-neutral-600">{t.funcao}</td>
                          <td className="py-1 pr-3 text-neutral-600">{t.entrada ?? "—"}</td>
                          <td className="py-1 text-neutral-600">{t.saida ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rdo.atividades.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-xs font-medium text-neutral-500">Atividades</p>
                  <ul className="flex flex-col gap-0.5">
                    {rdo.atividades.map((a) => (
                      <li key={a.id} className="text-sm text-fg">
                        {a.situacao === "FINALIZADA" ? "✅" : "🔶"} {a.descricao}
                        {a.tarefa && (
                          <span className="ml-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand-dark">
                            📋 {a.tarefa.titulo}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rdo.pendencias.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-xs font-medium text-neutral-500">Pendências</p>
                  <ul className="flex flex-col gap-0.5">
                    {rdo.pendencias.map((p) => (
                      <li key={p.id} className="text-sm text-amber-700">
                        • {p.descricao}
                        {p.observacao && <span className="text-neutral-500"> — {p.observacao}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rdo.observacoes && <p className="mt-2 text-sm text-fg-muted">{rdo.observacoes}</p>}

              {rdo.fotos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {rdo.fotos.map((f) => (
                    <a key={f.id} href={`/api/rdo/fotos/${f.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/rdo/fotos/${f.id}`} alt={f.legenda ?? "Foto do RDO"} className="h-20 w-20 rounded-lg border border-ink-800 object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
