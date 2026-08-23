import { prisma } from "@/lib/prisma";
import TopBar from "@/components/TopBar";
import CalendarioMes from "@/components/CalendarioMes";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 1);

  const [tarefas, rdos] = await Promise.all([
    prisma.tarefa.findMany({
      where: { dataInicio: { gte: inicioMes, lt: fimMes } },
      include: { obra: { select: { id: true, nome: true } } },
    }),
    prisma.rdo.findMany({
      where: { data: { gte: inicioMes, lt: fimMes } },
      include: { obra: { select: { id: true, nome: true } } },
    }),
  ]);

  const eventos = [
    ...tarefas.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      tipo: "tarefa" as const,
      obraId: t.obra.id,
      obraNome: t.obra.nome,
      dia: t.dataInicio!.getUTCDate(),
    })),
    ...rdos.map((r) => ({
      id: r.id,
      titulo: `RDO — ${r.obra.nome}`,
      tipo: "rdo" as const,
      obraId: r.obra.id,
      obraNome: r.obra.nome,
      dia: r.data.getUTCDate(),
    })),
  ];

  const nomeMes = inicioMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      <TopBar title="Calendário" subtitle={nomeMes} />
      <div className="p-6">
        <CalendarioMes ano={ano} mes={mes} eventos={eventos} />
      </div>
    </div>
  );
}
