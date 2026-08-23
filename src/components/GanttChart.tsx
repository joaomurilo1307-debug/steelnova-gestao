"use client";

type Tarefa = {
  id: string;
  fase: string | null;
  titulo: string;
  status: string;
  dataInicio: string | null;
  duracaoDias: number;
  percentConcluido: number;
  dataInicioReal?: string | null;
  dataFimReal?: string | null;
};

const FASE_COLORS = [
  "bg-brand",
  "bg-sky-500",
  "bg-violet-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-lime-600",
];

function diffDias(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function GanttChart({
  tarefas,
  obraInicio,
  obraPrazoDias,
}: {
  tarefas: Tarefa[];
  obraInicio: string;
  obraPrazoDias: number;
}) {
  if (tarefas.length === 0) return null;

  const inicioObra = new Date(obraInicio);
  const fases = Array.from(new Set(tarefas.map((t) => t.fase ?? "Geral")));
  const faseColor = (fase: string) => FASE_COLORS[fases.indexOf(fase) % FASE_COLORS.length];

  const maxOffsetFim = tarefas.reduce((max, t) => {
    const inicio = t.dataInicio ? new Date(t.dataInicio) : inicioObra;
    const offset = Math.max(0, diffDias(inicioObra, inicio));
    return Math.max(max, offset + t.duracaoDias);
  }, obraPrazoDias);

  const totalDias = Math.max(maxOffsetFim, obraPrazoDias, 1);
  const diaLargura = Math.max(22, Math.min(36, Math.floor(900 / totalDias)));
  const diasArray = Array.from({ length: totalDias }, (_, i) => i + 1);

  const ordenadas = [...tarefas].sort((a, b) => {
    const ao = a.dataInicio ? diffDias(inicioObra, new Date(a.dataInicio)) : 0;
    const bo = b.dataInicio ? diffDias(inicioObra, new Date(b.dataInicio)) : 0;
    return ao - bo;
  });

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Gantt — Planejado x Real</h2>
        <div className="flex flex-wrap gap-3">
          {fases.map((fase) => (
            <span key={fase} className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className={`h-2 w-2 rounded-full ${faseColor(fase)}`} />
              {fase}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-1.5 w-3 rounded-sm bg-neutral-800" />
            Real
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 200 + totalDias * diaLargura }}>
          <div className="flex border-b border-ink-800 pb-1.5">
            <div className="w-56 shrink-0 text-xs font-medium text-neutral-500">Atividade</div>
            <div className="flex">
              {diasArray.map((d) => (
                <div
                  key={d}
                  style={{ width: diaLargura }}
                  className="shrink-0 text-center text-[10px] text-neutral-500"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {ordenadas.map((t) => {
            const inicio = t.dataInicio ? new Date(t.dataInicio) : inicioObra;
            const offset = Math.max(0, diffDias(inicioObra, inicio));

            const realInicio = t.dataInicioReal ? new Date(t.dataInicioReal) : null;
            const realOffset = realInicio ? Math.max(0, diffDias(inicioObra, realInicio)) : null;
            const realFim = t.dataFimReal ? new Date(t.dataFimReal) : null;
            const realDuracao =
              realOffset !== null
                ? realFim
                  ? Math.max(1, diffDias(realInicio!, realFim) + 1)
                  : 1
                : null;

            return (
              <div key={t.id} className="flex items-center border-b border-ink-800/60 py-1.5">
                <div className="w-56 shrink-0 truncate pr-2 text-xs text-fg" title={t.titulo}>
                  {t.titulo}
                </div>
                <div className="relative flex" style={{ height: 26 }}>
                  {diasArray.map((d) => (
                    <div key={d} style={{ width: diaLargura }} className="shrink-0 border-r border-ink-800/40" />
                  ))}
                  <div
                    className={`absolute top-0.5 h-3.5 rounded-sm ${faseColor(t.fase ?? "Geral")} ${
                      t.status === "FEITO" ? "opacity-100" : "opacity-70"
                    }`}
                    style={{ left: offset * diaLargura + 1, width: Math.max(t.duracaoDias * diaLargura - 2, 4) }}
                    title={`Previsto: ${t.titulo} — ${t.percentConcluido}%`}
                  >
                    {t.percentConcluido > 0 && (
                      <div
                        className="h-full rounded-sm bg-black/25"
                        style={{ width: `${Math.min(t.percentConcluido, 100)}%` }}
                      />
                    )}
                  </div>
                  {realOffset !== null && (
                    <div
                      className="absolute bottom-0.5 h-1.5 rounded-sm bg-neutral-800"
                      style={{ left: realOffset * diaLargura + 1, width: Math.max((realDuracao ?? 1) * diaLargura - 2, 4) }}
                      title={`Real: ${t.dataInicioReal?.slice(0, 10) ?? ""} → ${t.dataFimReal?.slice(0, 10) ?? "em andamento"}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
