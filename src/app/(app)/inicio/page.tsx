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
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">Obras ativas</p>
            <p className="mt-1 text-2xl font-semibold text-white">{obrasAtivas}</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">RDOs registrados hoje</p>
            <p className="mt-1 text-2xl font-semibold text-white">{rdosHoje}</p>
          </div>
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs uppercase text-neutral-500">Tarefas atrasadas</p>
            <p className={`mt-1 text-2xl font-semibold ${tarefasAtrasadas.length > 0 ? "text-red-400" : "text-white"}`}>
              {tarefasAtrasadas.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Agenda de hoje</h2>
            {tarefasHoje.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma atividade com início hoje.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tarefasHoje.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-white">{t.titulo}</p>
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
            <h2 className="mb-3 text-sm font-semibold text-white">Atrasadas</h2>
            {tarefasAtrasadas.length === 0 ? (
              <p className="text-sm text-neutral-500">Nada atrasado — parabéns.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {tarefasAtrasadas.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-white">{t.titulo}</p>
                      <Link href={`/obras/${t.obra.id}/cronograma`} className="text-xs text-brand hover:underline">
                        {t.obra.nome}
                      </Link>
                    </div>
                    <span className="text-xs text-red-400">
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
