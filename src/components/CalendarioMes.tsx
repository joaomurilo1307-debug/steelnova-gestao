"use client";

import Link from "next/link";

type Evento = { id: string; titulo: string; tipo: "tarefa" | "rdo"; obraId: string; obraNome: string; dia: number };

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarioMes({
  ano,
  mes,
  eventos,
}: {
  ano: number;
  mes: number;
  eventos: Evento[];
}) {
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const isHoje = (dia: number) => hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;

  const celulas: (number | null)[] = [
    ...Array(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];
  while (celulas.length % 7 !== 0) celulas.push(null);

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
      <div className="mb-2 grid grid-cols-7 gap-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-neutral-500">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {celulas.map((dia, i) => (
          <div
            key={i}
            className={`min-h-[92px] rounded-lg border p-1.5 ${
              dia === null ? "border-transparent" : isHoje(dia) ? "border-brand bg-brand/10" : "border-ink-800"
            }`}
          >
            {dia !== null && (
              <>
                <p className={`mb-1 text-xs ${isHoje(dia) ? "font-semibold text-brand" : "text-neutral-500"}`}>{dia}</p>
                <div className="flex flex-col gap-0.5">
                  {eventos
                    .filter((e) => e.dia === dia)
                    .slice(0, 3)
                    .map((e) => (
                      <Link
                        key={e.id}
                        href={e.tipo === "rdo" ? `/obras/${e.obraId}/rdo` : `/obras/${e.obraId}/cronograma`}
                        title={`${e.titulo} — ${e.obraNome}`}
                        className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                          e.tipo === "rdo" ? "bg-amber-100 text-amber-800" : "bg-brand/15 text-brand-dark"
                        }`}
                      >
                        {e.titulo}
                      </Link>
                    ))}
                  {eventos.filter((e) => e.dia === dia).length > 3 && (
                    <p className="text-[10px] text-neutral-600">
                      +{eventos.filter((e) => e.dia === dia).length - 3} mais
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
