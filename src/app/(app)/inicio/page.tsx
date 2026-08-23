import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

function inicioDoDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default async function InicioPage() {
  const session = await getServerSession(authOptions);
  const hoje = inicioDoDia(new Date());
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const [obrasAtivas, rdosHoje, tarefasHoje, tarefasAtrasadas] = await Promise.all([
    prisma.obra.count({ where: { status: { not: "CONCLUIDA" } } }),
    prisma.rdo.count({ where: { data: { gte: hoje, lt: amanha } } }),
    prisma.tarefa.findMany({
      where: { dataInicio: { gte: hoje, lt: amanha } },
      include: { obra: { select: { id: true, nome: true } }, responsavel: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tarefa.findMany({
      where: { dataInicio: { lt: hoje }, status: { not: "FEITO" } },
      include: { obra: { select: { id: true, nome: true } }, responsavel: { select: { name: true } } },
      orderBy: { dataInicio: "asc" },
      take: 10,
    }),
  ]);

  const primeiroNome = session?.user?.name?.split(" ")[0] ?? "";

  return (
    <div>
      <TopBar
        title={`Olá, ${primeiroNome}`}
        subtitle={hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
      />

      <div className="p-6">
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-100 p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-white shadow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-900/60">Obras ativas</p>
            <p className="mt-0.5 text-3xl font-bold text-violet-700">{obrasAtivas}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-100 p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-900/60">Atividades hoje</p>
            <p className="mt-0.5 text-3xl font-bold text-sky-700">{tarefasHoje.length}</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-100 p-4 shadow-sm">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/60">RDOs hoje</p>
            <p className="mt-0.5 text-3xl font-bold text-amber-700">{rdosHoje}</p>
          </div>

          <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${tarefasAtrasadas.length > 0 ? "border-red-200 bg-gradient-to-br from-red-50 to-rose-100" : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100"}`}>
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow ${tarefasAtrasadas.length > 0 ? "bg-red-500" : "bg-emerald-500"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            </div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${tarefasAtrasadas.length > 0 ? "text-red-900/60" : "text-emerald-900/60"}`}>Tarefas atrasadas</p>
            <p className={`mt-0.5 text-3xl font-bold ${tarefasAtrasadas.length > 0 ? "text-red-700" : "text-emerald-700"}`}>{tarefasAtrasadas.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">Agenda de hoje</h2>
            {tarefasHoje.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma atividade com início hoje.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tarefasHoje.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-fg">{t.titulo}</p>
                      <Link href={`/obras/${t.obra.id}/cronograma`} className="text-xs text-brand hover:underline">
                        {t.obra.nome}
                      </Link>
                    </div>
                    {t.responsavel && <span className="text-xs text-neutral-500">{t.responsavel.name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-fg">Atrasadas</h2>
            {tarefasAtrasadas.length === 0 ? (
              <p className="text-sm text-neutral-500">Nada atrasado — parabéns.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tarefasAtrasadas.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-fg">{t.titulo}</p>
                      <Link href={`/obras/${t.obra.id}/cronograma`} className="text-xs text-brand hover:underline">
                        {t.obra.nome}
                      </Link>
                    </div>
                    <span className="text-xs text-red-600">
                      {t.dataInicio?.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
